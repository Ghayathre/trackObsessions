import { useState } from "react";
import { Card } from "./ui/card";
import { Star, Plus, Minus, Trash2 } from "lucide-react";
import api from "../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
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
      <Card
        onClick={() => { setDraft(item); setOpen(true); }}
        className="group relative overflow-hidden cursor-pointer border-border bg-card aspect-[2/3] hover:scale-[1.03] transition-transform duration-300 fade-up"
        data-testid={`media-card-${item.id}`}
      >
        {item.cover_url ? (
          <img src={item.cover_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-all group-hover:brightness-110" />
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{item.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
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
            <div>
              <Label>Cover URL</Label>
              <Input value={draft.cover_url || ""} onChange={(e) => setDraft({ ...draft, cover_url: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
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
