import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Flame } from "lucide-react";
import { toast } from "sonner";

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
      const { needsConfirmation } = await register(email, password, name);
      if (needsConfirmation) {
        toast.success("Account created — check your email to confirm, then sign in");
        navigate("/login");
      } else {
        toast.success("Account created");
        navigate("/");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong");
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
        <form onSubmit={submit} className="mt-8 space-y-4 max-w-sm">
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
