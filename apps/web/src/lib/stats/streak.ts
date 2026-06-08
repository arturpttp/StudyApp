function utcDayKey(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeStreak(dates: Date[], now: Date): number {
  if (dates.length === 0) return 0;

  const days = new Set<number>();
  for (const d of dates) days.add(utcDayKey(d));

  let cursor = utcDayKey(now);
  if (!days.has(cursor)) return 0;

  let count = 1;
  while (true) {
    cursor -= 24 * 60 * 60 * 1000;
    if (days.has(cursor)) count++;
    else break;
  }
  return count;
}
