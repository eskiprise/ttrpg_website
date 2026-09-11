import { useTranslation } from "react-i18next";
import type { GameLogMonthlyCount } from "@ttrpg-club/shared";

const DEFAULT_MAX_MONTHS = 12;

// "MM.YY" rather than a localized month name ("серп. 26") — short and a fixed width
// regardless of language, so labels don't collide once there are more than a handful
// of bars (Ukrainian month names in particular run long).
function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${m}.${year.slice(2)}`;
}

/**
 * Built from flex/HTML rather than a scaled SVG on purpose: an SVG viewBox scales its
 * text along with the container, so at full band width the labels ballooned and every
 * month label collided with its neighbours. Here the type stays at a real CSS size no
 * matter how wide the chart gets, and the axis thins itself out instead of crowding.
 *
 * `tone="band"` swaps the fills for the ones that read against the dark band — the
 * chart is the club's growth argument on the homepage, and its usual light card
 * chrome would float awkwardly on a dark section.
 */
export function GamesPerMonthChart({
  data,
  maxMonths = DEFAULT_MAX_MONTHS,
  tone = "card",
  title,
  legend,
}: {
  data: GameLogMonthlyCount[];
  maxMonths?: number;
  tone?: "card" | "band";
  title?: string;
  legend?: string;
}) {
  const { t } = useTranslation();
  if (data.length === 0) return null;

  const onBand = tone === "band";
  const heading = title ?? t("gameLog.chartTitle");

  const recent = data.slice(-maxMonths);
  const maxCount = Math.max(...recent.map((d) => d.count), 1);

  // Thin the axis out rather than letting labels touch: every month up to 8 bars,
  // then every other, then every third once the history gets long.
  const labelEvery = recent.length <= 8 ? 1 : recent.length <= 16 ? 2 : 3;

  const bar = onBand
    ? "linear-gradient(180deg, var(--band-accent), color-mix(in oklab, var(--band-accent) 30%, var(--band)))"
    : "linear-gradient(180deg, var(--accent), color-mix(in oklab, var(--accent) 45%, var(--surface)))";
  const barPeak = onBand
    ? "linear-gradient(180deg, color-mix(in oklab, var(--band-accent) 65%, white), var(--band-accent))"
    : "linear-gradient(180deg, color-mix(in oklab, var(--accent) 75%, white), var(--accent))";

  return (
    <div
      className={
        onBand
          ? "rounded-xl border border-band-edge bg-band-raised p-5 sm:p-6"
          : "rounded-xl border border-border bg-surface p-5 sm:p-6"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2
          className={`font-body text-xs font-semibold tracking-[0.16em] uppercase ${
            onBand ? "text-band-accent" : "text-accent"
          }`}
        >
          {heading}
        </h2>
        {legend && (
          <p className={`text-sm ${onBand ? "text-band-ink-muted" : "text-ink-muted"}`}>{legend}</p>
        )}
      </div>

      <div
        className="mt-5 flex h-[clamp(7rem,16vw,10rem)] items-end gap-[clamp(3px,0.8vw,9px)]"
        role="img"
        aria-label={`${heading}${legend ? `. ${legend}` : ""}`}
      >
        {recent.map((d) => {
          const isPeak = d.count === maxCount;
          return (
            <div key={d.month} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
              {/* Non-peak counts hide below sm — at phone width fifteen two-digit
                  numbers run together. `invisible` rather than `hidden` so every
                  column keeps an identical bar track height. */}
              <span
                className={`font-numeric text-[0.68rem] leading-none font-bold whitespace-nowrap tabular-nums ${
                  isPeak ? "visible" : "invisible sm:visible"
                } ${
                  isPeak
                    ? onBand
                      ? "text-band-ink"
                      : "text-ink"
                    : onBand
                      ? "text-band-ink-muted"
                      : "text-ink-muted"
                }`}
              >
                {d.count}
              </span>
              {/* The track takes whatever height the label leaves, so a full-height
                  bar can never push its own label out of the chart. */}
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[3px]"
                  style={{
                    height: `${Math.max((d.count / maxCount) * 100, 2)}%`,
                    background: isPeak ? barPeak : bar,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-[clamp(3px,0.8vw,9px)]">
        {recent.map((d, i) => (
          // Skipped months render genuinely empty, not just transparent: a hidden
          // label still claims its text width as a flex item's min-content, which
          // pushed the whole axis wider than the chart on narrow screens. min-w-0
          // then lets a shown label spill over its empty neighbours instead.
          <span
            key={d.month}
            className={`min-w-0 flex-1 text-center text-[0.6rem] whitespace-nowrap opacity-70 tabular-nums ${
              onBand ? "text-band-ink-muted" : "text-ink-muted"
            }`}
          >
            {i % labelEvery === 0 ? formatMonthLabel(d.month) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
