import { useEffect, useState } from "react";
import api from "../lib/api";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { TrendingUp, Eye, CheckCircle2, Bookmark, Sparkles, Timer } from "lucide-react";
import MediaCard from "../components/MediaCard";
import ActivityFeed from "../components/ActivityFeed";

const STATS = [
  { key: "watching", label: "In progress", icon: Eye },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "plan", label: "On the list", icon: Bookmark },
  { key: "total", label: "Total tracked", icon: TrendingUp },
];

function formatHours(h) {
  if (!h) return "0h";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 100) return `${h.toFixed(1)}h`;
  return `${Math.round(h)}h`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);

  const load = async () => {
    const [{ data: s }, { data: a }] = await Promise.all([
      api.get("/stats"),
      api.get("/activity", { params: { limit: 6 } }),
    ]);
    setData(s);
    setActivity(a);
  };
  useEffect(() => { load(); }, []);

  // chart scale
  const maxHours = data ? Math.max(1, ...data.by_category.map((c) => c.hours)) : 1;

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your library</div>
        <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">Welcome back.</h1>
        <p className="text-muted-foreground max-w-xl">
          A snapshot of everything you're watching, reading, and dreaming about — kept in sync by the Hanabi extension.
        </p>
      </header>

      {/* Top stats */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-grid">
        {STATS.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="p-5 fade-up">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="font-display font-black text-4xl mt-3" data-testid={`stat-${key}`}>
              {data ? data[key] : "—"}
            </div>
          </Card>
        ))}
        <Card className="p-5 fade-up bg-primary/10 border-primary/30" data-testid="stat-hours-card">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-primary/90">Hours logged</div>
            <Timer className="w-4 h-4 text-primary" />
          </div>
          <div className="font-display font-black text-4xl mt-3 gradient-text" data-testid="stat-hours">
            {data ? formatHours(data.hours) : "—"}
          </div>
        </Card>
      </section>

      {/* Pending suggestions banner */}
      {data?.pending_suggestions > 0 && (
        <Card className="p-5 border-primary/40 hanabi-glow flex items-center gap-3" data-testid="pending-banner">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <div className="font-bold">{data.pending_suggestions} suggestion{data.pending_suggestions > 1 ? "s" : ""} waiting</div>
            <div className="text-sm text-muted-foreground">Your Hanabi extension spotted something. Open the inbox to review.</div>
          </div>
        </Card>
      )}

      {/* By-category chart + Activity */}
      <section className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display font-bold text-xl">Hours by collection</h2>
            <span className="text-xs text-muted-foreground">Estimated</span>
          </div>
          <div className="space-y-3" data-testid="hours-chart">
            {data?.by_category.length ? data.by_category.map((c) => (
              <Link to={`/c/${c.id}`} key={c.id} className="block group" data-testid={`chart-row-${c.slug}`}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className="font-medium group-hover:text-primary transition-colors">{c.name}</span>
                  <span className="text-muted-foreground">{c.count} · {formatHours(c.hours)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                    style={{ width: `${Math.max(2, (c.hours / maxHours) * 100)}%` }}
                  />
                </div>
              </Link>
            )) : <div className="text-sm text-muted-foreground">No data yet.</div>}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display font-bold text-xl">Recent activity</h2>
            <Link to="/activity" className="text-xs text-primary hover:underline">See all</Link>
          </div>
          <ActivityFeed items={activity} compact emptyHint="Update a title and your story starts here." />
        </Card>
      </section>

      {/* Recent */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display font-bold text-2xl">Recently updated</h2>
          <span className="text-xs text-muted-foreground">Last 8</span>
        </div>
        {!data || data.recent.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <div className="font-display font-bold text-lg">Nothing yet</div>
            <p className="text-sm text-muted-foreground mt-1">Pick a collection from the sidebar and add your first title.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data.recent.map((t) => (
              <MediaCard key={t.id} item={t} onChange={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
