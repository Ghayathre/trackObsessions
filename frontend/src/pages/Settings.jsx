import { useEffect, useState } from "react";
import { listApiKeys, createApiKey, revokeApiKey, updateProfile } from "../lib/db";
import ThemePicker from "../components/ThemePicker";
import StylePicker from "../components/StylePicker";
import MotionPicker from "../components/MotionPicker";
import CompanionPicker from "../components/CompanionPicker";
import CreatureControls from "../components/CreatureControls";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
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
    try { setKeys(await listApiKeys()); } catch {}
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (user) setProfileDraft({ name: user.name || "", username: user.username || "" });
  }, [user]);

  const create = async () => {
    const data = await createApiKey(label);
    setRevealed(data);
    toast.success("Key created — copy it now");
    await load();
  };

  const revoke = async (id) => {
    await revokeApiKey(id);
    await load();
    toast.success("Key revoked");
  };

  const copy = (v) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  const updateSettings = async (patch, successMsg) => {
    try {
      await updateProfile(patch);
      await refresh();
      if (successMsg) toast.success(successMsg);
    } catch (err) {
      toast.error(err.message || "Could not save");
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    await updateSettings({ name: profileDraft.name, username: profileDraft.username }, "Profile saved");
    setSavingProfile(false);
  };

  const scanEndpoint = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/extension`;
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
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">Pick a vibe. Themes control colour.</p>
        <ThemePicker />
      </section>

      {/* Styles */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3">Styles</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
          Styles control the whole <i>vibe</i> — fonts, radius, textures <b>and</b> colour palette. Pick <b>Hanabi Default</b> if you want the Theme picker above to drive colour; pick any other style for a curated complete look.
        </p>
        <StylePicker />
      </section>

      {/* Motion */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3">Motion</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
          Controls how Hanabi <i>moves</i> — entrances, hovers, page transitions and the ambient
          background. Pick <b>Antigravity</b> for a weightless, floating feel, <b>Calm</b> for something
          smooth and understated, or <b>Minimal</b> to keep things quiet. (If your device asks for
          reduced motion, we honour that automatically.)
        </p>
        <MotionPicker />
      </section>

      {/* Companions */}
      <section>
        <h2 className="font-display font-bold text-2xl mb-3">Companions</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
          The little creatures that live on your page. <b>Soot sprites</b> roam, march along
          the border and carry star-candy; <b>Fireflies</b> drift and glow; or pick <b>None</b>
          for a quiet page. (They follow your Motion preset — hidden under Minimal / reduced motion.)
        </p>
        <CompanionPicker />
        <CreatureControls />
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
              POST {scanEndpoint}  ·  header: X-API-Key
            </code>
            <Button variant="outline" size="sm" onClick={() => copy(scanEndpoint)}><Copy className="w-3 h-3" /></Button>
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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid={`revoke-apikey-${k.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke "{k.label}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The extension using this key will stop being able to push scans.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revoke(k.id)} data-testid={`confirm-revoke-${k.id}`}>
                        Revoke
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
