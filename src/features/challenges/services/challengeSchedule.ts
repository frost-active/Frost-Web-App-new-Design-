const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function scheduledChallengeDay(
  startDate: string,
  timezone: string,
  activeDays: readonly string[],
  durationDays: number,
  now = new Date(),
): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(durationDays) || durationDays < 1) return 0;
  const today = dateInTimezone(now, timezone);
  if (today < startDate) return 0;

  const active = new Set(activeDays.length ? activeDays : WEEKDAYS);
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  let scheduledDay = 0;
  while (`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}` <= today
    && scheduledDay < durationDays) {
    if (active.has(WEEKDAYS[cursor.getUTCDay()])) scheduledDay += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return scheduledDay;
}
