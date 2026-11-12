import assert from 'node:assert/strict';
import test from 'node:test';
import { localDateISO, withCurrentSyncStartDates } from '../src/utils/deviceSyncDates.ts';

process.env.TZ = 'Asia/Kolkata';

test('uses the local date at 00:30 and 23:30 IST', () => {
  assert.equal(localDateISO(new Date('2026-10-14T19:00:00.000Z')), '2026-10-15');
  assert.equal(localDateISO(new Date('2026-10-15T18:00:00.000Z')), '2026-10-15');
});

test('refreshes every habit start date and preserves each configured end date', () => {
  const saved = {
    reminders: {
      hydration: { start_date: '2026-10-07', end_date: '2026-10-27' },
      custom: { events: [
        { label: 'Read', start_date: '2026-10-07', end_date: '2026-10-22' },
        { label: 'Stretch', start_date: '2026-10-09', end_date: '2026-10-30' },
      ] },
    },
  };

  const payload = withCurrentSyncStartDates(saved, '2026-10-15');

  assert.equal(payload.reminders.hydration.start_date, '2026-10-15');
  assert.equal(payload.reminders.hydration.end_date, '2026-10-27');
  assert.deepEqual(payload.reminders.custom.events.map((habit) => habit.start_date), ['2026-10-15', '2026-10-15']);
  assert.deepEqual(payload.reminders.custom.events.map((habit) => habit.end_date), ['2026-10-22', '2026-10-30']);
  assert.equal(saved.reminders.hydration.start_date, '2026-10-07');
});

test('preserves a manually scheduled future date in the sync payload', () => {
  const payload = withCurrentSyncStartDates({
    reminders: { hydration: { start_date: '2026-10-20', end_date: '2026-11-10' } },
  }, '2026-10-15');

  assert.equal(payload.reminders.hydration.start_date, '2026-10-20');
  assert.equal(payload.reminders.hydration.end_date, '2026-11-10');
});

test('uses today when the configured start date is not in the future', () => {
  const payload = withCurrentSyncStartDates({
    reminders: { hydration: { start_date: '2026-10-07', end_date: '2026-10-27' } },
  }, '2026-10-15');

  assert.equal(payload.reminders.hydration.start_date, '2026-10-15');
});

test('rejects expired end dates before producing a sync payload', () => {
  assert.throws(
    () => withCurrentSyncStartDates({ reminders: { hydration: { start_date: '2026-10-07', end_date: '2026-10-14' } } }, '2026-10-15'),
    /end date \(2026-10-14\) is before the start date \(2026-10-15\)/,
  );
});

test('preserves dates and skips validation for disabled habits', () => {
  const saved = {
    reminders: {
      hydration: { enabled: false, start_date: '2026-10-07', end_date: '2026-10-14' },
      custom: {
        enabled: true,
        events: [
          { enabled: false, start_date: '2026-10-07', end_date: '2026-10-14' },
          { enabled: true, start_date: '2026-10-07', end_date: '2026-11-14' },
        ],
      },
    },
  };

  const payload = withCurrentSyncStartDates(saved, '2026-10-15');

  assert.equal(payload.reminders.hydration.start_date, '2026-10-07');
  assert.equal(payload.reminders.hydration.end_date, '2026-10-14');
  assert.equal(payload.reminders.custom.events[0].start_date, '2026-10-07');
  assert.equal(payload.reminders.custom.events[0].end_date, '2026-10-14');
  assert.equal(payload.reminders.custom.events[1].start_date, '2026-10-15');
  assert.equal(saved.reminders.hydration.start_date, '2026-10-07');
});

test('skips validation for habits inside a disabled group', () => {
  const payload = withCurrentSyncStartDates({
    reminders: {
      custom: {
        enabled: false,
        events: [{ enabled: true, start_date: '2026-10-07', end_date: '2026-10-14' }],
      },
    },
  }, '2026-10-15');

  assert.equal(payload.reminders.custom.events[0].start_date, '2026-10-07');
  assert.equal(payload.reminders.custom.events[0].end_date, '2026-10-14');
});

test('preserves fixed dates for device-managed challenge events', () => {
  const payload = withCurrentSyncStartDates({
    reminders: {
      custom: {
        enabled: true,
        events: [
          { id: 'challenge-event-1', label: 'Challenge 1', enabled: true, start_date: '2026-10-01', end_date: '2026-10-21' },
          { id: 'custom_001', label: 'Reading', enabled: true, start_date: '2026-10-01', end_date: '2026-11-21' },
        ],
      },
    },
    ui_meta: {
      custom: [{ id: 'challenge-event-1', challengeRole: 'device', startDate: '2026-10-01', endDate: '2026-10-21' }],
    },
  }, '2026-11-12');

  assert.equal(payload.reminders.custom.events[0].start_date, '2026-10-01');
  assert.equal(payload.reminders.custom.events[0].end_date, '2026-10-21');
  assert.equal(payload.reminders.custom.events[1].start_date, '2026-11-12');
});

test('rejects an end date earlier than a scheduled future start', () => {
  assert.throws(
    () => withCurrentSyncStartDates({ reminders: { hydration: { start_date: '2026-10-20', end_date: '2026-10-19' } } }, '2026-10-15'),
    /end date \(2026-10-19\) is before the start date \(2026-10-20\)/,
  );
});

test('refreshes persisted dates again on a later sync', () => {
  const savedAfterFirstSync = withCurrentSyncStartDates({
    reminders: { hydration: { start_date: '2026-10-07', end_date: '2026-10-27' } },
  }, '2026-10-15');
  const savedAfterSecondSync = withCurrentSyncStartDates(savedAfterFirstSync, '2026-10-18');

  assert.equal(savedAfterFirstSync.reminders.hydration.start_date, '2026-10-15');
  assert.equal(savedAfterSecondSync.reminders.hydration.start_date, '2026-10-18');
  assert.equal(savedAfterSecondSync.reminders.hydration.end_date, '2026-10-27');
});