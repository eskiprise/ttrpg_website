import { useState } from "react";
import "./PieChart.css";

export interface PieSlice {
  key: string;
  label: string;
  value: number;
}

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

const SIZE = 200;
const CENTER = SIZE / 2;
const OUTER_R = 90;
const INNER_R = 55;
const GAP_DEG = 2.5;
const LABEL_THRESHOLD = 0.08; // only label slices >= 8% of the total — avoid clutter

function polarToCartesian(radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  };
}

/**
 * Walks the annular sector's boundary in order: outer arc start -> end (clockwise,
 * sweep=1), radial line in to the inner ring at `endDeg`, inner arc end -> start
 * (back the way we came, sweep=0), then Z closes the final radial line back to
 * the outer start. Each arc's start/end must be same-angle pairs (outer/inner at
 * `startDeg`, outer/inner at `endDeg`) — a mismatched pairing here draws a
 * self-intersecting shape instead of a clean wedge.
 */
function arcPath(startDeg: number, endDeg: number) {
  // A single "A" command can't span a full 360° (start === end is degenerate).
  const span = Math.min(endDeg - startDeg, 359.99);
  endDeg = startDeg + span;

  const outerStart = polarToCartesian(OUTER_R, startDeg);
  const outerEnd = polarToCartesian(OUTER_R, endDeg);
  const innerStart = polarToCartesian(INNER_R, startDeg);
  const innerEnd = polarToCartesian(INNER_R, endDeg);
  const largeArc = span > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

/** Donut chart for a small number of categorical slices (part-to-whole share). */
export function PieChart({ slices }: { slices: PieSlice[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) return null;

  let cursor = 0;
  const arcs = slices.map((slice, i) => {
    const fraction = slice.value / total;
    const startDeg = cursor * 360;
    const endDeg = (cursor + fraction) * 360;
    cursor += fraction;

    const gap = slices.length > 1 ? GAP_DEG / 2 : 0;
    const midDeg = (startDeg + endDeg) / 2;
    const labelPos = polarToCartesian((OUTER_R + INNER_R) / 2, midDeg);

    return {
      ...slice,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      path: arcPath(startDeg + gap, endDeg - gap),
      pct: Math.round(fraction * 100),
      labelPos,
      showLabel: fraction >= LABEL_THRESHOLD,
    };
  });

  return (
    <div className="piechart">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="piechart-svg">
        {arcs.map((arc) => (
          <g
            key={arc.key}
            className={hovered && hovered !== arc.key ? "piechart-slice dimmed" : "piechart-slice"}
            onMouseEnter={() => setHovered(arc.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <path d={arc.path} fill={arc.color} />
            <title>{`${arc.label}: ${arc.value} (${arc.pct}%)`}</title>
            {arc.showLabel && (
              <text x={arc.labelPos.x} y={arc.labelPos.y} className="piechart-label">
                {arc.pct}%
              </text>
            )}
          </g>
        ))}
      </svg>
      <ul className="piechart-legend">
        {arcs.map((arc) => (
          <li
            key={arc.key}
            className={hovered && hovered !== arc.key ? "dimmed" : undefined}
            onMouseEnter={() => setHovered(arc.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="piechart-swatch" style={{ background: arc.color }} />
            <span>{arc.label}</span>
            <span className="muted">{arc.value} · {arc.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
