import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import MediaCard from "../components/MediaCard";
import AddTitleDialog from "../components/AddTitleDialog";
import { Input } from "../components/ui/input";
import { Search } from "lucide-react";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "watching", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "plan", label: "Plan to" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
];

export default function Category() {
  const { id } = useParams();
  const [cat, setCat] = useState(null);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    const params = {};
    params.category_id = id;
    if (filter !== "all") params.status = filter;
    if (q) params.q = q;
    const [{ data: titles }, { data: cats }] = await Promise.all([
      api.get("/titles", { params }),
      api.get("/categories"),
    ]);
    setItems(titles);
    setCat(cats.find((c) => c.id === id));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, filter]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const kind = cat?.kind === "reading" ? "reading" : "video";
  const onChange = (updated, deletedId) => {
    if (deletedId) setItems((cur) => cur.filter((i) => i.id !== deletedId));
    else if (updated) setItems((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
    else load();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Collection</div>
          <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">{cat?.name || "…"}</h1>
          <p className="text-muted-foreground mt-1">{items.length} title{items.length !== 1 ? "s" : ""}</p>
        </div>
        {cat && <AddTitleDialog categoryId={cat.id} categoryKind={kind} onAdded={() => load()} />}
      </header>

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              data-testid={`filter-${f.value}`}
              className={`text-xs uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
                filter === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search in this collection…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="category-search" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <div className="font-display font-bold text-2xl">No titles yet</div>
          <p className="text-sm text-muted-foreground mt-1">Tap “Add title” above to start tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((t) => (
            <MediaCard key={t.id} item={t} kind={kind} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}
