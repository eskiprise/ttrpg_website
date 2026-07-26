import { useTheme } from "../theme/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to day theme" : "Switch to night theme"}
      className="flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-[3px] text-xs font-bold tracking-wide"
    >
      <span
        className={`rounded-full px-2.5 py-1 ${!isDark ? "bg-ink text-bg" : "text-ink-muted"}`}
      >
        Day
      </span>
      <span
        className={`rounded-full px-2.5 py-1 ${isDark ? "bg-ink text-bg" : "text-ink-muted"}`}
      >
        Night
      </span>
    </button>
  );
}
