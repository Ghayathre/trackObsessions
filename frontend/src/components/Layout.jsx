import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { listCategories, listSuggestions, createCategory, deleteCategory } from "../lib/db";
import {
  Home, Settings, Plus, LogOut, Sparkles, Bell, Flame, Menu,
  Clapperboard, Heart, BookOpen, Library, Hash, Activity as ActivityIcon
} from "lucide-react";
import { Button } from "./ui/button";
import HanabiInbox from "./HanabiInbox";
import SnapToAddDialog from "./SnapToAddDialog";
import { Sheet, SheetContent } from "./ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Float } from "../lib/motion";
import { toast } from "sonner";

const ICONS = { Clapperboard, Heart, BookOpen, Library, Sparkles, Hash };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [pending, setPending] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false); // mobile drawer

  const loadCats = async () => {
    try { setCats(await listCategories()); } catch {}
  };
  const loadPending = async () => {
    try {
      const data = await listSuggestions("pending");
      setPending(data.length);
    } catch {}
  };

  useEffect(() => {
    loadCats();
    loadPending();
    const t = setInterval(loadPending, 20000);
    // Reload collection counts when titles are added/moved/removed anywhere.
    const onLibraryChange = () => loadCats();
    window.addEventListener("hanabi:library-changed", onLibraryChange);
    return () => {
      clearInterval(t);
      window.removeEventListener("hanabi:library-changed", onLibraryChange);
    };
  }, []);

  const onCreateCategory = async (name) => {
    try {
      await createCategory({ name, icon: "Hash", kind: "custom" });
      await loadCats();
      toast.success("Category added");
    } catch (err) {
      toast.error("Could not create category");
    }
  };

  const onDeleteCategory = async (id) => {
    try {
      await deleteCategory(id);
      await loadCats();
      toast.success("Category removed");
      setNavOpen(false);
      navigate("/");
    } catch {
      toast.error("Could not delete category");
    }
  };

  const sidebarProps = {
    cats, pending, user, theme,
    onInbox: () => setInboxOpen(true),
    onLogout: logout,
    onCreateCategory,
    onDeleteCategory,
    onSnapAdded: loadCats,
  };

  return (
    <div className="min-h-screen flex text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-72 border-r border-border bg-card/40 backdrop-blur-xl sticky top-0 h-screen" data-testid="sidebar">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[18rem] max-w-[85vw] p-0 overflow-y-auto" data-testid="mobile-nav">
          <SidebarContent {...sidebarProps} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
          <div className="flex items-center gap-1">
            <button onClick={() => setNavOpen(true)} className="p-2 -ml-2" aria-label="Open menu" data-testid="mobile-menu-btn">
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="font-display font-black text-lg flex items-center gap-2"><Flame className="w-4 h-4 text-primary" /> Hanabi</Link>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setInboxOpen(true)} className="relative p-2" data-testid="mobile-inbox-btn" aria-label="Open inbox">
              <Bell className="w-5 h-5" />
              {pending > 0 && <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5">{pending}</span>}
            </button>
            <Link to="/settings" className="p-2" aria-label="Settings"><Settings className="w-5 h-5" /></Link>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-10 lg:p-12 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      <HanabiInbox open={inboxOpen} onOpenChange={(v) => { setInboxOpen(v); if (!v) { loadPending(); loadCats(); } }} categories={cats} />
    </div>
  );
}

// Shared sidebar body — rendered in the desktop aside and the mobile drawer.
// Each instance owns its own "new collection" dialog state so the two copies don't collide.
function SidebarContent({ cats, pending, user, theme, onInbox, onLogout, onCreateCategory, onDeleteCategory, onSnapAdded, onNavigate = () => {} }) {
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const submitCat = async (e) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    await onCreateCategory(name);
    setNewCatName("");
    setNewCatOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <Float className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center hanabi-glow">
          <Flame className="w-5 h-5" />
        </Float>
        <div>
          <div className="font-display font-black text-xl leading-none">Hanabi</div>
          <div className="text-xs text-muted-foreground mt-0.5">Hobby tracker</div>
        </div>
      </div>

      <nav className="px-3 flex flex-col gap-1">
        <SideLink to="/" icon={<Home className="w-4 h-4" />} label="Dashboard" testid="nav-dashboard" onClick={onNavigate} />
        <SideLink to="/activity" icon={<ActivityIcon className="w-4 h-4" />} label="Activity" testid="nav-activity" onClick={onNavigate} />
        <div className="px-2 py-1.5">
          <SnapToAddDialog categories={cats} onAdded={onSnapAdded} />
        </div>
        <button
          onClick={() => { onNavigate(); onInbox(); }}
          data-testid="nav-inbox"
          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/60 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4" /> Hanabi Inbox
          </span>
          {pending > 0 && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 hanabi-glow" data-testid="inbox-count">
              {pending}
            </span>
          )}
        </button>
        <SideLink to="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" testid="nav-settings" onClick={onNavigate} />
      </nav>

      <div className="px-6 mt-6 mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Collections</div>
        <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
          <DialogTrigger asChild>
            <button className="text-muted-foreground hover:text-primary transition-colors" data-testid="add-category-btn" aria-label="New collection">
              <Plus className="w-4 h-4" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader>
            <form onSubmit={submitCat} className="space-y-3">
              <div>
                <Label htmlFor="cat-name">Name</Label>
                <Input id="cat-name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Cdramas, Webtoons" data-testid="new-category-input" />
              </div>
              <Button type="submit" className="w-full" data-testid="create-category-submit">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-3 flex flex-col gap-0.5 overflow-y-auto">
        {cats.map((c) => {
          const Icon = ICONS[c.icon] || Sparkles;
          return (
            <div key={c.id} className="group flex items-center">
              <NavLink
                to={`/c/${c.id}`}
                onClick={onNavigate}
                data-testid={`nav-category-${c.slug}`}
                className={({ isActive }) =>
                  `flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/60"
                  }`
                }
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{c.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{c.count}</span>
              </NavLink>
              {!c.is_default && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="text-muted-foreground hover:text-destructive px-2 transition md:opacity-0 md:group-hover:opacity-100"
                      title="Delete"
                      data-testid={`delete-category-${c.slug}`}
                    >×</button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{c.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the collection and all <b>{c.count}</b> title{c.count === 1 ? "" : "s"} inside it. This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid={`cancel-delete-cat-${c.slug}`}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDeleteCategory(c.id)} data-testid={`confirm-delete-cat-${c.slug}`}>
                        Yes, delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground grid place-items-center font-bold uppercase">
            {(user?.name || user?.email || "?")[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name || user?.email}</div>
            <div className="text-xs text-muted-foreground">theme · {theme}</div>
          </div>
          <button onClick={onLogout} className="text-muted-foreground hover:text-destructive" data-testid="logout-btn" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SideLink({ to, icon, label, testid, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      data-testid={testid}
      end
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/60"
        }`
      }
    >
      {icon} {label}
    </NavLink>
  );
}
