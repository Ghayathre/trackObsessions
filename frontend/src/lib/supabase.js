import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error("Missing REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY env vars");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// A session-less client for public profile pages. Because it never carries a user
// session, requests run as the `anon` role — which has a column grant on `titles`
// that EXCLUDES `notes`, so private notes can never leak on public profiles.
export const supabasePublic = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export default supabase;
