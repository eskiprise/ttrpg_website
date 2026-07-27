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
      aria-label={`Switch to ${next === "uk" ? "Ukrainian" : "English"}`}
      title={next === "uk" ? "Українською" : "In English"}
      onClick={() => i18n.changeLanguage(next)}
      className="secondary flex h-9 w-9 items-center justify-center rounded-full p-0 text-lg leading-none"
    >
      {FLAGS[current]}
    </button>
  );
}
