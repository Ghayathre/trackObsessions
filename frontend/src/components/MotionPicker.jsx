import { useTheme } from "../context/ThemeContext";
import { MOTION_TOKENS } from "../data/motion";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

// A live, looping preview of a preset's easing — three "weights" that rise and settle
// using that preset's own duration/ease/stagger, so each card feels different.
function MotionPreview({ slug }) {
  const t = MOTION_TOKENS[slug];
  return (
    <div className="flex items-end gap-1.5 h-10">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2.5 rounded-full bg-primary"
          initial={{ height: 6, opacity: 0.5 }}
          animate={{ height: [6, 30, 6], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: Math.max(0.5, t.duration * 1.6),
            ease: t.ease,
            repeat: Infinity,
            repeatType: "loop",
            delay: i * (t.stagger * 4),
          }}
        />
      ))}
    </div>
  );
}

export default function MotionPicker() {
  const { motion: current, setMotion, motions, reducedMotion } = useTheme();
  return (
    <div>
      {reducedMotion && (
        <div className="mb-4 text-xs rounded-lg border border-border bg-muted/50 px-3 py-2 text-muted-foreground">
          Your system has <b>Reduce motion</b> turned on, so Hanabi is keeping animation to a minimum.
          Your pick below is saved and applies as soon as you turn that off.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="motion-grid">
        {motions.map((m) => {
          const Icon = m.icon;
          const active = m.slug === current;
          return (
            <button
              key={m.slug}
              onClick={() => setMotion(m.slug)}
              data-testid={`motion-picker-${m.slug}`}
              className={`relative text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
                active ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" />
                <span className="font-display font-bold">{m.name}</span>
                {active && <Check className="w-4 h-4 text-primary ml-auto" />}
              </div>
              <MotionPreview slug={m.slug} />
              <div className="text-xs text-muted-foreground mt-3">{m.mood}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
