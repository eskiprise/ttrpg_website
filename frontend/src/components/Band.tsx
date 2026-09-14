import type { ReactNode } from "react";

const TONES = {
  page: "",
  raised: "bg-surface border-y border-border",
  /**
   * The deep section. Sets `--accent` locally to brass so anything inside that
   * reaches for the accent (links, `text-accent`) lands on the colour that works
   * against the band rather than the clay tuned for the bone surface.
   */
  dark: "bg-band text-band-ink [--accent:var(--band-accent)]",
} as const;

const WIDTHS = {
  narrow: "max-w-3xl",
  wide: "max-w-5xl",
  full: "max-w-6xl",
} as const;

/** A full-bleed horizontal section with a centred inner column. */
export function Band({
  children,
  tone = "page",
  width = "full",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  width?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <section className={`${TONES[tone]} ${className}`}>
      <div className={`mx-auto ${WIDTHS[width]} px-6 py-14 sm:py-20`}>{children}</div>
    </section>
  );
}
