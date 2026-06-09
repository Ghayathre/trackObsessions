import { Sparkles, Plus, ArrowUp, CheckCircle2, Tv2, Trash2, RadioTower } from "lucide-react";
import { Link } from "react-router-dom";

const ICONS = {
  add: { Icon: Plus, color: "text-primary" },
  progress: { Icon: ArrowUp, color: "text-accent" },
  status: { Icon: Tv2, color: "text-secondary" },
  complete: { Icon: CheckCircle2, color: "text-accent" },
  remove: { Icon: Trash2, color: "text-destructive" },
  extension_add: { Icon: RadioTower, color: "text-primary" },
};

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function describe(a) {
  switch (a.type) {
    case "add": return <>Added <b>{a.title}</b> to {a.category_name || "your library"}</>;
    case "extension_add": return <>Hanabi {a.extra?.auto ? "auto-added" : "added"} <b>{a.title}</b> from the extension</>;
    case "progress": return <>Updated <b>{a.title}</b> · ep {a.extra?.from} → {a.extra?.to}</>;
    case "status": return <>Moved <b>{a.title}</b> to <i>{(a.extra?.to || "").replace("_", " ")}</i></>;
    case "complete": return <>Finished <b>{a.title}</b> 🎉</>;
    case "remove": return <>Removed <b>{a.title}</b></>;
    default: return <>{a.title}</>;
  }
}

export default function ActivityFeed({ items, compact = false, emptyHint = "Activity will appear here as you watch and read." }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed border-border rounded-xl">
        <Sparkles className="w-5 h-5 mx-auto text-muted-foreground" />
        <div className="mt-2 text-sm text-muted-foreground">{emptyHint}</div>
      </div>
    );
  }

  return (
    <ol className="relative">
      {/* timeline rail */}
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" aria-hidden />
      {items.map((a, i) => {
        const { Icon, color } = ICONS[a.type] || ICONS.add;
        return (
          <li key={a.id || i} className="pl-12 relative pb-5 fade-up" data-testid={`activity-item-${i}`}>
            <span className={`absolute left-0 top-0 w-8 h-8 rounded-full bg-card border border-border grid place-items-center ${color}`}>
              <Icon className="w-4 h-4" />
            </span>
            <div className="text-sm leading-snug">
              {a.title_id && a.category_id && !compact ? (
                <Link to={`/c/${a.category_id}`} className="hover:underline">{describe(a)}</Link>
              ) : describe(a)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(a.created_at)}{a.category_name ? ` · ${a.category_name}` : ""}</div>
          </li>
        );
      })}
    </ol>
  );
}
