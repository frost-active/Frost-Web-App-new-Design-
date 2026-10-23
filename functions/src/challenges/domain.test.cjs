const assert = require('node:assert/strict');
const test = require('node:test');
const { allocateCustomId, calculateStanding, canAcceptChallenge, chooseCustomId, computeEndDate, dateInTimezone, isChallengeableEvent, isISODate, lifecycleAction, meetsLead, minuteInTimezone, rankStandings } = require('./domain');

test('allocates a custom ID beyond device events and reserved challenge habit IDs', () => {
  assert.equal(allocateCustomId([{ id: 'custom_001' }], ['custom_002']), 'custom_003');
  assert.equal(allocateCustomId([{ id: 'custom_008' }], ['custom_010']), 'custom_011');
  assert.equal(chooseCustomId([{ id: 'custom_001' }], ['custom_002'], 'custom_003'), 'custom_003');
  assert.equal(chooseCustomId([{ id: 'custom_001' }], ['custom_002'], 'custom_002'), 'custom_003');
  assert.equal(chooseCustomId([{ id: 'custom_001' }], ['custom_002'], 'custom_preview'), 'custom_003');
});

test('computes inclusive end dates and server-local timezone dates', () => {
  assert.equal(computeEndDate('2026-10-15', 21), '2026-11-04');
  assert.equal(computeEndDate('2026-10-16', 1), '2026-10-16');
  assert.equal(computeEndDate('2026-10-16', 8, ['mon', 'tue', 'wed', 'thu', 'fri']), '2026-10-27');
  assert.equal(computeEndDate('2026-10-17', 1, ['mon', 'tue', 'wed', 'thu', 'fri']), '2026-10-19');
  assert.equal(dateInTimezone(new Date('2026-10-14T19:00:00.000Z'), 'Asia/Kolkata'), '2026-10-15');
  assert.equal(minuteInTimezone(new Date('2026-10-16T04:00:00.000Z'), 'Asia/Kolkata'), 570);
  assert.equal(meetsLead('2026-10-16', '2026-10-15'), true);
  assert.equal(meetsLead('2026-10-15', '2026-10-15'), true);
  assert.equal(meetsLead('2026-10-14', '2026-10-15'), false);
});

test('validates date years and rejects challenge end dates beyond four-digit years', () => {
  assert.equal(isISODate('0001-01-01'), true);
  assert.equal(isISODate('0000-01-01'), false);
  assert.equal(isISODate('10000-01-01'), false);
  assert.throws(() => computeEndDate('9999-12-31', 2), /on or before December 31, 9999/);
});

test('rejects predefined and already linked habit events', () => {
  assert.equal(isChallengeableEvent({ id: 'custom_001', label: 'hYdRaTiOn' }, null), false);
  assert.equal(isChallengeableEvent({ id: 'custom_001', label: 'Reading' }, { challengeId: 'c1' }), false);
  assert.equal(isChallengeableEvent({ id: 'custom_001', label: 'Reading' }, { challengeId: 'c1', challengeRole: 'source', challengeStatus: 'completed' }), true);
  assert.equal(isChallengeableEvent({ id: 'custom_001', label: 'Reading' }, { challengeId: 'c1', challengeRole: 'device', challengeStatus: 'completed' }), false);
  assert.equal(isChallengeableEvent({ id: 'custom_001', label: 'Reading' }, null), true);
});

test('recomputes in-range check-ins, resets a missed current streak, and shares exact ties', () => {
  const first = calculateStanding({ uid: 'a', displayName: 'A' }, [
    { day: '2026-10-14', completedAt: 1 },
    { day: '2026-10-15', completedAt: 2 },
    { day: '2026-10-17', completedAt: 3 },
  ], '2026-10-15', '2026-10-21', '2026-10-17');
  assert.equal(first.daysCompleted, 2);
  assert.equal(first.currentStreak, 1);
  assert.equal(first.longestStreak, 1);
  const ranked = rankStandings([
    { ...first, uid: 'a', lastCompletedAt: 100 },
    { ...first, uid: 'b', lastCompletedAt: 100 },
  ]);
  assert.deepEqual(ranked.map((row) => row.rank), [1, 1]);
});

test('lifecycle preserves legacy participant thresholds and supports host-only challenges', () => {
  const pending = { status: 'pending', startDate: '2026-10-15', endDate: '2026-11-04' };
  assert.equal(lifecycleAction(pending, '2026-10-14', 2), null);
  assert.equal(lifecycleAction(pending, '2026-10-15', 2), 'activate');
  assert.equal(lifecycleAction(pending, '2026-10-15', 1), 'cancel');
  assert.equal(lifecycleAction({ ...pending, creatorParticipates: true }, '2026-10-15', 1), 'cancel');
  assert.equal(lifecycleAction({ ...pending, creatorParticipates: true }, '2026-10-15', 2), 'activate');
  assert.equal(lifecycleAction({ ...pending, creatorParticipates: false }, '2026-10-15', 0), 'cancel');
  assert.equal(lifecycleAction({ ...pending, creatorParticipates: false }, '2026-10-15', 1), 'activate');
  const active = { ...pending, status: 'active' };
  assert.equal(lifecycleAction(active, '2026-11-04', 2), null);
  assert.equal(lifecycleAction(active, '2026-11-05', 2), 'complete');
  assert.equal(lifecycleAction({ ...active, status: 'completed' }, '2026-11-06', 2), null);
  assert.equal(lifecycleAction({ ...pending, status: 'cancelled' }, '2026-10-16', 1), null);
});

test('same-day invites remain acceptable until the first scheduled cue and then activate', () => {
  const sameDay = {
    status: 'pending', startDate: '2026-10-16', endDate: '2026-10-22',
    habit: { days: [], times: [{ h: 9, m: 0 }, { h: 14, m: 0 }] },
  };
  assert.equal(canAcceptChallenge(sameDay, '2026-10-16', 8 * 60 + 59), true);
  assert.equal(canAcceptChallenge(sameDay, '2026-10-16', 9 * 60), false);
  assert.equal(canAcceptChallenge(sameDay, '2026-10-17', 8 * 60), false);
  assert.equal(lifecycleAction(sameDay, '2026-10-16', 2, 8 * 60 + 59), null);
  assert.equal(lifecycleAction(sameDay, '2026-10-16', 2, 9 * 60), 'activate');
  assert.equal(lifecycleAction(sameDay, '2026-10-16', 1, 9 * 60), 'cancel');
});

test('same-day acceptance stays open when the start date is not an active habit day', () => {
  const sameDay = {
    status: 'pending', startDate: '2026-10-16', endDate: '2026-10-22',
    habit: { days: ['mon'], times: [{ h: 9, m: 0 }] },
  };
  assert.equal(canAcceptChallenge(sameDay, '2026-10-16', 23 * 60 + 59), true);
  assert.equal(lifecycleAction(sameDay, '2026-10-16', 2, 23 * 60 + 59), null);
  assert.equal(lifecycleAction(sameDay, '2026-10-17', 2, 0), 'activate');
});