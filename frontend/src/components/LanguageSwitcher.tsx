import { useTranslation } from "react-i18next";

const FLAGS: Record<string, string> = {
  uk: "🇺🇦",
  en: "🇬🇧",
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? "uk";
  const next = current === "uk" ? "en" : "uk";

  return (
    <button
      type="button"
      className="secondary"
      aria-label={`Switch to ${next === "uk" ? "Ukrainian" : "English"}`}
      title={next === "uk" ? "Українською" : "In English"}
      onClick={() => i18n.changeLanguage(next)}
      style={{ fontSize: "1.2rem", lineHeight: 1, padding: "0.4rem 0.6rem" }}
    >
      {FLAGS[current]}
    </button>
  );
}
