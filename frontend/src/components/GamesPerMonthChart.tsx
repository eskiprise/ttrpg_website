import { useTranslation } from "react-i18next";
import type { GameLogMonthlyCount } from "@ttrpg-club/shared";

const DEFAULT_MAX_MONTHS = 12;
const CHART_WIDTH = 300;
const CHART_HEIGHT = 120;
// Fixed top/bottom margins so a count label never clips the top edge and a month
// label always has room below the baseline, regardless of bar height.
const TOP_PADDING = 14;
const BOTTOM_PADDING = 20;
const BASELINE = CHART_HEIGHT - BOTTOM_PADDING;
const BAR_MAX_HEIGHT = BASELINE - TOP_PADDING;

// "MM.YY" rather than a localized month name ("серп. 26") — short and a fixed width
// regardless of language, so labels don't collide once there are more than a handful
// of bars (Ukrainian month names in particular run long).
function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${m}.${year.slice(2)}`;
}

/**
 * `tone="band"` swaps the fills for the ones that read against the dark band — the
 * chart is the club's growth argument on the homepage and its usual chrome there
 * would be a light card floating on a dark section.
 */
export function GamesPerMonthChart({
  data,
  maxMonths = DEFAULT_MAX_MONTHS,
  tone = "card",
  title,
}: {
  data: GameLogMonthlyCount[];
  maxMonths?: number;
  tone?: "card" | "band";
  title?: string;
}) {
  const { t } = useTranslation();
  if (data.length === 0) return null;

  const onBand = tone === "band";
  const heading = title ?? t("gameLog.chartTitle");

  // Most recent N months only — the full history gets unreadably cramped past ~15.
  const recent = data.slice(-maxMonths);
  const maxCount = Math.max(...recent.map((d) => d.count), 1);
  const barWidth = CHART_WIDTH / recent.length;

  return (
    <div
      className={
        onBand
          ? "rounded-xl border border-band-edge bg-band-raised p-5 sm:p-6"
          : "rounded-xl border border-border bg-surface p-6"
      }
    >
      <h2
        className={`font-body text-xs font-semibold tracking-[0.16em] uppercase ${
          onBand ? "text-band-accent" : "text-ink-muted"
        }`}
      >
        {heading}
      </h2>
      {/*
        No preserveAspectRatio="none" here: the container is much wider than the
        viewBox's own 2.5:1 ratio, and "none" stretches X and Y by different factors to
        fill it — squashing every bar and glyph vertically. Instead the container's CSS
        aspect ratio is locked to match the viewBox exactly (aspect-[5/2] = 300:120), so
        the default uniform scaling ("xMidYMid meet") fills the box with zero distortion
        and no letterboxing.
      */}
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="mt-4 aspect-[5/2] w-full"
        role="img"
        aria-label={heading}
      >
        {recent.map((d, i) => {
          const height = (d.count / maxCount) * BAR_MAX_HEIGHT;
          const barTop = BASELINE - height;
          const x = i * barWidth;
          const centerX = x + barWidth / 2;
          const isPeak = d.count === maxCount;
          return (
            <g key={d.month}>
              <rect
                x={x + barWidth * 0.15}
                y={barTop}
                width={barWidth * 0.7}
                height={height}
                rx={2}
                className={onBand ? (isPeak ? "fill-band-accent" : "fill-accent-2") : "fill-accent"}
              />
              <text
                x={centerX}
                y={barTop - 3}
                textAnchor="middle"
                fontSize={7}
                className={onBand ? "fill-band-ink" : "fill-ink"}
              >
                {d.count}
              </text>
              <text
                x={centerX}
                y={BASELINE + 14}
                textAnchor="middle"
                fontSize={7}
                className={onBand ? "fill-band-ink-muted" : "fill-ink-muted"}
              >
                {formatMonthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
