import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Flame } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate("/login", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        setUser(data.user);
        // strip hash from URL so we don't re-process if user hits back
        window.history.replaceState(null, "", "/");
        navigate("/", { replace: true });
      } catch {
        navigate("/login?error=google", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-primary text-primary-foreground grid place-items-center hanabi-glow animate-pulse">
          <Flame className="w-6 h-6" />
        </div>
        <div className="mt-4 font-display font-bold text-lg">Signing you in…</div>
        <div className="text-sm text-muted-foreground mt-1">Just a moment.</div>
      </div>
    </div>
  );
}
