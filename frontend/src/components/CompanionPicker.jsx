import { useTheme } from "../context/ThemeContext";
import { Check } from "lucide-react";

export default function CompanionPicker() {
  const { companion, setCompanion, companions } = useTheme();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="companion-grid">
      {companions.map((c) => {
        const Icon = c.icon;
        const active = c.slug === companion;
        return (
          <button
            key={c.slug}
            onClick={() => setCompanion(c.slug)}
            data-testid={`companion-picker-${c.slug}`}
            className={`relative text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
              active ? "border-primary ring-2 ring-primary/40" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" />
              <span className="font-display font-bold">{c.name}</span>
              {active && <Check className="w-4 h-4 text-primary ml-auto" />}
            </div>
            <div className="text-xs text-muted-foreground">{c.blurb}</div>
          </button>
        );
      })}
    </div>
  );
}
