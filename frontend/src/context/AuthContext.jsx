import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getProfile } from "../lib/db";

const AuthContext = createContext(null);

// Merge the Supabase auth user (email/id) with the profiles row (name, username, theme…).
async function buildUser(session) {
  if (!session?.user) return false;
  try {
    const profile = await getProfile(session.user.id);
    return { ...profile, id: session.user.id, email: session.user.email };
  } catch {
    return { id: session.user.id, email: session.user.email };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = unknown, false = logged out, obj = logged in
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setUser(await buildUser(data.session));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUser(await buildUser(data.session));
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(await buildUser(session));
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const u = await buildUser(data.session);
    setUser(u);
    return u;
  };

  const register = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name: name || "" } },
    });
    if (error) throw error;
    if (data.session) {
      const u = await buildUser(data.session);
      setUser(u);
      return { user: u, needsConfirmation: false };
    }
    // Email confirmation is required — no session yet.
    return { user: null, needsConfirmation: true };
  };

  const logout = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
