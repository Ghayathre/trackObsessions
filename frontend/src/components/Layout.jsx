import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../lib/api";
import {
  Home, Settings, Plus, LogOut, Sparkles, Bell, Flame,
  Clapperboard, Heart, BookOpen, Library, Hash, Activity as ActivityIcon
} from "lucide-react";
import { Button } from "./ui/button";
import HanabiInbox from "./HanabiInbox";
import SnapToAddDialog from "./SnapToAddDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

const ICONS = { Clapperboard, Heart, BookOpen, Library, Sparkles, Hash };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [pending, setPending] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const loadCats = async () => {
    const { data } = await api.get("/categories");
    setCats(data);
  };
  const loadPending = async () => {
    try {
      const { data } = await api.get("/suggestions", { params: { status: "pending" } });
      setPending(data.length);
    } catch {}
  };

  useEffect(() => {
    loadCats();
    loadPending();
    const t = setInterval(loadPending, 20000);
    return () => clearInterval(t);
  }, []);

  const onCreateCat = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post("/categories", { name: newCatName.trim(), icon: "Hash", kind: "custom" });
      setNewCatName("");
      setNewCatOpen(false);
      await loadCats();
      toast.success("Category added");
    } catch (err) {
      toast.error("Could not create category");
    }
  };

  const onDeleteCat = async (id) => {
    await api.delete(`/categories/${id}`);
    await loadCats();
    toast.success("Category removed");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 border-r border-border bg-card/40 backdrop-blur-xl sticky top-0 h-screen" data-testid="sidebar">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center hanabi-glow">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-black text-xl leading-none">Hanabi</div>
            <div className="text-xs text-muted-foreground mt-0.5">Hobby tracker</div>
          </div>
        </div>

        <nav className="px-3 flex flex-col gap-1">
          <SideLink to="/" icon={<Home className="w-4 h-4" />} label="Dashboard" testid="nav-dashboard" />
          <SideLink to="/activity" icon={<ActivityIcon className="w-4 h-4" />} label="Activity" testid="nav-activity" />
          <div className="px-2 py-1.5">
            <SnapToAddDialog categories={cats} onAdded={() => loadCats()} />
          </div>
          <button
            onClick={() => setInboxOpen(true)}
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
          <SideLink to="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" testid="nav-settings" />
        </nav>

        <div className="px-6 mt-6 mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Collections</div>
          <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
            <DialogTrigger asChild>
              <button className="text-muted-foreground hover:text-primary transition-colors" data-testid="add-category-btn">
                <Plus className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader>
              <form onSubmit={onCreateCat} className="space-y-3">
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
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive px-2 transition"
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
                        <AlertDialogAction onClick={() => onDeleteCat(c.id)} data-testid={`confirm-delete-cat-${c.slug}`}>
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
            <button onClick={logout} className="text-muted-foreground hover:text-destructive" data-testid="logout-btn" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
          <Link to="/" className="font-display font-black text-lg flex items-center gap-2"><Flame className="w-4 h-4 text-primary" /> Hanabi</Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setInboxOpen(true)} className="relative p-2" data-testid="mobile-inbox-btn">
              <Bell className="w-5 h-5" />
              {pending > 0 && <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5">{pending}</span>}
            </button>
            <Link to="/settings" className="p-2"><Settings className="w-5 h-5" /></Link>
          </div>
        </div>

        <div className="p-6 md:p-10 lg:p-12 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      <HanabiInbox open={inboxOpen} onOpenChange={(v) => { setInboxOpen(v); if (!v) { loadPending(); loadCats(); } }} categories={cats} />
    </div>
  );
}

function SideLink({ to, icon, label, testid }) {
  return (
    <NavLink
      to={to}
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
