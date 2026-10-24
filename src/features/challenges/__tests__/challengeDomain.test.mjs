import assert from 'node:assert/strict';
import test from 'node:test';
import { computeEndDate, getChallengeScheduleError, isChallengeableHabit, isValidChallengeHabitDraft } from '../services/challengeRules.ts';
import { buildChallengeDeviceJson, buildChallengeDeviceJsonForChallenges, syncChallengeToDevice } from '../services/challengeDeviceSync.ts';
import { calculateStanding, rankStandings } from '../services/ranking.ts';
import { deriveHabits } from '../../../components/configure/store.ts';
import { formatChallengeActiveDays, formatChallengeCueTimes, formatChallengeDate } from '../services/challengePresentation.ts';

test('formats challenge dates without timezone shifts and formats cue times clearly', () => {
  assert.equal(formatChallengeDate('2026-10-06'), 'Oct 6, 2026');
  assert.equal(formatChallengeDate('2026-10-28'), 'Oct 28, 2026');
  assert.equal(formatChallengeDate('2026-02-30'), '2026-02-30');
  assert.equal(formatChallengeCueTimes([{ h: 0, m: 0 }, { h: 12, m: 5 }, { h: 14, m: 27 }]), '12:00 AM · 12:05 PM · 2:27 PM');
  assert.equal(formatChallengeCueTimes([{ h: 24, m: 0 }]), 'No cue times set');
  assert.equal(formatChallengeActiveDays(['mon', 'wed', 'fri']), 'Monday, Wednesday, Friday');
  assert.equal(formatChallengeActiveDays([]), 'Every day');
  assert.equal(formatChallengeActiveDays(['invalid']), 'No active days set');
});

test('computes an inclusive challenge end date', () => {
  assert.equal(computeEndDate('2026-10-15', 21), '2026-11-04');
  assert.equal(computeEndDate('2026-10-16', 8, ['mon', 'tue', 'wed', 'thu', 'fri']), '2026-10-27');
  assert.equal(computeEndDate('2026-10-17', 1, ['mon', 'tue', 'wed', 'thu', 'fri']), '2026-10-19');
});

test('requires a four-digit calendar year between 0001 and 9999', () => {
  assert.equal(getChallengeScheduleError('10000-10-16', '2026-10-16', [{ h: 23, m: 0 }], 600),
    'Enter a valid start date with a four-digit year from 0001 to 9999.');
  assert.equal(getChallengeScheduleError('0000-10-16', '2026-10-16', [{ h: 23, m: 0 }], 600),
    'Enter a valid start date with a four-digit year from 0001 to 9999.');
  assert.throws(() => computeEndDate('9999-12-31', 2), /on or before December 31, 9999/);
});

test('permits today and rejects cue times already passed today', () => {
  const today = '2026-10-16';
  assert.equal(getChallengeScheduleError('', today, [{ h: 23, m: 0 }], 600), 'Enter a valid start date with a four-digit year from 0001 to 9999.');
  assert.equal(getChallengeScheduleError(today, today, [{ h: 9, m: 59 }], 600), 'For a challenge starting today, choose a cue time later than the current time.');
  assert.equal(getChallengeScheduleError(today, today, [{ h: 10, m: 1 }], 600), null);
  assert.equal(getChallengeScheduleError('2026-10-17', today, [{ h: 8, m: 0 }], 600), null);
  assert.equal(getChallengeScheduleError('2026-10-15', today, [{ h: 23, m: 0 }], 600), 'Choose today or a future date.');
});

test('allows only ordinary custom habits and blocks linked or predefined habits', () => {
  const predefined = ['Hydration', 'Medication', 'Eye break', 'Stretch', 'Walk', 'Meditation', 'Bottle Clean', 'Healing', 'Pomodoro'];
  predefined.forEach((name) => {
    assert.equal(isChallengeableHabit({ type: 'custom', name: name.toUpperCase() }), false);
  });
  assert.equal(isChallengeableHabit({ source: 'custom', name: 'Reading' }), true);
  assert.equal(isChallengeableHabit({ source: 'custom', name: 'Reading', challengeId: 'c1' }), false);
  assert.equal(isChallengeableHabit({ source: 'custom', name: 'Reading', challengeId: 'c1', challengeRole: 'source', challengeStatus: 'completed' }), true);
  assert.equal(isChallengeableHabit({ source: 'custom', name: 'Reading', challengeId: 'c1', challengeRole: 'device', challengeStatus: 'completed' }), false);
  assert.equal(isChallengeableHabit({ source: 'hydration', name: 'Morning water' }), false);
});

test('builds the exact challenge-only device JSON payload', () => {
  const result = buildChallengeDeviceJson({
    habit: {
      habitId: 'habit-1', label: 'Reading a Book', times: [{ h: 14, m: 27 }], days: [], display_ms: 60000,
      text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180,
    },
    startDate: '2026-10-15', endDate: '2026-11-04', deviceEventId: 'custom_002',
  });
  assert.deepEqual(result, {
    _meta: { schema_ver: 6, device: 'FROST' },
    reminders: { custom: { enabled: true, require_ack: true, display_ms: 60000, events: [{
        id: 'custom_002', label: 'Reading a Book', enabled: true, start_date: '2026-10-15', end_date: '2026-11-04',
        display_ms: 60000, days: [], times: [{ h: 14, m: 27 }], text_x: 120, text_y: 100, text_size: 1,
        text_color: 65535, text_align: 1, text_width: 180,
      }] } },
    audio: {},
  });
});

test('keeps each challenge draft schedule and device event ID scoped to its own JSON payload', () => {
  const makeJson = (habitId, label, hour, startDate, deviceEventId) => buildChallengeDeviceJson({
    habit: {
      habitId, label, times: [{ h: hour, m: 15 }], days: ['mon', 'wed'], display_ms: 120000,
      text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180,
    },
    startDate, endDate: '2026-11-04', deviceEventId,
  });

  const morning = makeJson('morning-id', 'Morning focus', 8, '2026-10-15', 'custom_morning');
  const evening = makeJson('evening-id', 'Evening wind-down', 20, '2026-10-16', 'custom_evening');
  const morningEvent = morning.reminders.custom.events[0];
  const eveningEvent = evening.reminders.custom.events[0];

  assert.equal(morningEvent.id, 'custom_morning');
  assert.equal(morningEvent.label, 'Morning focus');
  assert.deepEqual(morningEvent.times, [{ h: 8, m: 15 }]);
  assert.equal(morningEvent.start_date, '2026-10-15');
  assert.equal(eveningEvent.id, 'custom_evening');
  assert.equal(eveningEvent.label, 'Evening wind-down');
  assert.deepEqual(eveningEvent.times, [{ h: 20, m: 15 }]);
  assert.equal(eveningEvent.start_date, '2026-10-16');
});

test('builds one device payload containing all challenge events with distinct IDs', () => {
  const makeInput = (deviceEventId, label) => ({
    habit: {
      habitId: deviceEventId, label, times: [{ h: 19, m: 0 }], days: [], display_ms: 60000,
      text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180,
    },
    startDate: '2026-11-02', endDate: '2026-11-22', deviceEventId,
  });
  const result = buildChallengeDeviceJsonForChallenges([
    makeInput('custom_002', 'Singing'),
    makeInput('custom_003', 'Read a Book'),
  ]);

  assert.deepEqual(result.reminders.custom.events.map(({ id, label }) => [id, label]), [
    ['custom_002', 'Singing'],
    ['custom_003', 'Read a Book'],
  ]);
  assert.throws(() => buildChallengeDeviceJsonForChallenges([
    makeInput('custom_002', 'Singing'),
    makeInput('custom_002', 'Read a Book'),
  ]), /unique device event ID/);
});

test('counts distinct in-window days, resets current streak after a miss, and excludes out-of-window check-ins', () => {
  const standing = calculateStanding(
    { uid: 'u1', displayName: 'User' },
    [
      { day: '2026-10-14', completedAt: 1 },
      { day: '2026-10-15', completedAt: 2 },
      { day: '2026-10-17', completedAt: 3 },
      { day: '2026-10-18', completedAt: 4 },
      { day: '2026-10-20', completedAt: 5 },
    ],
    '2026-10-15', '2026-10-20', '2026-10-20',
  );
  assert.equal(standing.daysCompleted, 4);
  assert.equal(standing.currentStreak, 1);
  assert.equal(standing.longestStreak, 2);
});

test('ranks equal standings together and breaks ties by earlier completion time', () => {
  const rows = rankStandings([
    { uid: 'later', displayName: 'Later', daysCompleted: 2, currentStreak: 1, longestStreak: 2, lastCompletedDay: '2026-10-16', lastCompletedAt: 200 },
    { uid: 'early', displayName: 'Early', daysCompleted: 2, currentStreak: 1, longestStreak: 2, lastCompletedDay: '2026-10-16', lastCompletedAt: 100 },
    { uid: 'tie', displayName: 'Tie', daysCompleted: 2, currentStreak: 1, longestStreak: 2, lastCompletedDay: '2026-10-16', lastCompletedAt: 100 },
  ]);
  assert.deepEqual(rows.map((row) => [row.uid, row.rank]), [['early', 1], ['tie', 1], ['later', 3]]);
});

test('direct challenge sync excludes all existing device events', async () => {
  let sent;
  const bridge = { syncChallengeDevice: async (configuration) => { sent = configuration; } };
  await syncChallengeToDevice(bridge, {
    habit: {
      habitId: 'source', label: 'New challenge', times: [{ h: 9, m: 0 }], days: [], display_ms: 60000,
      text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180,
    },
    startDate: '2026-10-15', endDate: '2026-11-04', deviceEventId: 'custom_003',
  });

  assert.deepEqual(sent.reminders.custom.events.map((event) => event.id), ['custom_003']);
});

test('validates challenge-only custom habit settings', () => {
  const habit = { label: 'Reading', times: [{ h: 9, m: 30 }], days: ['mon', 'wed'], display_ms: 60000 };
  assert.equal(isValidChallengeHabitDraft(habit), true);
  assert.equal(isValidChallengeHabitDraft({ ...habit, label: ' ' }), false);
  assert.equal(isValidChallengeHabitDraft({ ...habit, label: 'Hydration' }), false);
  assert.equal(isValidChallengeHabitDraft({ ...habit, times: [] }), false);
  assert.equal(isValidChallengeHabitDraft({ ...habit, days: ['mon', 'wrong'] }), false);
  assert.equal(isValidChallengeHabitDraft({ ...habit, display_ms: 0 }), false);
});

test('challenge-only setup can sync without a prior Configure schedule', async () => {
  let sent;
  await syncChallengeToDevice({ syncChallengeDevice: async (configuration) => { sent = configuration; } }, {
    habit: {
      habitId: '', label: 'Reading', times: [{ h: 9, m: 30 }], days: ['mon'], display_ms: 120000,
      text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180,
    },
    startDate: '2026-10-17', endDate: '2026-10-23', deviceEventId: 'custom_001',
  });
  assert.deepEqual(sent.reminders.custom.events.map((event) => event.id), ['custom_001']);
  assert.deepEqual(sent.audio, {});
});

test('keeps device-managed challenge habits out of the Configure habit list', () => {
  const custom = {
    k: 'custom', label: 'Habit', color: '--c-custom', on: true, type: 'ev', dur: 1,
    times: [9, 10], gi: [0, 1],
    groups: [
      { id: 'custom_001', name: 'Challenge Reading', times: [9], days: [], challengeRole: 'device' },
      { id: 'custom_002', name: 'Personal Reading', times: [10], days: [] },
    ],
  };
  const habits = deriveHabits({ cats: [custom], syncedIds: ['custom:custom_001', 'custom:custom_002'] }, new Set(), new Set());
  assert.deepEqual(habits.map((habit) => habit.label), ['Personal Reading']);
});