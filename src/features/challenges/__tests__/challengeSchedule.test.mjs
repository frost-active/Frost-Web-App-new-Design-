import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduledChallengeDay } from '../services/challengeSchedule.ts';

test('scheduled day counts active calendar days, not leaderboard completions', () => {
  assert.equal(scheduledChallengeDay('2026-10-19', 'UTC', ['mon', 'wed', 'fri'], 6, new Date('2026-10-23T12:00:00Z')), 3);
  assert.equal(scheduledChallengeDay('2026-10-19', 'UTC', ['mon', 'wed', 'fri'], 6, new Date('2026-10-24T12:00:00Z')), 3);
});

test('scheduled day honors the challenge timezone and stays within its duration', () => {
  const instant = new Date('2026-10-19T01:00:00Z');
  assert.equal(scheduledChallengeDay('2026-10-19', 'America/Los_Angeles', [], 21, instant), 0);
  assert.equal(scheduledChallengeDay('2026-10-19', 'Asia/Kolkata', [], 2, instant), 1);
  assert.equal(scheduledChallengeDay('2026-10-19', 'UTC', [], 2, new Date('2026-10-25T12:00:00Z')), 2);
});
