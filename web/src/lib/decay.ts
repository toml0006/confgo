/**
 * Continuous glow in [0, 1] based on how recently a conference occurred.
 *   - 1.0 while the conference is ongoing
 *   - ~0.85 within the last month
 *   - ~0.35 within the last year
 *   - fades toward 0 past ~2 years
 *   - near-future conferences also glow (slightly less than ongoing)
 */
export function conferenceGlow(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const t = now.getTime();

  if (t >= start && t <= end) return 1;

  const DAY = 86_400_000;
  if (t < start) {
    // future: bright as it approaches
    const days = (start - t) / DAY;
    if (days < 30) return 0.9;
    if (days < 180) return 0.7;
    if (days < 365) return 0.5;
    return 0.3;
  }

  // past: exponential-ish decay
  const days = (t - end) / DAY;
  if (days < 30) return 0.85;
  if (days < 180) return 0.6;
  const years = days / 365;
  return Math.max(0.05, 0.45 * Math.exp(-years * 0.9));
}

export function isPast(endDate: string, now: Date = new Date()): boolean {
  return new Date(endDate).getTime() < now.getTime();
}

export function isFuture(startDate: string, now: Date = new Date()): boolean {
  return new Date(startDate).getTime() > now.getTime();
}
