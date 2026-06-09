import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Category from "@/pages/Category";
import Settings from "@/pages/Settings";
import Activity from "@/pages/Activity";
import PublicProfile from "@/pages/PublicProfile";
import AuthCallback from "@/pages/AuthCallback";
import Layout from "@/components/Layout";
import { PageTransition } from "@/lib/motion";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><PageTransition>{children}</PageTransition></Layout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

// Catch the OAuth fragment BEFORE any normal route runs (synchronous, no useEffect).
function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="/u/:username/c/:slug" element={<PublicProfile />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/activity" element={<Protected><Activity /></Protected>} />
        <Route path="/c/:id" element={<Protected><Category /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
