import { useTheme } from "../context/ThemeContext";
import { Check } from "lucide-react";

export default function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {themes.map((t) => {
        const Icon = t.icon;
        const active = t.slug === theme;
        return (
          <button
            key={t.slug}
            onClick={() => setTheme(t.slug)}
            data-testid={`theme-picker-${t.slug}`}
            className={`relative text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
              active ? "border-primary ring-2 ring-primary/40" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4" />
              <span className="font-display font-bold">{t.name}</span>
              {active && <Check className="w-4 h-4 text-primary ml-auto" />}
            </div>
            <div className="flex gap-1.5 mb-2">
              {t.swatches.map((c, i) => (
                <div key={i} className="w-7 h-7 rounded-full border border-border" style={{ background: c }} />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">{t.mood}</div>
          </button>
        );
      })}
    </div>
  );
}
