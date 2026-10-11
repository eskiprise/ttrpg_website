import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { useSeo } from "../hooks/useSeo";

/**
 * Any path no route matches — including the old pages of the domain's previous owner
 * that spam sites still link to. The static host answers every path with 200, so the
 * page marks itself noindex rather than letting Google file it as a copy of the site.
 */
export function NotFound() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  useSeo({ title: t("notFound.pageTitle"), description: t("notFound.body"), path: pathname, noindex: true });

  return (
    <PageShell>
      <h1 className="page-title">{t("notFound.title")}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t("notFound.body")}</p>
      <Link to="/" className="mt-8 inline-block hover:no-underline">
        <button type="button">{t("notFound.home")}</button>
      </Link>
    </PageShell>
  );
}
