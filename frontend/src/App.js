import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
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
import Layout from "@/components/Layout";
import AmbientBackground from "@/components/AmbientBackground";
import FireflyTrail from "@/components/FireflyTrail";
import { PageTransition } from "@/lib/motion";

// Persistent layout route — sidebar stays mounted, only the page-content area transitions.
function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <AnimatePresence mode="wait" initial={false}>
        <PageTransition key={location.pathname}><Outlet /></PageTransition>
      </AnimatePresence>
    </Layout>
  );
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/u/:username" element={<PublicProfile />} />
      <Route path="/u/:username/c/:slug" element={<PublicProfile />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/c/:id" element={<Category />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AmbientBackground />
          <FireflyTrail />
          <AppRoutes />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
