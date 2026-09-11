import type { ReactNode } from "react";

/**
 * The standard raised surface. Replaces ~20 hand-repeated copies of
 * `rounded-lg border border-border bg-surface p-6`.
 *
 * `interactive` adds the hover treatment used when the whole card is a link —
 * not applied by default, since a border+fill on every block flattens hierarchy.
 */
export function Card({
  children,
  interactive = false,
  padding = "normal",
  className = "",
}: {
  children: ReactNode;
  interactive?: boolean;
  padding?: "normal" | "tight" | "none";
  className?: string;
}) {
  const pad = padding === "none" ? "" : padding === "tight" ? "p-4" : "p-6";
  const hover = interactive ? "transition-colors hover:border-accent hover:bg-surface-2" : "";
  return (
    <div className={`rounded-xl border border-border bg-surface ${pad} ${hover} ${className}`}>
      {children}
    </div>
  );
}
