import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { updateProfile } from "../lib/db";
import { THEMES } from "../data/themes";
import { STYLES, DEFAULT_STYLE } from "../data/styles";
import { MOTIONS, DEFAULT_MOTION, getMotionTokens, REDUCED_TOKENS } from "../data/motion";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);
const ALL_THEME_CLASSES = THEMES.map((t) => `theme-${t.slug}`);
const ALL_STYLE_CLASSES = STYLES.map((s) => `style-${s.slug}`);
const ALL_MOTION_CLASSES = MOTIONS.map((m) => `motion-${m.slug}`);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => localStorage.getItem("hanabi_theme") || "tokyo-twilight");
  const [style, setStyleState] = useState(() => localStorage.getItem("hanabi_style") || DEFAULT_STYLE);
  // Motion is a device preference — persisted locally, not synced to the profile,
  // so it needs no DB column.
  const [motion, setMotionState] = useState(() => localStorage.getItem("hanabi_motion") || DEFAULT_MOTION);

  // Track OS-level reduced-motion so we can override the chosen preset for accessibility.
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // sync from user (theme + style only)
  useEffect(() => {
    if (user && user.theme) {
      setThemeState(user.theme);
      localStorage.setItem("hanabi_theme", user.theme);
    }
    if (user && user.style) {
      setStyleState(user.style);
      localStorage.setItem("hanabi_style", user.style);
    }
  }, [user]);

  // apply theme + style + motion to <html>
  useEffect(() => {
    const root = document.documentElement;
    ALL_THEME_CLASSES.forEach((c) => root.classList.remove(c));
    ALL_STYLE_CLASSES.forEach((c) => root.classList.remove(c));
    ALL_MOTION_CLASSES.forEach((c) => root.classList.remove(c));
    root.classList.add(`theme-${theme}`);
    root.classList.add(`style-${style}`);
    // Under OS reduced-motion we force the minimal class so CSS-driven ambient/float stop too.
    root.classList.add(`motion-${reduced ? "minimal" : motion}`);
  }, [theme, style, motion, reduced]);

  const setTheme = async (slug) => {
    setThemeState(slug);
    localStorage.setItem("hanabi_theme", slug);
    if (user) { try { await updateProfile({ theme: slug }); } catch {} }
  };

  const setStyle = async (slug) => {
    setStyleState(slug);
    localStorage.setItem("hanabi_style", slug);
    if (user) { try { await updateProfile({ style: slug }); } catch {} }
  };

  const setMotion = (slug) => {
    setMotionState(slug);
    localStorage.setItem("hanabi_motion", slug);
  };

  // Resolved JS tokens for framer-motion primitives. Reduced-motion wins.
  const motionTokens = useMemo(
    () => (reduced ? REDUCED_TOKENS : getMotionTokens(motion)),
    [motion, reduced]
  );

  const value = {
    theme, style, motion, reducedMotion: reduced,
    setTheme, setStyle, setMotion,
    themes: THEMES, styles: STYLES, motions: MOTIONS,
    motionTokens,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// Convenience hook for motion-aware components: resolved tokens + the active preset.
export const useMotion = () => {
  const ctx = useContext(ThemeContext);
  return { tokens: ctx.motionTokens, motion: ctx.motion, reducedMotion: ctx.reducedMotion };
};
