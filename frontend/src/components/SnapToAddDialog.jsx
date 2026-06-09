import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Camera, Loader2, Sparkles, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import { detectImage, createTitle } from "../lib/db";
import { toast } from "sonner";

const TYPE_TO_SLUG = {
  anime: "anime", manga: "manga", book: "books",
  kdrama: "kdramas", "thai-bl": "thai-bl", tv: "kdramas",
};

export default function SnapToAddDialog({ categories = [], onAdded }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!open) {
      setFile(null); setPreviewUrl(""); setResult(null); setDetecting(false); setCategoryId("");
    }
  }, [open]);

  // when result arrives, pick a sensible default category
  useEffect(() => {
    if (!result || categories.length === 0) return;
    const wanted = TYPE_TO_SLUG[result.type];
    const match = wanted ? categories.find((c) => c.slug === wanted) : null;
    setCategoryId(match?.id || categories[0]?.id || "");
  }, [result, categories]);

  const handleFile = async (f) => {
    if (!f) return;
    if (!/^image\/(jpe?g|png|webp)$/i.test(f.type)) {
      toast.error("Use a JPG, PNG or WEBP image");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image is too big (max 5MB)");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setDetecting(true);
    try {
      const data = await detectImage(f);
      if (data?.error === "not_implemented") {
        toast.error(data.detail || "Image detection is unavailable right now");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (err) {
      toast.error(err.message || "Could not analyse image");
      setResult(null);
    } finally {
      setDetecting(false);
    }
  };

  const confirmAdd = async () => {
    if (!result || !categoryId) return;
    try {
      const data = await createTitle({
        title: result.title,
        category_id: categoryId,
        status: "watching",
        cover_url: result.cover_url || "",
        external_id: result.external_id || null,
        external_source: result.external_source || null,
        synopsis: result.synopsis || "",
        year: result.year || "",
        country: result.country || "",
        total: result.total || null,
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
        <Button variant="outline" size="sm" data-testid="open-snap-add">
          <Camera className="w-3.5 h-3.5 mr-1" /> Snap to add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="snap-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Snap to add</DialogTitle>
          <DialogDescription>
            Take a photo of what you're watching/reading (or upload a screenshot). Hanabi will identify it and confirm with you before adding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
            data-testid="snap-file-input"
          />

          {!previewUrl ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl px-6 py-12 text-center hover:border-primary hover:bg-muted/40 transition group"
              data-testid="snap-pick-file"
            >
              <Upload className="w-6 h-6 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="mt-3 font-medium">Take a photo or upload an image</div>
              <div className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP — under 5MB</div>
            </button>
          ) : (
            <div className="flex gap-4">
              <img src={previewUrl} alt="" className="w-32 aspect-[3/4] object-cover rounded-lg border border-border" />
              <div className="flex-1 min-w-0">
                {detecting ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Identifying…
                  </div>
                ) : result ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
                      {result.confident ? (
                        <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="w-3.5 h-3.5" /> Confident match</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-3.5 h-3.5" /> Best guess</span>
                      )}
                      <span className="text-muted-foreground">· {result.type}</span>
                    </div>
                    <div className="font-display font-bold text-lg leading-tight" data-testid="snap-detected-title">{result.title || "Unknown"}</div>
                    {result.year || result.country ? (
                      <div className="text-xs text-muted-foreground">{[result.year, result.country].filter(Boolean).join(" · ")}</div>
                    ) : null}
                    {result.characters?.length ? (
                      <div className="text-xs text-muted-foreground">Saw: {result.characters.slice(0, 3).join(", ")}</div>
                    ) : null}
                    {result.synopsis ? (
                      <p className="text-xs text-muted-foreground line-clamp-3">{result.synopsis}</p>
                    ) : null}
                  </div>
                ) : (
                  <button onClick={() => inputRef.current?.click()} className="text-xs text-primary underline">Try a different image</button>
                )}
              </div>
            </div>
          )}

          {result && result.title && (
            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Add to</div>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger data-testid="snap-category-select"><SelectValue placeholder="Choose a collection" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} data-testid="snap-retry">
                  Try a different image
                </Button>
                <Button className="flex-1" onClick={confirmAdd} disabled={!categoryId} data-testid="snap-confirm-add">
                  Yes, add it
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
