import { useTranslation } from "react-i18next";
import type { GameLogMonthlyCount } from "@ttrpg-club/shared";

const MAX_MONTHS_SHOWN = 12;
const CHART_WIDTH = 300;
const CHART_HEIGHT = 120;
const BAR_AREA_HEIGHT = 90;

function formatMonthLabel(month: string, locale: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

export function GamesPerMonthChart({ data }: { data: GameLogMonthlyCount[] }) {
  const { t, i18n } = useTranslation();
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
          const height = (d.count / maxCount) * BAR_AREA_HEIGHT;
          const x = i * barWidth;
          const centerX = x + barWidth / 2;
          return (
            <g key={d.month}>
              <rect
                x={x + barWidth * 0.15}
                y={BAR_AREA_HEIGHT - height}
                width={barWidth * 0.7}
                height={height}
                rx={2}
                className="fill-accent"
              />
              <text x={centerX} y={BAR_AREA_HEIGHT - height - 3} textAnchor="middle" fontSize={7} className="fill-ink">
                {d.count}
              </text>
              <text x={centerX} y={BAR_AREA_HEIGHT + 12} textAnchor="middle" fontSize={7} className="fill-ink-muted">
                {formatMonthLabel(d.month, i18n.language)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
