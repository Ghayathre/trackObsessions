import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { CREATURE_RANGES } from "../data/motion";
import { Card } from "./ui/card";
import { Slider } from "./ui/slider";

const ROWS = [
  { k: "count", label: "Number", fmt: (v) => Math.round(v) },
  { k: "size", label: "Size", fmt: (v) => `${v.toFixed(1)}×` },
  { k: "speed", label: "Speed", fmt: (v) => `${v.toFixed(1)}×` },
];

export default function CreatureControls() {
  const { companion, creatures, setCreatureSetting } = useTheme();
  const key = companion === "fireflies" ? "firefly" : "soot";
  const cfg = creatures[key];
  const ranges = CREATURE_RANGES[key];

  // Count re-seeds the field, so commit it on release; mirror it locally for a smooth thumb.
  const [countDraft, setCountDraft] = useState(cfg.count);
  useEffect(() => setCountDraft(cfg.count), [cfg.count, key]);

  if (companion === "none") return null;

  return (
    <Card className="p-5 mt-4 space-y-5 max-w-xl">
      {ROWS.map(({ k, label, fmt }) => {
        const isCount = k === "count";
        const val = isCount ? countDraft : cfg[k];
        return (
          <div key={k}>
            <div className="flex items-baseline justify-between text-sm mb-2">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground tabular-nums">{fmt(val)}</span>
            </div>
            <Slider
              value={[val]}
              min={ranges[k].min}
              max={ranges[k].max}
              step={ranges[k].step}
              data-testid={`creature-${key}-${k}`}
              onValueChange={(v) => (isCount ? setCountDraft(v[0]) : setCreatureSetting(key, k, v[0]))}
              onValueCommit={(v) => setCreatureSetting(key, k, v[0])}
            />
          </div>
        );
      })}
    </Card>
  );
}
