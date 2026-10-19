export function formatChallengeDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.toISOString().slice(0, 10) !== value) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatChallengeCueTimes(times: readonly { h: number; m: number }[]): string {
  const formatted = times.flatMap(({ h, m }) => {
    if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) return [];
    const hour = h % 12 || 12;
    return [`${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`];
  });

  return formatted.length ? formatted.join(' · ') : 'No cue times set';
}

export function formatChallengeActiveDays(days: readonly string[]): string {
  if (!days.length) return 'Every day';

  const weekdayNames: Record<string, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  };
  const formatted = days.flatMap((day) => weekdayNames[day] ? [weekdayNames[day]] : []);

  return formatted.length ? formatted.join(', ') : 'No active days set';
}