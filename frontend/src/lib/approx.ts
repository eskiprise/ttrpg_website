/**
 * Overview pages (homepage figures and chips, the systems grid) advertise how much we've
 * played as "30+", not "42" — a precise figure invites counting, a rounded one reads as
 * scale. The exact number belongs on the system's own page.
 */
const THRESHOLDS = [700, 500, 300, 200, 100, 70, 50, 30, 20, 10];

/** Past a thousand the steps are hundreds: 1097 → 1000+, 1111 → 1100+, 2350 → 2300+. */
const HUNDREDS_FROM = 1000;

/** The threshold to show as "N+", or null below the smallest one (then show the count). */
export function roundedThreshold(count: number): number | null {
  if (count >= HUNDREDS_FROM) return Math.floor(count / 100) * 100;
  return THRESHOLDS.find((threshold) => count >= threshold) ?? null;
}
