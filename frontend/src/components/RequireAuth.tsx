import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, idToken } = useAuth();
  if (loading) return <div className="page">Loading…</div>;
  if (!idToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, idToken, isAdmin } = useAuth();
  if (loading) return <div className="page">Loading…</div>;
  if (!idToken) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
