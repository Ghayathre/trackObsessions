import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { THEMES } from "../data/themes";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);
const ALL_CLASSES = THEMES.map((t) => `theme-${t.slug}`);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem("hanabi_theme") || "tokyo-twilight";
  });

  // when user loads, prefer their saved theme
  useEffect(() => {
    if (user && user.theme) {
      setThemeState(user.theme);
      localStorage.setItem("hanabi_theme", user.theme);
    }
  }, [user]);

  // apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    ALL_CLASSES.forEach((c) => root.classList.remove(c));
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = async (slug) => {
    setThemeState(slug);
    localStorage.setItem("hanabi_theme", slug);
    if (user) {
      try { await api.patch("/auth/theme", { theme: slug }); } catch {}
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
