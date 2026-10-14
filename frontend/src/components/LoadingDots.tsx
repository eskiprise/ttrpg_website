import { useTranslation } from "react-i18next";

/**
 * Three pulsing dots standing in for a figure or a list that's still on its way — the
 * page around it is already there, only the live data is missing. Sized in em, so it
 * takes the font size (and colour) of whatever it replaces: a headline count, a stat
 * tile, a line of text.
 */
export function LoadingDots({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span role="status" aria-label={t("common.loading")} className={`inline-flex items-center gap-[0.22em] ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="loading-dot h-[0.3em] w-[0.3em] rounded-full bg-current"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}
