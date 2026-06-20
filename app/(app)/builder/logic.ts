// Pure, framework-free helpers for the Session Builder so the tricky
// arithmetic can be unit-tested without a browser.

/** Round to the nearest 0.5, with a floor of 0.5 (30-second granularity). */
export function roundHalf(n: number): number {
  return Math.max(0.5, Math.round(n * 2) / 2);
}

/**
 * Scale every item's `duration_minutes` proportionally so the distribution is
 * preserved relative to `newTotal`. If the current sum is 0, split evenly.
 */
export function redistributeDurations<T extends { duration_minutes: number }>(
  items: T[],
  newTotal: number
): T[] {
  if (items.length === 0 || newTotal <= 0) return items;
  const currentTotal = items.reduce((s, b) => s + b.duration_minutes, 0);
  if (currentTotal <= 0) {
    const each = roundHalf(newTotal / items.length);
    return items.map((b) => ({ ...b, duration_minutes: each }));
  }
  return items.map((b) => ({
    ...b,
    duration_minutes: roundHalf((b.duration_minutes / currentTotal) * newTotal),
  }));
}
