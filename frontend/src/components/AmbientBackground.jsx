import { useMotion } from "../context/ThemeContext";

// A fixed, full-viewport layer of slowly drifting colour blobs that sits *behind* all
// content (z-index: -1). Colours come from the active theme (primary / accent / secondary)
// so it adapts to every theme automatically — soft light washes on light themes, glowing
// nebulae on dark ones. The drift itself is pure CSS (see `.hanabi-ambient` in index.css),
// and intensity is tuned per motion preset via the `motion-*` class on <html>.
export default function AmbientBackground() {
  const { tokens } = useMotion();
  if (!tokens.ambient) return null; // minimal / reduced-motion → no atmosphere
  return (
    <div className="hanabi-ambient" aria-hidden="true">
      <span className="hanabi-blob hanabi-blob-1" />
      <span className="hanabi-blob hanabi-blob-2" />
      <span className="hanabi-blob hanabi-blob-3" />
    </div>
  );
}
