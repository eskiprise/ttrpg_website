import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";

export function About() {
  const { t } = useTranslation();

  return (
    <PageShell>
      <h1 className="page-title">{t("about.title")}</h1>
      <p className="mt-6 max-w-[60ch] text-lg text-ink-muted">{t("about.body")}</p>
    </PageShell>
  );
}
