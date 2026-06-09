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

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/");
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <div className="hidden lg:block relative overflow-hidden">
        <img src="https://images.unsplash.com/photo-1694276971921-ff8f103752eb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHw0fHxhbmltZSUyMGFlc3RoZXRpYyUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzgwOTkyMTU5fDA&ixlib=rb-4.1.0&q=85" className="absolute inset-0 w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-gradient-to-tr from-background/90 via-background/40 to-transparent" />
        <div className="relative h-full p-12 flex flex-col justify-end">
          <h2 className="text-5xl font-display font-black tracking-tight leading-[0.95] max-w-md">Track everything you love — automatically.</h2>
          <p className="mt-4 text-muted-foreground max-w-md">Hanabi watches what you watch & read and quietly keeps your collections in sync. K-dramas, anime, manga, books — your library, your themes.</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-8 sm:px-16 py-12">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center hanabi-glow"><Flame className="w-4 h-4" /></div>
          <span className="font-display font-black text-xl">Hanabi</span>
        </Link>
        <h1 className="text-4xl font-display font-black tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground mt-1">Sign in to your collections.</p>
        <form onSubmit={submit} className="mt-8 space-y-4 max-w-sm">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">{loading ? "…" : "Sign in"}</Button>
          <div className="text-sm text-muted-foreground">
            No account? <Link to="/register" className="text-primary underline" data-testid="link-register">Create one</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
