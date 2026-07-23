import { useTranslation } from "react-i18next";

export function About() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <h1>{t("about.title")}</h1>
      <p className="muted">{t("about.body")}</p>
    </div>
  );
}
