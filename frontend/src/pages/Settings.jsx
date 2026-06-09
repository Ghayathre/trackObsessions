import { useEffect, useState } from "react";
import api from "../lib/api";
import ThemePicker from "../components/ThemePicker";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Copy, Trash2, KeyRound, ShieldAlert, User, Share2, ExternalLink, Sparkles, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import ImportAniListDialog from "../components/ImportAniListDialog";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [keys, setKeys] = useState([]);
  const [label, setLabel] = useState("Hanabi extension");
  const [revealed, setRevealed] = useState(null);
  const [profileDraft, setProfileDraft] = useState({ name: "", username: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const load = async () => {
    const { data } = await api.get("/api-keys");
    setKeys(data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (user) setProfileDraft({ name: user.name || "", username: user.username || "" });
  }, [user]);

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

  const updateSettings = async (patch, successMsg) => {
    try {
      await api.patch("/auth/settings", patch);
      await refresh();
      if (successMsg) toast.success(successMsg);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not save");
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    await updateSettings({ name: profileDraft.name, username: profileDraft.username }, "Profile saved");
    setSavingProfile(false);
  };

  const apiBase = `${process.env.REACT_APP_BACKEND_URL}/api`;
  const publicUrl = user?.username ? `${window.location.origin}/u/${user.username}` : "";

  return (
    <div className="space-y-12">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account</div>
        <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Signed in as {user?.email}</p>
      </header>

      {/* Profile */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3 flex items-center gap-2"><User className="w-5 h-5" /> Profile</h2>
        <Card className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="display-name">Display name</Label>
              <Input id="display-name" value={profileDraft.name} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} data-testid="settings-name" />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={profileDraft.username} onChange={(e) => setProfileDraft({ ...profileDraft, username: e.target.value })} data-testid="settings-username" />
              <div className="text-[11px] text-muted-foreground mt-1">Used in your public link.</div>
            </div>
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} data-testid="save-profile">Save profile</Button>
        </Card>
      </section>

      {/* Sharing */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3 flex items-center gap-2"><Share2 className="w-5 h-5" /> Share your library</h2>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium">Public profile</div>
              <p className="text-sm text-muted-foreground mt-1">
                When ON, anyone with the link can see your collections (notes stay private).
              </p>
            </div>
            <Switch
              checked={!!user?.profile_public}
              onCheckedChange={(v) => updateSettings({ profile_public: v }, v ? "Profile is now public" : "Profile is now private")}
              data-testid="toggle-public"
            />
          </div>
          {user?.profile_public && (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your public link</div>
              <div className="flex items-center gap-2">
                <code className="text-xs sm:text-sm bg-muted px-3 py-2 rounded-md flex-1 overflow-x-auto whitespace-nowrap" data-testid="public-link">{publicUrl}</code>
                <Button variant="outline" size="sm" onClick={() => copy(publicUrl)} data-testid="copy-public-link"><Copy className="w-3.5 h-3.5" /></Button>
                <Link to={`/u/${user.username}`} target="_blank">
                  <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5" /></Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Auto-accept */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5" /> Hanabi auto-pilot</h2>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium">Auto-accept extension scans</div>
              <p className="text-sm text-muted-foreground mt-1">
                When ON and the extension confidently classifies a title (e.g. anime, k-drama), Hanabi adds it straight to your collection instead of asking. You'll still see it in the inbox as "auto-accepted".
              </p>
            </div>
            <Switch
              checked={!!user?.auto_accept}
              onCheckedChange={(v) => updateSettings({ auto_accept: v }, v ? "Auto-pilot is on" : "Auto-pilot is off")}
              data-testid="toggle-autoaccept"
            />
          </div>
        </Card>
      </section>

      {/* Themes */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3">Themes</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">Pick a vibe. Your choice syncs across devices.</p>
        <ThemePicker />
      </section>

      {/* Imports */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3 flex items-center gap-2"><Download className="w-5 h-5" /> Imports</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
          Already tracking somewhere else? Bring your list over.
        </p>
        <Card className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-medium">AniList</div>
            <p className="text-sm text-muted-foreground mt-1">Import a public AniList user's anime or manga list. Dedupes on AniList ID, so you can re-run safely.</p>
          </div>
          <ImportAniListDialog />
        </Card>
      </section>

      {/* API keys */}
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
