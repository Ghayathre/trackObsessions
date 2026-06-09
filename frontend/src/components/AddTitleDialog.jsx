import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, Search } from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";

export default function AddTitleDialog({ categoryId, categoryKind = "video", onAdded, triggerLabel = "Add title" }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("watching");
  const [progress, setProgress] = useState(0);
  const [season, setSeason] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const lookup = async () => {
    if (!title.trim()) return;
    setSearching(true);
    try {
      const kind = categoryKind === "reading" ? "manga" : "anime";
      const { data } = await api.get("/metadata/search", { params: { q: title, kind } });
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // also try books lookup as a fallback for reading kind
  useEffect(() => {
    if (!open) {
      setTitle(""); setProgress(0); setSeason(""); setCoverUrl(""); setResults([]); setStatus("watching");
    }
  }, [open]);

  const pick = (r) => {
    setTitle(r.title);
    setCoverUrl(r.cover_url || "");
  };

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
      toast.success(`Added "${title}"`);
      onAdded?.(data);
      setOpen(false);
    } catch (err) {
      toast.error("Could not add title");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="open-add-title"><Plus className="w-4 h-4 mr-1" /> {triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add to collection</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <div className="flex gap-2">
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weak Hero, Solo Leveling…" data-testid="add-title-input" />
              <Button type="button" variant="outline" onClick={lookup} disabled={searching} data-testid="lookup-btn">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1 border border-border rounded-lg">
              {results.map((r, i) => (
                <button type="button" key={i} onClick={() => pick(r)} className="text-left group" data-testid={`result-${i}`}>
                  {r.cover_url ? (
                    <img src={r.cover_url} alt="" className="w-full aspect-[2/3] object-cover rounded-md group-hover:ring-2 ring-primary" />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-muted rounded-md grid place-items-center text-xs p-1">{r.title}</div>
                  )}
                  <div className="text-[11px] mt-1 line-clamp-1">{r.title}</div>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="add-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="watching">{categoryKind === "reading" ? "Reading" : "Watching"}</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="plan">Plan to</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{categoryKind === "reading" ? "Chapter" : "Episode"}</Label>
              <Input type="number" value={progress} onChange={(e) => setProgress(e.target.value)} />
            </div>
            {categoryKind === "video" && (
              <div>
                <Label>Season</Label>
                <Input type="number" value={season} onChange={(e) => setSeason(e.target.value)} />
              </div>
            )}
            <div className={categoryKind === "video" ? "" : "col-span-2"}>
              <Label>Cover URL (optional)</Label>
              <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <Button type="submit" className="w-full" data-testid="add-title-submit">Add to collection</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
