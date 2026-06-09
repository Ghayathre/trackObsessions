import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Star, Plus, Minus, Trash2, RefreshCw, Globe, Calendar, Hash } from "lucide-react";
import { motion } from "framer-motion";
import api from "../lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

const STATUSES = [
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "plan", label: "Plan to" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
];

const STATUS_COLOR = {
  watching: "bg-primary/15 text-primary",
  completed: "bg-accent/20 text-accent-foreground",
  plan: "bg-secondary/30 text-secondary-foreground",
  on_hold: "bg-muted text-muted-foreground",
  dropped: "bg-destructive/15 text-destructive",
};

export default function MediaCard({ item, onChange, kind = "video" }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item);
  const [coverFailed, setCoverFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // reset cover failure when item changes
  useEffect(() => { setCoverFailed(false); }, [item.cover_url]);

  const refreshDetails = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.post(`/titles/${item.id}/refresh`);
      onChange?.(data);
      setDraft(data);
      toast.success("Details refreshed");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not refresh");
    } finally {
      setRefreshing(false);
    }
  };

  const inc = async (delta) => {
    const next = Math.max(0, (item.progress || 0) + delta);
    const { data } = await api.patch(`/titles/${item.id}`, { progress: next });
    onChange?.(data);
  };

  const save = async () => {
    const payload = {
      title: draft.title,
      status: draft.status,
      progress: Number(draft.progress) || 0,
      total: draft.total ? Number(draft.total) : null,
      rating: draft.rating ? Number(draft.rating) : null,
      notes: draft.notes,
      cover_url: draft.cover_url,
    };
    const { data } = await api.patch(`/titles/${item.id}`, payload);
    onChange?.(data);
    setOpen(false);
    toast.success("Updated");
  };

  const remove = async () => {
    if (!confirm(`Remove "${item.title}"?`)) return;
    await api.delete(`/titles/${item.id}`);
    onChange?.(null, item.id);
    setOpen(false);
    toast.success("Removed");
  };

  const progressLabel = kind === "reading" ? "Ch" : "Ep";

  return (
    <>
      <motion.div
        whileHover={{ y: -6, scale: 1.035 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
      >
        <Card
          onClick={() => { setDraft(item); setOpen(true); }}
          className="group relative overflow-hidden cursor-pointer border-border bg-card aspect-[2/3] fade-up"
          data-testid={`media-card-${item.id}`}
        >
        {item.cover_url && !coverFailed ? (
          <img
            src={item.cover_url}
            alt={item.title}
            referrerPolicy="no-referrer"
            onError={() => setCoverFailed(true)}
            className="absolute inset-0 w-full h-full object-cover transition-all group-hover:brightness-110"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-card grid place-items-center p-4 text-center">
            <span className="font-display font-bold text-lg leading-tight">{item.title}</span>
          </div>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur ${STATUS_COLOR[item.status] || "bg-muted/80"}`}>
            {item.status?.replace("_", " ")}
          </span>
          {item.rating != null && (
            <span className="text-[11px] flex items-center gap-1 bg-black/55 text-white px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" /> {item.rating}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3 pt-12 bg-gradient-to-t from-black/85 via-black/55 to-transparent text-white">
          <div className="font-display font-bold leading-tight line-clamp-2">{item.title}</div>
          <div className="text-xs opacity-80 mt-1 flex items-center justify-between">
            <span>{progressLabel} {item.progress || 0}{item.total ? ` / ${item.total}` : ""}{item.season ? ` · S${item.season}` : ""}</span>
            <span className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); inc(-1); }} className="rounded-full bg-white/15 hover:bg-white/25 p-1" data-testid={`dec-${item.id}`}><Minus className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); inc(1); }} className="rounded-full bg-primary text-primary-foreground p-1" data-testid={`inc-${item.id}`}><Plus className="w-3 h-3" /></button>
            </span>
          </div>
        </div>
      </Card>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid={`detail-dialog-${item.id}`}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-black tracking-tight">{item.title}</DialogTitle>
            {(item.year || item.country) && (
              <DialogDescription className="flex flex-wrap items-center gap-3 text-xs">
                {item.year && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {item.year}</span>}
                {item.country && <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {item.country}</span>}
                {item.external_source && <span className="flex items-center gap-1 opacity-70"><Hash className="w-3 h-3" /> {item.external_source}</span>}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="grid grid-cols-[120px_1fr] gap-5">
            {/* poster */}
            <div className="space-y-2">
              {item.cover_url && !coverFailed ? (
                <img
                  src={item.cover_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setCoverFailed(true)}
                  className="w-full aspect-[2/3] object-cover rounded-lg border border-border"
                />
              ) : (
                <div className="w-full aspect-[2/3] rounded-lg bg-muted grid place-items-center text-xs p-2 text-center border border-border">{item.title}</div>
              )}
              {item.external_id && item.external_source && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={refreshDetails}
                  disabled={refreshing}
                  data-testid={`refresh-${item.id}`}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing…" : "Refresh details"}
                </Button>
              )}
            </div>

            {/* info + synopsis */}
            <div className="min-w-0 space-y-3">
              {item.synopsis && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">About</div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.synopsis}</p>
                </div>
              )}
              {!item.synopsis && item.external_id && (
                <p className="text-xs text-muted-foreground italic">No synopsis stored yet. Click "Refresh details" to fetch it.</p>
              )}
              {!item.external_id && !item.synopsis && (
                <p className="text-xs text-muted-foreground italic">This title was added manually. Re-add via search to pull in synopsis & episode count.</p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Your progress</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger data-testid={`edit-status-${item.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rating (0-10)</Label>
                <Input type="number" step="0.1" min="0" max="10" value={draft.rating ?? ""} onChange={(e) => setDraft({ ...draft, rating: e.target.value })} />
              </div>
              <div>
                <Label>{progressLabel}</Label>
                <Input type="number" value={draft.progress ?? 0} onChange={(e) => setDraft({ ...draft, progress: e.target.value })} data-testid={`edit-progress-${item.id}`} />
              </div>
              <div>
                <Label>Total</Label>
                <Input type="number" value={draft.total ?? ""} onChange={(e) => setDraft({ ...draft, total: e.target.value })} />
              </div>
            </div>
            <div className="mt-3">
              <Label>Cover URL</Label>
              <Input value={draft.cover_url || ""} onChange={(e) => setDraft({ ...draft, cover_url: e.target.value })} />
            </div>
            <div className="mt-3">
              <Label>Notes (private)</Label>
              <Textarea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" onClick={remove} data-testid={`delete-title-${item.id}`}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
            <Button className="ml-auto" onClick={save} data-testid={`save-title-${item.id}`}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
