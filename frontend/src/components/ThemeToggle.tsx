import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeContext";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? t("nav.themeToDay") : t("nav.themeToNight")}
      className="flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-[3px] text-xs font-semibold tracking-wide"
    >
      <span className={`rounded-full px-2.5 py-1 ${!isDark ? "bg-ink text-bg" : "text-ink-muted"}`}>
        {t("nav.themeDay")}
      </span>
      <span className={`rounded-full px-2.5 py-1 ${isDark ? "bg-ink text-bg" : "text-ink-muted"}`}>
        {t("nav.themeNight")}
      </span>
    </button>
  );
}
