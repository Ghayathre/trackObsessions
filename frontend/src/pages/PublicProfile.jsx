import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { THEMES } from "../data/themes";
import { Flame, Sparkles, Clapperboard, Heart, BookOpen, Library, Hash } from "lucide-react";
import { Card } from "../components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ICONS = { Clapperboard, Heart, BookOpen, Library, Sparkles, Hash };

const STATUS_COLOR = {
  watching: "bg-primary/15 text-primary",
  completed: "bg-accent/20 text-accent-foreground",
  plan: "bg-secondary/30 text-secondary-foreground",
  on_hold: "bg-muted text-muted-foreground",
  dropped: "bg-destructive/15 text-destructive",
};

export default function PublicProfile() {
  const { username, slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [titles, setTitles] = useState([]);
  const [error, setError] = useState(null);

  // apply the user's theme on this page only
  useEffect(() => {
    const root = document.documentElement;
    const prev = [...root.classList].find((c) => c.startsWith("theme-")) || "theme-tokyo-twilight";
    return () => {
      [...root.classList].filter((c) => c.startsWith("theme-")).forEach((c) => root.classList.remove(c));
      root.classList.add(prev);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/public/u/${username}`);
        if (!mounted) return;
        setProfile(data);
        if (data.user.theme) {
          const root = document.documentElement;
          [...root.classList].filter((c) => c.startsWith("theme-")).forEach((c) => root.classList.remove(c));
          root.classList.add(`theme-${data.user.theme}`);
        }
        // Prefer URL slug, else first category
        if (slug) {
          const m = data.categories.find((c) => c.slug === slug);
          setActiveCat(m ? m.id : (data.categories[0]?.id || null));
        } else if (data.categories.length) {
          setActiveCat(data.categories[0].id);
        }
      } catch (e) {
        setError(e.response?.status === 404 ? "This profile is private or doesn't exist." : "Could not load profile.");
      }
    })();
    return () => { mounted = false; };
  }, [username, slug]);

  useEffect(() => {
    if (!activeCat || !profile) return;
    (async () => {
      const { data } = await axios.get(`${API}/public/u/${username}/titles`, { params: { category_id: activeCat } });
      setTitles(data);
    })();
  }, [activeCat, profile, username]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-8">
        <div className="text-center max-w-md">
          <div className="font-display font-black text-3xl mb-2">404</div>
          <p className="text-muted-foreground">{error}</p>
          <Link to="/" className="text-primary underline text-sm mt-4 inline-block">Go home</Link>
        </div>
      </div>
    );
  }

  if (!profile) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <Link to="/" className="flex items-center gap-2 mb-12 w-fit">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center hanabi-glow"><Flame className="w-4 h-4" /></div>
          <span className="font-display font-black text-lg">Hanabi</span>
        </Link>

        <header className="space-y-3 fade-up">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Public library</div>
          <h1 className="text-5xl sm:text-6xl font-display font-black tracking-tight">{profile.user.name || profile.user.username}</h1>
          <p className="text-muted-foreground">
            @{profile.user.username} · {profile.total} title{profile.total !== 1 ? "s" : ""} across {profile.categories.length} collection{profile.categories.length !== 1 ? "s" : ""}
          </p>
        </header>

        <nav className="mt-10 flex flex-wrap gap-2" data-testid="public-categories">
          {profile.categories.map((c) => {
            const Icon = ICONS[c.icon] || Sparkles;
            const active = c.id === activeCat;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                data-testid={`public-cat-${c.slug}`}
                className={`text-sm px-4 py-2 rounded-full border transition flex items-center gap-2 ${
                  active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {c.name} <span className="opacity-60 text-xs">{c.count}</span>
              </button>
            );
          })}
        </nav>

        <section className="mt-10">
          {titles.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="font-display font-bold text-xl">Nothing here yet</div>
              <p className="text-sm text-muted-foreground mt-1">This collection is still warming up.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {titles.map((t) => (
                <div key={t.id} className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-border bg-card fade-up" data-testid={`public-title-${t.id}`}>
                  {t.cover_url ? (
                    <img src={t.cover_url} alt={t.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center p-3 text-center font-display font-bold">{t.title}</div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || "bg-muted/80"}`}>
                      {t.status?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/85 via-black/55 to-transparent text-white">
                    <div className="font-display font-bold leading-tight line-clamp-2 text-sm">{t.title}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {t.progress ? `Ep ${t.progress}${t.total ? `/${t.total}` : ""}` : "—"}{t.season ? ` · S${t.season}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-20 text-center text-xs text-muted-foreground">
          Tracking with <Link to="/" className="text-primary underline">Hanabi</Link>
        </footer>
      </div>
    </div>
  );
}
