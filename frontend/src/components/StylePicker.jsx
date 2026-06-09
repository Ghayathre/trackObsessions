import { useTheme } from "../context/ThemeContext";
import { Check } from "lucide-react";

export default function StylePicker() {
  const { style, setStyle, styles } = useTheme();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="style-grid">
      {styles.map((s) => {
        const Icon = s.icon;
        const active = s.slug === style;
        return (
          <button
            key={s.slug}
            onClick={() => setStyle(s.slug)}
            data-testid={`style-picker-${s.slug}`}
            className={`style-${s.slug} relative text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
              active ? "border-primary ring-2 ring-primary/40" : "border-border"
            }`}
            style={{ borderRadius: "var(--radius, 1rem)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4" />
              <span className="font-display font-bold">{s.name}</span>
              {active && <Check className="w-4 h-4 text-primary ml-auto" />}
            </div>
            <div
              className="text-4xl mb-2 leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {s.sample}
            </div>
            <div className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
              {s.blurb}
            </div>
          </button>
        );
      })}
    </div>
  );
}
