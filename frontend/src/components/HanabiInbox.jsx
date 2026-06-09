import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import api from "../lib/api";
import { Check, X, Tv, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";

export default function HanabiInbox({ open, onOpenChange, categories }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [overrideCat, setOverrideCat] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/suggestions", { params: { status: "pending" } });
      setItems(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const act = async (id, action) => {
    try {
      const payload = { action };
      if (action === "accept" && overrideCat[id]) payload.category_id = overrideCat[id];
      await api.post(`/suggestions/${id}/act`, payload);
      setItems((cur) => cur.filter((s) => s.id !== id));
      toast.success(action === "accept" ? "Added to your list" : "Suggestion dismissed");
    } catch {
      toast.error("Action failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md" data-testid="hanabi-inbox-panel">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Hanabi Inbox
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="text-center py-10 px-4 border border-dashed border-border rounded-xl">
              <Tv className="w-6 h-6 mx-auto text-muted-foreground" />
              <div className="mt-3 font-medium">Nothing detected yet</div>
              <p className="text-xs text-muted-foreground mt-1">
                When your Hanabi extension spots something you're watching or reading, it'll pop up here.
              </p>
            </div>
          )}
          {items.map((s) => (
            <div key={s.id} className="border border-border rounded-xl p-4 bg-card hanabi-glow fade-up" data-testid={`suggestion-${s.id}`}>
              <div className="flex gap-3">
                {s.cover_url ? (
                  <img src={s.cover_url} alt="" className="w-14 h-20 rounded-md object-cover" />
                ) : (
                  <div className="w-14 h-20 rounded-md bg-muted grid place-items-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.season ? `S${s.season} · ` : ""}{s.episode ? `Ep ${s.episode}` : "Detected"} · {s.category_hint || "unknown"}
                  </div>
                  <div className="mt-3">
                    <Select value={overrideCat[s.id] || ""} onValueChange={(v) => setOverrideCat({ ...overrideCat, [s.id]: v })}>
                      <SelectTrigger className="h-8 text-xs" data-testid={`suggestion-cat-${s.id}`}>
                        <SelectValue placeholder="Choose a collection" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="flex-1" onClick={() => act(s.id, "accept")} data-testid={`suggestion-accept-${s.id}`}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => act(s.id, "reject")} data-testid={`suggestion-reject-${s.id}`}>
                  <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
