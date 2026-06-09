import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { THEMES } from "../data/themes";
import { STYLES, DEFAULT_STYLE } from "../data/styles";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);
const ALL_THEME_CLASSES = THEMES.map((t) => `theme-${t.slug}`);
const ALL_STYLE_CLASSES = STYLES.map((s) => `style-${s.slug}`);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => localStorage.getItem("hanabi_theme") || "tokyo-twilight");
  const [style, setStyleState] = useState(() => localStorage.getItem("hanabi_style") || DEFAULT_STYLE);

  // sync from user
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

  // apply theme + style to <html>
  useEffect(() => {
    const root = document.documentElement;
    ALL_THEME_CLASSES.forEach((c) => root.classList.remove(c));
    ALL_STYLE_CLASSES.forEach((c) => root.classList.remove(c));
    root.classList.add(`theme-${theme}`);
    root.classList.add(`style-${style}`);
  }, [theme, style]);

  const setTheme = async (slug) => {
    setThemeState(slug);
    localStorage.setItem("hanabi_theme", slug);
    if (user) { try { await api.patch("/auth/theme", { theme: slug }); } catch {} }
  };

  const setStyle = async (slug) => {
    setStyleState(slug);
    localStorage.setItem("hanabi_style", slug);
    if (user) { try { await api.patch("/auth/settings", { style: slug }); } catch {} }
  };

  return (
    <ThemeContext.Provider value={{ theme, style, setTheme, setStyle, themes: THEMES, styles: STYLES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
