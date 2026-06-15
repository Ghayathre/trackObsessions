import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listCategories, listSuggestions, createCategory, deleteCategory } from "../lib/db";
import {
  Home, Settings, Plus, LogOut, Sparkles, Bell, Flame, Menu, GripVertical,
  ChevronLeft, ChevronRight, ChevronDown,
  Clapperboard, Heart, BookOpen, Library, Hash, Activity as ActivityIcon, History
} from "lucide-react";
import { Button } from "./ui/button";
import HanabiInbox from "./HanabiInbox";
import SnapToAddDialog from "./SnapToAddDialog";
import { Sheet, SheetContent } from "./ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Float } from "../lib/motion";
import { toast } from "sonner";

const ICONS = { Clapperboard, Heart, BookOpen, Library, Sparkles, Hash };

// The sidebar can be docked to any window edge (desktop only). Left/right keep it a
// vertical column; top/bottom turn it into a horizontal bar. The chosen edge persists.
const DOCK_KEY = "hanabi_sidebar_dock";
const COLLAPSE_KEY = "hanabi_sidebar_collapsed";
const DOCKS = ["left", "right", "top", "bottom"];

function nearestEdge(x, y) {
  const W = window.innerWidth, H = window.innerHeight;
  const d = { left: x, right: W - x, top: y, bottom: H - y };
  return DOCKS.reduce((a, b) => (d[b] < d[a] ? b : a));
}

// Footprint of where the sidebar will land, used for the drop preview while dragging.
function dockFootprint(edge) {
  switch (edge) {
    case "left": return { top: 0, left: 0, bottom: 0, width: "18rem" };
    case "right": return { top: 0, right: 0, bottom: 0, width: "18rem" };
    case "top": return { top: 0, left: 0, right: 0, height: "4rem" };
    case "bottom": return { left: 0, right: 0, bottom: 0, height: "4rem" };
    default: return {};
  }
}

const OUTER_DIR = {
  left: "md:flex-row",
  right: "md:flex-row-reverse",
  top: "md:flex-col",
  bottom: "md:flex-col-reverse",
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [pending, setPending] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false); // mobile drawer

  const [dock, setDock] = useState(() => {
    const saved = localStorage.getItem(DOCK_KEY);
    return DOCKS.includes(saved) ? saved : "left";
  });
  const [drag, setDrag] = useState(null); // { x, y, edge } while dragging the sidebar
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const dockRef = useRef(dock);
  const hintRef = useRef(null);
  useEffect(() => { dockRef.current = dock; }, [dock]);

  const vertical = dock === "left" || dock === "right";
  // Collapse only applies to the vertical (left/right) rail.
  const isCollapsed = vertical && collapsed;

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

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

  // Drag-to-dock: grab the handle, a ghost card follows the cursor, the nearest edge
  // lights up, and on release the sidebar snaps there.
  const startDrag = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    document.body.style.userSelect = "none";
    hintRef.current = nearestEdge(e.clientX, e.clientY);
    setDrag({ x: e.clientX, y: e.clientY, edge: hintRef.current });

    const move = (ev) => {
      const edge = nearestEdge(ev.clientX, ev.clientY);
      hintRef.current = edge;
      setDrag({ x: ev.clientX, y: ev.clientY, edge });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      const edge = hintRef.current || dockRef.current;
      if (edge !== dockRef.current) {
        setDock(edge);
        localStorage.setItem(DOCK_KEY, edge);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const sidebarProps = {
    cats, pending, user,
    onInbox: () => setInboxOpen(true),
    onLogout: logout,
    onCreateCategory,
    onDeleteCategory,
    onSnapAdded: loadCats,
  };

  const asideClass = vertical
    ? `hidden md:flex md:flex-col ${isCollapsed ? "w-16" : "w-72"} shrink-0 h-screen sticky top-0 bg-card/40 backdrop-blur-xl border-border transition-[width] duration-300 ${dock === "right" ? "border-l" : "border-r"} ${drag ? "opacity-60" : ""}`
    : `hidden md:flex md:flex-row w-full shrink-0 sticky z-20 bg-card/40 backdrop-blur-xl border-border ${dock === "bottom" ? "bottom-0 border-t" : "top-0 border-b"} ${drag ? "opacity-60" : ""}`;

  return (
    <div className={`min-h-screen flex ${OUTER_DIR[dock]} text-foreground`}>
      {/* Desktop sidebar (dockable) */}
      <aside className={asideClass} data-testid="sidebar" data-dock={dock} data-collapsed={isCollapsed ? "1" : "0"}>
        <SidebarContent
          {...sidebarProps}
          orientation={vertical ? "vertical" : "horizontal"}
          onDragStart={startDrag}
          dock={dock}
          collapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* Mobile drawer — always a vertical column */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[18rem] max-w-[85vw] p-0 overflow-y-auto" data-testid="mobile-nav">
          <SidebarContent {...sidebarProps} orientation="vertical" onNavigate={() => setNavOpen(false)} />
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

      {/* Drag overlay: edge guides, target footprint, and a ghost card on the cursor */}
      {drag && <DockDragOverlay drag={drag} />}
    </div>
  );
}

// ---- Drag overlay --------------------------------------------------------

function DockDragOverlay({ drag }) {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed", ...dockFootprint(drag.edge), zIndex: 50, pointerEvents: "none",
          background: "hsl(var(--primary) / 0.10)",
          border: "2px dashed hsl(var(--primary) / 0.6)",
          borderRadius: 14,
        }}
      />
      {DOCKS.map((edge) => {
        const on = edge === drag.edge;
        const horiz = edge === "top" || edge === "bottom";
        const thick = on ? 8 : 5;
        const len = on ? "34vmin" : "20vmin";
        const pos = horiz
          ? { left: "50%", transform: "translateX(-50%)", width: len, height: thick, [edge]: 10 }
          : { top: "50%", transform: "translateY(-50%)", height: len, width: thick, [edge]: 10 };
        return (
          <div
            key={edge}
            aria-hidden="true"
            style={{
              position: "fixed", zIndex: 55, pointerEvents: "none", borderRadius: 999,
              background: on ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)",
              boxShadow: on ? "0 0 18px hsl(var(--primary) / 0.7)" : "none",
              transition: "background .15s, box-shadow .15s",
              ...pos,
            }}
          />
        );
      })}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", top: drag.y, left: drag.x, zIndex: 60,
          transform: "translate(-50%, -50%) rotate(-2deg)", pointerEvents: "none",
        }}
        className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-card border border-border shadow-2xl"
      >
        <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hanabi-glow shrink-0">
          <Flame className="w-5 h-5" />
        </div>
        <div className="leading-tight">
          <div className="font-display font-black">Hanabi</div>
          <div className="text-[11px] text-muted-foreground">
            Release on the <span className="text-primary font-medium capitalize">{drag.edge}</span> edge
          </div>
        </div>
      </div>
    </>
  );
}

// ---- Sidebar body --------------------------------------------------------

// Shared sidebar body. `orientation` is "vertical" (left/right dock + mobile) or
// "horizontal" (top/bottom dock). onDragStart is only passed for the desktop sidebar.
function SidebarContent({ orientation = "vertical", dock, onDragStart, ...props }) {
  return orientation === "horizontal"
    ? <HorizontalBar dock={dock} onDragStart={onDragStart} {...props} />
    : <VerticalBar dock={dock} onDragStart={onDragStart} {...props} />;
}

function VerticalBar({ cats, pending, user, dock, onDragStart, onInbox, onLogout, onCreateCategory, onDeleteCategory, onSnapAdded, onNavigate = () => {}, collapsed = false, onToggleCollapse }) {
  // Chevron points toward the docked edge to collapse, away from it to expand.
  const ToggleIcon = dock === "right"
    ? (collapsed ? ChevronLeft : ChevronRight)
    : (collapsed ? ChevronRight : ChevronLeft);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`flex items-center ${collapsed ? "flex-col gap-2 pt-4 px-2" : ""}`}>
        <Link
          to="/"
          onClick={onNavigate}
          data-testid="sidebar-home"
          className={collapsed
            ? "grid place-items-center p-2 rounded-lg transition-colors hover:bg-muted/40"
            : "flex-1 min-w-0 p-6 flex items-center gap-3 rounded-lg transition-colors hover:bg-muted/40"}
          aria-label="Go to dashboard"
          title={collapsed ? "Hanabi — dashboard" : undefined}
        >
          <Float className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center hanabi-glow shrink-0">
            <Flame className="w-5 h-5" />
          </Float>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-black text-xl leading-none">Hanabi</div>
              <div className="text-xs text-muted-foreground mt-0.5">Hobby tracker</div>
            </div>
          )}
        </Link>
        {!collapsed && onDragStart && <DragHandle onDragStart={onDragStart} className="mr-1" />}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-testid="sidebar-collapse-toggle"
            className={`p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 ${collapsed ? "" : "mr-3"}`}
          >
            <ToggleIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className={`flex flex-col gap-1 ${collapsed ? "px-2 mt-2" : "px-3"}`}>
        <SideLink to="/" icon={<Home className="w-4 h-4" />} label="Dashboard" testid="nav-dashboard" onClick={onNavigate} collapsed={collapsed} />
        <SideLink to="/recently-watched" icon={<History className="w-4 h-4" />} label="Recently watched" testid="nav-recently-watched" onClick={onNavigate} collapsed={collapsed} />
        <SideLink to="/activity" icon={<ActivityIcon className="w-4 h-4" />} label="Activity" testid="nav-activity" onClick={onNavigate} collapsed={collapsed} />
        <div className={collapsed ? "px-0.5 py-1 grid place-items-center" : "px-2 py-1.5"}>
          <SnapToAddDialog categories={cats} onAdded={onSnapAdded} compact={collapsed} />
        </div>
        <InboxButton pending={pending} onInbox={onInbox} onNavigate={onNavigate} collapsed={collapsed} className={collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2.5"} />
      </nav>

      <div className={`mt-6 mb-2 flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-6"}`}>
        {!collapsed && <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Collections</div>}
        <NewCollectionDialog onCreateCategory={onCreateCategory} compact={collapsed} />
      </div>

      <div className={`flex flex-col gap-0.5 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}>
        {cats.map((c) => (
          <CategoryItem key={c.id} c={c} orientation="vertical" collapsed={collapsed} onNavigate={onNavigate} onDeleteCategory={onDeleteCategory} />
        ))}
      </div>

      <ProfileEntry user={user} onLogout={onLogout} onNavigate={onNavigate} orientation="vertical" collapsed={collapsed} />
    </div>
  );
}

function HorizontalBar({ cats, pending, user, dock, onDragStart, onInbox, onLogout, onCreateCategory, onSnapAdded, onNavigate = () => {} }) {
  return (
    <div className="flex items-center gap-2 w-full h-16 px-3">
      {onDragStart && <DragHandle onDragStart={onDragStart} />}

      <Link
        to="/"
        onClick={onNavigate}
        data-testid="sidebar-home"
        className="flex items-center gap-2 pl-1 pr-2 rounded-lg transition-colors hover:bg-muted/40 shrink-0"
        aria-label="Go to dashboard"
      >
        <Float className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hanabi-glow shrink-0">
          <Flame className="w-4 h-4" />
        </Float>
        <div className="font-display font-black text-lg leading-none hidden lg:block">Hanabi</div>
      </Link>

      <div className="w-px h-8 bg-border shrink-0" />

      <nav className="flex items-center gap-1 shrink-0">
        <SideLink to="/" icon={<Home className="w-4 h-4" />} label="Dashboard" testid="nav-dashboard" onClick={onNavigate} compact />
        <SideLink to="/recently-watched" icon={<History className="w-4 h-4" />} label="Recently watched" testid="nav-recently-watched" onClick={onNavigate} compact />
        <SideLink to="/activity" icon={<ActivityIcon className="w-4 h-4" />} label="Activity" testid="nav-activity" onClick={onNavigate} compact />
        <SnapToAddDialog categories={cats} onAdded={onSnapAdded} />
        <InboxButton pending={pending} onInbox={onInbox} onNavigate={onNavigate} className="gap-2 px-3 py-2" compact />
      </nav>

      <div className="w-px h-8 bg-border shrink-0" />

      <div className="flex items-center gap-1.5 shrink-0">
        <CollectionsDropdown cats={cats} onNavigate={onNavigate} side={dock === "bottom" ? "top" : "bottom"} />
        <NewCollectionDialog onCreateCategory={onCreateCategory} compact />
      </div>

      <ProfileEntry user={user} onLogout={onLogout} onNavigate={onNavigate} orientation="horizontal" />
    </div>
  );
}

// ---- Pieces --------------------------------------------------------------

function DragHandle({ onDragStart, className = "" }) {
  return (
    <button
      onPointerDown={onDragStart}
      title="Drag to dock to any edge"
      aria-label="Move sidebar"
      data-testid="sidebar-drag-handle"
      className={`p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing transition-colors shrink-0 ${className}`}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
}

function InboxButton({ pending, onInbox, onNavigate, className = "", compact = false, collapsed = false }) {
  return (
    <button
      onClick={() => { onNavigate?.(); onInbox(); }}
      data-testid="nav-inbox"
      title={collapsed ? "Hanabi Inbox" : undefined}
      className={`flex items-center gap-2 rounded-lg text-sm hover:bg-muted/60 transition-colors ${className}`}
    >
      <span className="relative flex items-center gap-2">
        <Bell className="w-4 h-4" /> {!collapsed && <span className={compact ? "hidden lg:inline" : ""}>Hanabi Inbox</span>}
        {collapsed && pending > 0 && (
          <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-primary hanabi-glow" data-testid="inbox-count" />
        )}
      </span>
      {!collapsed && pending > 0 && (
        <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 hanabi-glow" data-testid="inbox-count">
          {pending}
        </span>
      )}
    </button>
  );
}

function NewCollectionDialog({ onCreateCategory, compact = false }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await onCreateCategory(n);
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={
            compact
              ? "shrink-0 grid place-items-center w-8 h-8 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              : "text-muted-foreground hover:text-primary transition-colors"
          }
          data-testid="add-category-btn"
          aria-label="New collection"
        >
          <Plus className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cdramas, Webtoons" data-testid="new-category-input" />
          </div>
          <Button type="submit" className="w-full" data-testid="create-category-submit">Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// In the horizontal (top/bottom) bar collections live in a dropdown instead of a
// scrolling strip. `side` opens it away from the docked edge.
function CollectionsDropdown({ cats, onNavigate, side = "bottom" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/60 transition-colors"
          data-testid="collections-dropdown"
        >
          <Library className="w-4 h-4" />
          <span className="hidden lg:inline">Collections</span>
          <span className="text-xs text-muted-foreground tabular-nums">{cats.length}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={side} className="w-56 max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel>Collections</DropdownMenuLabel>
        {cats.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No collections yet</div>
        )}
        {cats.map((c) => {
          const Icon = ICONS[c.icon] || Sparkles;
          return (
            <DropdownMenuItem key={c.id} asChild>
              <NavLink
                to={`/c/${c.id}`}
                onClick={onNavigate}
                data-testid={`nav-category-${c.slug}`}
                className={({ isActive }) => `flex items-center gap-2 cursor-pointer ${isActive ? "text-primary" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{c.count}</span>
              </NavLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategoryItem({ c, orientation, onNavigate, onDeleteCategory, collapsed = false }) {
  const Icon = ICONS[c.icon] || Sparkles;
  const horizontal = orientation === "horizontal";

  if (collapsed) {
    return (
      <NavLink
        to={`/c/${c.id}`}
        onClick={onNavigate}
        data-testid={`nav-category-${c.slug}`}
        title={`${c.name} · ${c.count}`}
        className={({ isActive }) =>
          `flex items-center justify-center px-2 py-2 rounded-lg text-sm transition-colors ${
            isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/60"
          }`
        }
      >
        <Icon className="w-4 h-4 shrink-0" />
      </NavLink>
    );
  }

  return (
    <div className={`group ${horizontal ? "inline-flex shrink-0" : "flex"} items-center`}>
      <NavLink
        to={`/c/${c.id}`}
        onClick={onNavigate}
        data-testid={`nav-category-${c.slug}`}
        className={({ isActive }) =>
          horizontal
            ? `flex items-center gap-2 whitespace-nowrap rounded-full pl-3 pr-2 py-1.5 text-sm transition-colors ${
                isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/60"
              }`
            : `flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/60"
              }`
        }
      >
        <span className="flex items-center gap-2 truncate">
          <Icon className="w-4 h-4 shrink-0" /> <span className="truncate max-w-[10rem]">{c.name}</span>
        </span>
        <span className="text-xs text-muted-foreground">{c.count}</span>
      </NavLink>
      {!c.is_default && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className={`text-muted-foreground hover:text-destructive transition md:opacity-0 md:group-hover:opacity-100 ${horizontal ? "px-1" : "px-2"}`}
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
}

function ProfileEntry({ user, onLogout, onNavigate, orientation, collapsed = false }) {
  const horizontal = orientation === "horizontal";

  if (collapsed) {
    return (
      <div className="mt-auto p-2 border-t border-border flex flex-col items-center gap-1">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          data-testid="nav-settings"
          title={`${user?.name || user?.email || "Profile"} · settings`}
          className={({ isActive }) =>
            `grid place-items-center w-10 h-10 rounded-lg transition-colors ${isActive ? "bg-primary/15" : "hover:bg-muted/60"}`
          }
        >
          <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground grid place-items-center font-bold uppercase" data-testid="user-name">
            {(user?.name || user?.email || "?")[0]}
          </div>
        </NavLink>
        <button onClick={onLogout} className="p-2 text-muted-foreground hover:text-destructive transition-colors" data-testid="logout-btn" title="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={horizontal ? "flex items-center gap-2 shrink-0 ml-auto pl-2" : "mt-auto p-4 border-t border-border"}>
      <div className="flex items-center gap-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          data-testid="nav-settings"
          title="Profile & settings"
          className={({ isActive }) =>
            `min-w-0 flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-lg transition-colors ${horizontal ? "" : "flex-1"} ${
              isActive ? "bg-primary/15" : "hover:bg-muted/60"
            }`
          }
        >
          <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground grid place-items-center font-bold uppercase shrink-0">
            {(user?.name || user?.email || "?")[0]}
          </div>
          <div className={`min-w-0 ${horizontal ? "hidden xl:block" : "flex-1"}`}>
            <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name || user?.email}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Settings className="w-3 h-3" /> Profile &amp; settings
            </div>
          </div>
        </NavLink>
        <button onClick={onLogout} className="text-muted-foreground hover:text-destructive shrink-0" data-testid="logout-btn" title="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SideLink({ to, icon, label, testid, onClick, compact = false, collapsed = false }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      data-testid={testid}
      end
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg text-sm transition-colors ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"} ${
          isActive ? "bg-primary/15 text-primary" : "hover:bg-muted/60"
        }`
      }
    >
      {icon} {!collapsed && <span className={compact ? "hidden lg:inline" : ""}>{label}</span>}
    </NavLink>
  );
}
