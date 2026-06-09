import { useEffect, useState } from "react";
import api from "../lib/api";
import ThemePicker from "../components/ThemePicker";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Copy, Trash2, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [label, setLabel] = useState("Hanabi extension");
  const [revealed, setRevealed] = useState(null); // freshly-created key shown once

  const load = async () => {
    const { data } = await api.get("/api-keys");
    setKeys(data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data } = await api.post("/api-keys", { label });
    setRevealed(data);
    toast.success("Key created — copy it now");
    await load();
  };

  const revoke = async (id) => {
    if (!confirm("Revoke this API key? The extension using it will lose access.")) return;
    await api.delete(`/api-keys/${id}`);
    await load();
    toast.success("Key revoked");
  };

  const copy = (v) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  const apiBase = `${process.env.REACT_APP_BACKEND_URL}/api`;

  return (
    <div className="space-y-12">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account</div>
        <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Signed in as {user?.email}</p>
      </header>

      <section>
        <h2 className="font-display font-bold text-2xl mb-3">Themes</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">Pick a vibe. Your choice syncs across devices. All shadcn surfaces re-skin instantly.</p>
        <ThemePicker />
      </section>

      <section>
        <h2 className="font-display font-bold text-2xl mb-3 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Hanabi extension keys</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
          Generate an API key and paste it into your Hanabi browser extension. The extension uses it to push detected titles to your inbox.
        </p>

        <Card className="p-5 mb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Endpoint for your extension</div>
          <div className="flex items-center gap-2">
            <code className="text-xs sm:text-sm bg-muted px-3 py-2 rounded-md flex-1 overflow-x-auto whitespace-nowrap" data-testid="extension-endpoint">
              POST {apiBase}/extension/scan  ·  header: X-API-Key
            </code>
            <Button variant="outline" size="sm" onClick={() => copy(`${apiBase}/extension/scan`)}><Copy className="w-3 h-3" /></Button>
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Body: <code className="bg-muted px-1.5 py-0.5 rounded">{`{ title, category_hint?, season?, episode?, cover_url?, source_url? }`}</code>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1">
            <Label htmlFor="key-label">Key label</Label>
            <Input id="key-label" value={label} onChange={(e) => setLabel(e.target.value)} data-testid="apikey-label" />
          </div>
          <Button onClick={create} className="sm:self-end" data-testid="create-apikey">Generate key</Button>
        </div>

        {revealed && (
          <Card className="p-4 mb-4 border-primary/40 hanabi-glow">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-2">
              <ShieldAlert className="w-3.5 h-3.5" /> Copy this now — it won't be shown again
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-3 py-2 rounded-md flex-1 break-all" data-testid="revealed-key">{revealed.key}</code>
              <Button size="sm" onClick={() => copy(revealed.key)} data-testid="copy-revealed-key"><Copy className="w-3.5 h-3.5" /></Button>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {keys.length === 0 && <div className="text-sm text-muted-foreground">No keys yet.</div>}
          {keys.map((k) => (
            <Card key={k.id} className={`p-4 flex items-center justify-between gap-3 ${k.revoked ? "opacity-60" : ""}`} data-testid={`apikey-row-${k.id}`}>
              <div className="min-w-0">
                <div className="font-medium truncate">{k.label} {k.revoked && <span className="text-xs text-destructive ml-2">revoked</span>}</div>
                <div className="text-xs text-muted-foreground">{k.prefix}… · created {new Date(k.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</div>
              </div>
              {!k.revoked && (
                <Button size="sm" variant="outline" onClick={() => revoke(k.id)} data-testid={`revoke-apikey-${k.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
