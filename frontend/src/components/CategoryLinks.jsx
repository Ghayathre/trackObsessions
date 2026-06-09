import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Link2, X, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function hostFromUrl(u) {
  try { return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, ""); }
  catch { return u; }
}

export default function CategoryLinks({ categoryId }) {
  const [links, setLinks] = useState([]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!categoryId) return;
    try {
      const { data } = await api.get(`/categories/${categoryId}/links`);
      setLinks(data);
    } catch {}
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [categoryId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    try {
      const { data } = await api.post(`/categories/${categoryId}/links`, { url: url.trim(), label: label.trim() });
      setLinks((cur) => [...cur, data]);
      setUrl(""); setLabel("");
      toast.success("Site saved");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not save link");
    } finally { setAdding(false); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/categories/${categoryId}/links/${id}`);
      setLinks((cur) => cur.filter((l) => l.id !== id));
    } catch { toast.error("Could not remove"); }
  };

  return (
    <Card className="p-5" data-testid="category-links-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" /> Sites for this collection
        </h2>
        <span className="text-xs text-muted-foreground">{links.length}</span>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sites yet — drop in your favourite streamers, scanlation sites, bookstores, whatever you use most.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 group" data-testid={`category-link-${l.id}`}>
              <img
                src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(hostFromUrl(l.url))}`}
                alt=""
                referrerPolicy="no-referrer"
                className="w-4 h-4 rounded-sm shrink-0"
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
              />
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm hover:text-primary transition-colors"
              >
                {l.label}
                <span className="text-muted-foreground text-xs ml-2">{hostFromUrl(l.url)}</span>
              </a>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>
              <button
                onClick={() => remove(l.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                title="Remove"
                data-testid={`category-link-remove-${l.id}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-col sm:flex-row gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="sm:max-w-[180px]"
          data-testid="category-link-label"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://crunchyroll.com"
          className="flex-1"
          data-testid="category-link-url"
        />
        <Button type="submit" disabled={adding || !url.trim()} data-testid="category-link-add">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add site
        </Button>
      </form>
    </Card>
  );
}
