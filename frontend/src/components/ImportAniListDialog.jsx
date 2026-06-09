import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Download } from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";

export default function ImportAniListDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [type, setType] = useState("ANIME");
  const [cats, setCats] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/categories").then(({ data }) => {
      setCats(data);
      const preferred = data.find((c) => c.slug === (type === "ANIME" ? "anime" : "manga"));
      setCategoryId(preferred?.id || data[0]?.id || "");
    });
  }, [open, type]);

  const run = async (e) => {
    e.preventDefault();
    if (!username.trim() || !categoryId) {
      toast.error("Username and target collection are required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/import/anilist", {
        username: username.trim(),
        type,
        category_id: categoryId,
      });
      toast.success(`Imported ${data.imported} title${data.imported === 1 ? "" : "s"}${data.skipped ? `, skipped ${data.skipped}` : ""}`);
      setOpen(false);
      setUsername("");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="open-anilist-import">
          <Download className="w-3.5 h-3.5 mr-1" /> Import from AniList
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from AniList</DialogTitle>
          <DialogDescription>
            Paste your AniList username and pick the collection to import into. Your list must be public on AniList.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={run} className="space-y-3">
          <div>
            <Label htmlFor="al-user">AniList username</Label>
            <Input id="al-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. yumi" data-testid="anilist-username" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="anilist-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANIME">Anime</SelectItem>
                  <SelectItem value="MANGA">Manga</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Into collection</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger data-testid="anilist-category"><SelectValue placeholder="Pick…" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full" data-testid="anilist-import-submit">
            {loading ? "Importing…" : "Import"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
