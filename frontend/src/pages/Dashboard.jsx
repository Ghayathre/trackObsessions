import { useEffect, useState } from "react";
import api from "../lib/api";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { TrendingUp, Eye, CheckCircle2, Bookmark, Sparkles } from "lucide-react";
import MediaCard from "../components/MediaCard";

const STATS = [
  { key: "watching", label: "In progress", icon: Eye },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "plan", label: "On the list", icon: Bookmark },
  { key: "total", label: "Total tracked", icon: TrendingUp },
];

export default function Dashboard() {
  const [data, setData] = useState(null);

  const load = async () => {
    const { data } = await api.get("/stats");
    setData(data);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your library</div>
        <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">Welcome back.</h1>
        <p className="text-muted-foreground max-w-xl">
          A snapshot of everything you're watching, reading, and dreaming about — kept in sync by the Hanabi extension.
        </p>
      </header>

      {/* Stats bento */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
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
      </section>

      {/* Pending suggestions banner */}
      {data?.pending_suggestions > 0 && (
        <Card className="p-5 border-primary/40 hanabi-glow flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <div className="font-bold">{data.pending_suggestions} suggestion{data.pending_suggestions > 1 ? "s" : ""} waiting</div>
            <div className="text-sm text-muted-foreground">Your Hanabi extension spotted something. Open the inbox to review.</div>
          </div>
        </Card>
      )}

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
