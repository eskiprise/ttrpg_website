import { useTranslation } from "react-i18next";

export function About() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("about.title")}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t("about.body")}</p>
    </div>
  );
}
