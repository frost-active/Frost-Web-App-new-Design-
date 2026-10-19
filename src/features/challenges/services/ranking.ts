import type { ChallengeCheckin, ChallengeStanding } from '../types.ts';
import { isValidISODate } from './challengeRules.ts';

export type StandingParticipant = { uid: string; displayName: string };

export function calculateStanding(
  participant: StandingParticipant,
  checkins: readonly ChallengeCheckin[],
  startDate: string,
  endDate: string,
  today: string,
): Omit<ChallengeStanding, 'rank'> {
  if (![startDate, endDate, today].every(isValidISODate) || endDate < startDate) {
    throw new Error('Challenge dates are invalid.');
  }

  const completedByDay = new Map<string, number>();
  checkins.forEach((checkin) => {
    if (isValidISODate(checkin.day) && checkin.day >= startDate && checkin.day <= endDate) {
      const previous = completedByDay.get(checkin.day);
      if (previous === undefined || checkin.completedAt < previous) completedByDay.set(checkin.day, checkin.completedAt);
    }
  });

  const days = [...completedByDay.keys()].sort();
  let currentStreak = 0;
  const throughDay = today < endDate ? today : endDate;
  for (let cursor = throughDay; cursor >= startDate && completedByDay.has(cursor); cursor = addDays(cursor, -1)) currentStreak += 1;

  let longestStreak = 0, streak = 0, previousDay: string | null = null;
  days.forEach((day) => {
    streak = previousDay && addDays(previousDay, 1) === day ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    previousDay = day;
  });

  const lastCompletedDay = days.at(-1) ?? null;
  return {
    uid: participant.uid,
    displayName: participant.displayName,
    daysCompleted: days.length,
    currentStreak,
    longestStreak,
    lastCompletedDay,
    lastCompletedAt: lastCompletedDay ? completedByDay.get(lastCompletedDay) ?? null : null,
  };
}

export function rankStandings(rows: readonly Omit<ChallengeStanding, 'rank'>[]): ChallengeStanding[] {
  const sorted = rows.map((row) => ({ ...row })).sort((left, right) =>
    right.daysCompleted - left.daysCompleted
    || right.longestStreak - left.longestStreak
    || (left.lastCompletedAt ?? Number.POSITIVE_INFINITY) - (right.lastCompletedAt ?? Number.POSITIVE_INFINITY),
  );

  let rank = 0;
  let previous: ChallengeStanding | undefined;
  return sorted.map((row, index) => {
    const sameRank = previous
      && row.daysCompleted === previous.daysCompleted
      && row.longestStreak === previous.longestStreak
      && row.lastCompletedAt === previous.lastCompletedAt;
    if (!sameRank) rank = index + 1;
    const ranked = { ...row, rank };
    previous = ranked;
    return ranked;
  });
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}