import { useTranslation } from "react-i18next";
import type { GameLogMonthlyCount } from "@ttrpg-club/shared";

const MAX_MONTHS_SHOWN = 12;
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

export function GamesPerMonthChart({ data }: { data: GameLogMonthlyCount[] }) {
  const { t } = useTranslation();
  if (data.length === 0) return null;

  // Most recent N months only — showing the full history would get unreadably cramped.
  const recent = data.slice(-MAX_MONTHS_SHOWN);
  const maxCount = Math.max(...recent.map((d) => d.count), 1);
  const barWidth = CHART_WIDTH / recent.length;

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold text-ink-muted">{t("gameLog.chartTitle")}</h2>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="mt-4 h-32 w-full"
        role="img"
        aria-label={t("gameLog.chartTitle")}
      >
        {recent.map((d, i) => {
          const height = (d.count / maxCount) * BAR_MAX_HEIGHT;
          const barTop = BASELINE - height;
          const x = i * barWidth;
          const centerX = x + barWidth / 2;
          return (
            <g key={d.month}>
              <rect
                x={x + barWidth * 0.15}
                y={barTop}
                width={barWidth * 0.7}
                height={height}
                rx={2}
                className="fill-accent"
              />
              <text x={centerX} y={barTop - 3} textAnchor="middle" fontSize={7} className="fill-ink">
                {d.count}
              </text>
              <text x={centerX} y={BASELINE + 14} textAnchor="middle" fontSize={7} className="fill-ink-muted">
                {formatMonthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
