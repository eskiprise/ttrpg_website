import type { ReactNode } from "react";

/**
 * A headline figure. `tone="band"` is the homepage evidence band; `tone="card"` is
 * the boxed version used on Statistics.
 */
export function StatTile({
  value,
  unit,
  label,
  tone = "card",
}: {
  value: ReactNode;
  unit?: string;
  label: string;
  tone?: "card" | "band";
}) {
  const onBand = tone === "band";
  return (
    <div className={onBand ? "" : "rounded-xl border border-border bg-surface p-5"}>
      <p
        className={`font-numeric text-[clamp(2rem,5vw,3rem)] leading-none font-extrabold tracking-[-0.045em] tabular-nums ${
          onBand ? "text-band-ink" : "text-ink"
        }`}
      >
        {value}
        {unit && (
          <span
            className={`text-[0.42em] tracking-normal ${onBand ? "text-band-accent" : "text-accent"}`}
          >
            {unit}
          </span>
        )}
      </p>
      <p className={`mt-2 text-sm ${onBand ? "text-band-ink-muted" : "text-ink-muted"}`}>{label}</p>
    </div>
  );
}
