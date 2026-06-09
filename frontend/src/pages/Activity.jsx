import { useEffect, useState } from "react";
import { listActivity } from "../lib/db";
import ActivityFeed from "../components/ActivityFeed";

export default function Activity() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    listActivity(100).then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</div>
        <h1 className="text-4xl sm:text-5xl font-display font-black tracking-tight">Activity</h1>
        <p className="text-muted-foreground mt-1">Everything you've watched, read, and updated, in one stream.</p>
      </header>
      {items === null ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <ActivityFeed items={items} />
      )}
    </div>
  );
}
