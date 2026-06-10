import { useTheme } from "../context/ThemeContext";
import SootSprites from "./SootSprites";
import Fireflies from "./Fireflies";

// Renders whichever little creatures the user picked in Settings → Companions.
export default function Companions() {
  const { companion } = useTheme();
  if (companion === "none") return null;
  if (companion === "fireflies") return <Fireflies />;
  return <SootSprites />;
}
