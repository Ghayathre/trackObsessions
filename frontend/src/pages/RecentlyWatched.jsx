import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listRecentlyWatched, listCategories } from "../lib/db";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Play, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, useStagger } from "../lib/motion";

// Friendly name for the player a title was tracked from, derived from its URL.
function platformFromUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const map = [
    [/netflix\./, "Netflix"],
    [/crunchyroll\./, "Crunchyroll"],
    [/(hianime|aniwatch)\./, "HiAnime"],
    [/mangadex\./, "MangaDex"],
    [/mangago\./, "Mangago"],
    [/webtoons\./, "Webtoons"],
    [/dramacool/, "DramaCool"],
    [/kisskh\./, "KissKH"],
    [/goodreads\./, "Goodreads"],
  ];
  for (const [re, name] of map) if (re.test(host)) return name;
  return host;
}

function ResumeCard({ item, progressLabel }) {
  const navigate = useNavigate();
  const [coverFailed, setCoverFailed] = useState(false);
  const platform = item.source_url ? platformFromUrl(item.source_url) : null;
  const canResume = !!item.source_url;

  const open = () => {
    // Tracked from a player → continue there; otherwise fall back to its collection.
    if (canResume) window.open(item.source_url, "_blank", "noopener,noreferrer");
    else navigate(`/c/${item.category_id}`);
  };

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
      <Card
        onClick={open}
        className="group relative overflow-hidden cursor-pointer border-border bg-card aspect-[2/3]"
        data-testid={`resume-card-${item.id}`}
        title={canResume ? `Resume on ${platform}` : "Open collection"}
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

        {platform && (
          <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/55 text-white backdrop-blur">
            {platform}
          </span>
        )}

        {canResume && (
          <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="rounded-full bg-primary text-primary-foreground p-3 shadow-lg">
              <Play className="w-6 h-6 fill-current" />
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3 pt-12 bg-gradient-to-t from-black/85 via-black/55 to-transparent text-white">
          <div className="font-display font-bold leading-tight line-clamp-2">{item.title}</div>
          <div className="text-xs opacity-80 mt-1 flex items-center justify-between">
            <span>
              {progressLabel} {item.progress || 0}
              {item.total ? ` / ${item.total}` : ""}
              {item.season ? ` · S${item.season}` : ""}
            </span>
            {canResume && <ExternalLink className="w-3.5 h-3.5 opacity-80" />}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function RecentlyWatched() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [kindById, setKindById] = useState({});
  const { container: staggerContainer, item: staggerItem } = useStagger();

  const load = async () => {
    const [titles, cats] = await Promise.all([listRecentlyWatched(60), listCategories()]);
    setItems(titles);
    setKindById(Object.fromEntries(cats.map((c) => [c.id, c.kind])));
  };
  useEffect(() => {
    load();
  }, []);

  // Live-sync: titles advance server-side as you watch, so re-pull (debounced) when
  // anything changes to keep recency order correct. RLS scopes events to this user.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!user?.id) return undefined;
    let timer;
    const channel = supabase
      .channel("recent:titles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "titles", filter: `user_id=eq.${user.id}` },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => loadRef.current(), 400);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pick up where you left off</div>
        <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">Recently watched</h1>
        <p className="text-muted-foreground mt-1">
          Your latest titles across every collection. Click one tracked from a player to jump straight back in.
        </p>
      </header>

      {items === null ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <div className="font-display font-bold text-lg">Nothing watched yet</div>
          <p className="text-sm text-muted-foreground mt-1">
            Watch something with the Hanabi extension on and it’ll show up here, ready to resume.
          </p>
        </div>
      ) : (
        <Reveal>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {items.map((t) => (
              <motion.div key={t.id} variants={staggerItem}>
                <ResumeCard item={t} progressLabel={kindById[t.category_id] === "reading" ? "Ch" : "Ep"} />
              </motion.div>
            ))}
          </motion.div>
        </Reveal>
      )}
    </div>
  );
}
