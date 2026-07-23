import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, idToken } = useAuth();
  if (loading) return <div className="page">{t("common.loading")}</div>;
  if (!idToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, idToken, isAdmin } = useAuth();
  if (loading) return <div className="page">{t("common.loading")}</div>;
  if (!idToken) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequireGameMaster({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, idToken, isAdmin, isDm } = useAuth();
  if (loading) return <div className="page">{t("common.loading")}</div>;
  if (!idToken) return <Navigate to="/login" replace />;
  if (!isAdmin && !isDm) return <Navigate to="/" replace />;
  return <>{children}</>;
}
