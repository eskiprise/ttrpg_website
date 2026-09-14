import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { PageShell } from "./PageShell";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, idToken } = useAuth();
  if (loading) return <PageShell><p className="text-ink-muted">{t("common.loading")}</p></PageShell>;
  if (!idToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, idToken, isAdmin } = useAuth();
  if (loading) return <PageShell><p className="text-ink-muted">{t("common.loading")}</p></PageShell>;
  if (!idToken) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
