/**
 * Overview pages (homepage figures and chips, the systems grid) advertise how much we've
 * played as "40+", not "42" — a precise figure invites counting, a rounded one reads as
 * scale. The exact number belongs on the system's own page.
 *
 * Steps of ten up to a hundred, so a count never shows as less than its tens (41 reads
 * "40+", not "30+").
 */
const THRESHOLDS = [700, 500, 300, 200, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

/** Past a thousand the steps are hundreds: 1097 → 1000+, 1111 → 1100+, 2350 → 2300+. */
const HUNDREDS_FROM = 1000;

/** The threshold to show as "N+", or null below the smallest one (then show the count). */
export function roundedThreshold(count: number): number | null {
  if (count >= HUNDREDS_FROM) return Math.floor(count / 100) * 100;
  return THRESHOLDS.find((threshold) => count >= threshold) ?? null;
}
