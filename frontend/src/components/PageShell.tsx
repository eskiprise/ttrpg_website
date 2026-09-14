import type { ReactNode } from "react";

const WIDTHS = {
  narrow: "max-w-3xl",
  wide: "max-w-5xl",
  full: "max-w-6xl",
} as const;

/**
 * The standard page container. Nine pages used to repeat
 * `mx-auto max-w-3xl px-6 py-16` verbatim, so page rhythm now changes in one place.
 */
export function PageShell({
  children,
  width = "narrow",
  className = "",
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <div className={`mx-auto ${WIDTHS[width]} px-6 py-12 sm:py-16 ${className}`}>{children}</div>
  );
}
