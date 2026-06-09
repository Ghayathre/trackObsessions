import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, Loader2, Search } from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";

// Map a category slug (or kind as a fallback) to the best default metadata source.
function defaultSourceFor(slug, kind) {
  const s = (slug || "").toLowerCase();
  if (s.includes("anime")) return "anime";
  if (s.includes("manga") || s.includes("manhwa") || s.includes("manhua") || s.includes("webtoon")) return "manga";
  if (s.includes("book") || s.includes("novel")) return "books";
  if (s.includes("kdrama") || s.includes("k-drama") || s.includes("thai") || s.includes("bl") ||
      s.includes("cdrama") || s.includes("drama") || s.includes("movie") || s.includes("film") ||
      s.includes("show") || s.includes("tv")) return "tv";
  // fall back on kind
  if (kind === "reading") return "manga";
  return "tv";
}

const SOURCES = [
  { value: "tv", label: "TV / Drama (TVmaze)" },
  { value: "anime", label: "Anime (MAL)" },
  { value: "manga", label: "Manga (MAL)" },
  { value: "books", label: "Books (Open Library)" },
];

export default function AddTitleDialog({ categoryId, categoryKind = "video", categorySlug = "", onAdded, triggerLabel = "Add title" }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState(defaultSourceFor(categorySlug, categoryKind));
  const [status, setStatus] = useState("watching");
  const [progress, setProgress] = useState(0);
  const [season, setSeason] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [touchedCover, setTouchedCover] = useState(false);
  const debounceRef = useRef(null);

  // reset when re-opened
  useEffect(() => {
    if (!open) {
      setTitle(""); setProgress(0); setSeason(""); setCoverUrl("");
      setResults([]); setStatus("watching"); setTouchedCover(false);
      setSource(defaultSourceFor(categorySlug, categoryKind));
    }
  }, [open, categorySlug, categoryKind]);

  // debounced auto-search whenever title or source changes
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = title.trim();
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get("/metadata/search", { params: { q, kind: source } });
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [title, source, open]);

  const pick = (r) => {
    setTitle(r.title);
    if (!touchedCover) setCoverUrl(r.cover_url || "");
  };

  const isReading = source === "manga" || source === "books";
  const progressLabel = isReading ? (source === "books" ? "Page" : "Chapter") : "Episode";

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const { data } = await api.post("/titles", {
        title: title.trim(),
        category_id: categoryId,
        status,
        progress: Number(progress) || 0,
        season: season ? Number(season) : null,
        cover_url: coverUrl,
      });
      toast.success(`Added "${data.title}"`);
      onAdded?.(data);
      setOpen(false);
    } catch {
      toast.error("Could not add title");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="open-add-title"><Plus className="w-4 h-4 mr-1" /> {triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
          <DialogDescription>Search a public catalogue and pick a match, or just type a custom title.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label htmlFor="title">Title</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Until We Meet Again, Weak Hero…" className="pl-9" data-testid="add-title-input" autoFocus />
              </div>
            </div>
            <div className="w-44">
              <Label>Search in</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger data-testid="add-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results grid */}
          <div className="min-h-[160px] border border-border rounded-lg p-2 bg-muted/30">
            {title.trim().length < 2 ? (
              <div className="text-xs text-muted-foreground text-center py-12">Type at least 2 characters to search.</div>
            ) : searching ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching {source}…
              </div>
            ) : results.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-12">
                No matches in <b>{source}</b>. Try a different source — or just type your title and hit Add.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {results.map((r, i) => (
                  <button
                    type="button"
                    key={r.external_id || i}
                    onClick={() => pick(r)}
                    data-testid={`result-${i}`}
                    className={`text-left rounded-md overflow-hidden border transition group ${
                      title.trim().toLowerCase() === (r.title || "").toLowerCase() ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/60"
                    }`}
                  >
                    {r.cover_url ? (
                      <img src={r.cover_url} alt="" className="w-full aspect-[2/3] object-cover group-hover:brightness-110" />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-card grid place-items-center text-[10px] px-1 text-center">{r.title}</div>
                    )}
                    <div className="p-1.5">
                      <div className="text-[11px] font-medium line-clamp-1">{r.title}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">
                        {[r.year, r.country].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="add-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="watching">{isReading ? "Reading" : "Watching"}</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="plan">Plan to</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{progressLabel}</Label>
              <Input type="number" value={progress} onChange={(e) => setProgress(e.target.value)} />
            </div>
            {!isReading && (
              <div>
                <Label>Season</Label>
                <Input type="number" value={season} onChange={(e) => setSeason(e.target.value)} />
              </div>
            )}
            <div className={isReading ? "col-span-2" : ""}>
              <Label>Cover URL (optional)</Label>
              <Input value={coverUrl} onChange={(e) => { setCoverUrl(e.target.value); setTouchedCover(true); }} placeholder="https://…" />
            </div>
          </div>
          <Button type="submit" className="w-full" data-testid="add-title-submit">Add to collection</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
