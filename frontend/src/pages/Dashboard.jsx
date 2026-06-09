import { useEffect, useState } from "react";
import { getStats, listActivity } from "../lib/db";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { TrendingUp, Eye, CheckCircle2, Bookmark, Sparkles, Timer } from "lucide-react";
import MediaCard from "../components/MediaCard";
import ActivityFeed from "../components/ActivityFeed";
import { motion } from "framer-motion";
import { Reveal, CountUp, staggerContainer, staggerItem } from "../lib/motion";

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
    const [s, a] = await Promise.all([getStats(), listActivity(6)]);
    setData(s);
    setActivity(a);
  };
  useEffect(() => { load(); }, []);

  // chart scale
  const maxHours = data ? Math.max(1, ...data.by_category.map((c) => c.hours)) : 1;

  return (
    <div className="space-y-12">
      <Reveal y={32}>
        <header className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your library</div>
          <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">Welcome back.</h1>
          <p className="text-muted-foreground max-w-xl">
            A snapshot of everything you're watching, reading, and dreaming about — kept in sync by the Hanabi extension.
          </p>
        </header>
      </Reveal>

      {/* Top stats */}
      <motion.section
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
        data-testid="stats-grid"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {STATS.map(({ key, label, icon: Icon }) => (
          <motion.div key={key} variants={staggerItem}>
            <Card className="p-5 transition-transform hover:-translate-y-1 duration-300">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="font-display font-black text-4xl mt-3" data-testid={`stat-${key}`}>
                {data ? <CountUp value={data[key] || 0} /> : "—"}
              </div>
            </Card>
          </motion.div>
        ))}
        <motion.div variants={staggerItem}>
          <Card className="p-5 bg-primary/10 border-primary/30 transition-transform hover:-translate-y-1 duration-300" data-testid="stat-hours-card">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-primary/90">Hours logged</div>
              <Timer className="w-4 h-4 text-primary" />
            </div>
            <div className="font-display font-black text-4xl mt-3 gradient-text" data-testid="stat-hours">
              {data ? <CountUp value={data.hours || 0} decimals={1} suffix="h" /> : "—"}
            </div>
          </Card>
        </motion.div>
      </motion.section>

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
      <Reveal>
        <section className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-display font-bold text-xl">Hours by collection</h2>
              <span className="text-xs text-muted-foreground">Estimated</span>
            </div>
            <div className="space-y-3" data-testid="hours-chart">
              {data?.by_category.length ? data.by_category.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                >
                  <Link to={`/c/${c.id}`} className="block group" data-testid={`chart-row-${c.slug}`}>
                    <div className="flex items-baseline justify-between text-sm mb-1">
                      <span className="font-medium group-hover:text-primary transition-colors">{c.name}</span>
                      <span className="text-muted-foreground">{c.count} · {formatHours(c.hours)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, (c.hours / maxHours) * 100)}%` }}
                        transition={{ delay: 0.15 + i * 0.05, duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
                      />
                    </div>
                  </Link>
                </motion.div>
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
      </Reveal>

      {/* Recent */}
      <Reveal>
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
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {data.recent.map((t) => (
                <motion.div key={t.id} variants={staggerItem}>
                  <MediaCard item={t} onChange={load} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      </Reveal>
    </div>
  );
}
