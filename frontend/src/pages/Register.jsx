import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Flame } from "lucide-react";
import { toast } from "sonner";

function formatError(detail) {
  if (!detail) return "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function continueWithGoogle() {
  const redirectUrl = window.location.origin + "/auth/callback";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

function GoogleButton({ testid }) {
  return (
    <button
      type="button"
      onClick={continueWithGoogle}
      data-testid={testid}
      className="w-full h-10 rounded-md border border-border bg-card hover:bg-muted/60 transition flex items-center justify-center gap-3 text-sm font-medium"
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5c-2 1.4-4.5 2.2-7.2 2.2-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.5 16.3 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.8l6.2 5C41.5 35.2 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Account created");
      navigate("/");
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <div className="flex flex-col justify-center px-8 sm:px-16 py-12 order-2 lg:order-1">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hanabi-glow"><Flame className="w-4 h-4" /></div>
          <span className="font-display font-black text-xl">Hanabi</span>
        </Link>
        <h1 className="text-4xl font-display font-black tracking-tight">Start your library</h1>
        <p className="text-muted-foreground mt-1">It only takes a moment.</p>
        <div className="mt-8 max-w-sm space-y-3">
          <GoogleButton testid="register-google" />
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4 max-w-sm">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="register-name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="register-email" />
          </div>
          <div>
            <Label htmlFor="password">Password (6+ chars)</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="register-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit">{loading ? "…" : "Create account"}</Button>
          <div className="text-sm text-muted-foreground">
            Already have one? <Link to="/login" className="text-primary underline" data-testid="link-login">Sign in</Link>
          </div>
        </form>
      </div>
      <div className="hidden lg:block relative overflow-hidden order-1 lg:order-2">
        <img src="https://images.unsplash.com/photo-1772211148356-b06ab210c7be?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDZ8MHwxfHNlYXJjaHwzfHxjb3p5JTIwcmVhZGluZyUyMG1hbmdhJTIwY2FmZXxlbnwwfHx8fDE3ODA5OTIxNTl8MA&ixlib=rb-4.1.0&q=85" className="absolute inset-0 w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-tl from-background/90 via-background/40 to-transparent" />
      </div>
    </div>
  );
}
