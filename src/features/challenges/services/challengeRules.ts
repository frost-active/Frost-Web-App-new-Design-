import { MAX_DURATION_DAYS, MAX_INVITEES, MIN_CUSTOM_DURATION_DAYS, MIN_LEAD_DAYS, PREDEFINED_HABIT_NAMES } from '../constants.ts';
import type { ChallengeHabitDraft } from '../types.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PREDEFINED_NAMES = new Set(PREDEFINED_HABIT_NAMES.map((name) => name.toLocaleLowerCase('en-US')));
const CUSTOM_MARKERS = new Set(['custom', 'custom_habit', 'user_custom']);
const HABIT_DAYS = new Set(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

export type ChallengeableHabit = {
  id?: string;
  habitId?: string;
  name?: string;
  label?: string;
  type?: string;
  source?: string;
  category?: string;
  k?: string;
  challengeId?: string | null;
  challengeRole?: 'source' | 'device';
  challengeStatus?: 'pending' | 'active' | 'completed' | 'cancelled';
};

export function isChallengeableHabit(value: unknown): value is ChallengeableHabit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const habit = value as ChallengeableHabit;
  if (habit.challengeId && (habit.challengeRole !== 'source' || !['completed', 'cancelled'].includes(habit.challengeStatus || ''))) return false;

  const name = (habit.name ?? habit.label ?? '').trim().toLocaleLowerCase('en-US');
  if (PREDEFINED_NAMES.has(name)) return false;

  const markers = [habit.type, habit.source, habit.category, habit.k]
    .filter((marker): marker is string => typeof marker === 'string')
    .map((marker) => marker.trim().toLocaleLowerCase('en-US'));
  if (markers.some((marker) => CUSTOM_MARKERS.has(marker))) return true;
  if (markers.length) return false;
  return Boolean(name) && !PREDEFINED_NAMES.has(name);
}

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return false;
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function computeEndDate(startDate: string, durationDays: number, activeDays: readonly string[] = []): string {
  if (!isValidISODate(startDate)) throw new Error('Choose a valid challenge start date.');
  if (!Number.isInteger(durationDays) || durationDays < MIN_CUSTOM_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) {
    throw new Error(`Challenge duration must be between ${MIN_CUSTOM_DURATION_DAYS} and ${MAX_DURATION_DAYS} days.`);
  }
  if (activeDays.some((day) => !HABIT_DAYS.has(day)) || new Set(activeDays).size !== activeDays.length) {
    throw new Error('Choose valid active days.');
  }
  const selectedDays = new Set(activeDays.length ? activeDays : [...HABIT_DAYS]);
  const week = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const end = new Date(`${startDate}T00:00:00.000Z`);
  let scheduledDays = 0;
  while (scheduledDays < durationDays) {
    if (selectedDays.has(week[end.getUTCDay()])) scheduledDays += 1;
    if (scheduledDays < durationDays) end.setUTCDate(end.getUTCDate() + 1);
  }
  const endDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  if (!isValidISODate(endDate)) throw new Error('Challenge end date must be on or before December 31, 9999.');
  return endDate;
}

export function isValidInviteeCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= MAX_INVITEES;
}

export function meetsMinimumLead(startDate: string, serverToday: string): boolean {
  if (!isValidISODate(startDate) || !isValidISODate(serverToday)) return false;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const today = new Date(`${serverToday}T00:00:00.000Z`);
  today.setUTCDate(today.getUTCDate() + MIN_LEAD_DAYS);
  return start >= today;
}

export function getChallengeScheduleError(
  startDate: string,
  serverToday: string,
  times: readonly { h: number; m: number }[],
  currentMinuteOfDay: number | null,
): string | null {
  if (!isValidISODate(startDate)) return 'Enter a valid start date with a four-digit year from 0001 to 9999.';
  if (!isValidISODate(serverToday) || startDate < serverToday) return 'Choose today or a future date.';
  if (startDate === serverToday && currentMinuteOfDay !== null
    && times.some(({ h, m }) => h * 60 + m <= currentMinuteOfDay)) {
    return 'For a challenge starting today, choose a cue time later than the current time.';
  }
  return null;
}

export function isValidChallengeHabitDraft(value: ChallengeHabitDraft): boolean {
  return isChallengeableHabit({ type: 'custom', name: value.label })
    && value.label.trim().length > 0
    && value.label.trim().length <= 20
    && value.times.length >= 1
    && value.times.length <= 12
    && value.times.every((time) => Number.isInteger(time.h) && time.h >= 0 && time.h <= 23
      && Number.isInteger(time.m) && time.m >= 0 && time.m <= 59)
    && value.days.every((day) => HABIT_DAYS.has(day))
    && new Set(value.days).size === value.days.length
    && Number.isInteger(value.display_ms)
    && value.display_ms >= 60000
    && value.display_ms <= 3600000;
}