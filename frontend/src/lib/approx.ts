/**
 * Overview pages (homepage chips, the systems grid) advertise how much we've played as
 * "30+", not "42" — a precise figure invites counting, a rounded one reads as scale.
 * The exact number belongs on the system's own page.
 */
const THRESHOLDS = [1000, 700, 500, 300, 200, 100, 70, 50, 30, 20, 10];

/** The threshold to show as "N+", or null below the smallest one (then show the count). */
export function roundedThreshold(count: number): number | null {
  return THRESHOLDS.find((threshold) => count >= threshold) ?? null;
}
