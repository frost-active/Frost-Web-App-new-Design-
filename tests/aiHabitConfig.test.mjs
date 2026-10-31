import assert from 'node:assert/strict';
import test from 'node:test';
import { changedCategories, HabitScheduler, normalizeHabit, PRODUCTION_API_URL, resolveApiUrl } from '../src/components/configure/aiHabitConfig.ts';
import { MyDayStore } from '../src/components/configure/store.ts';
import { defaultConfig } from '../src/config/defaultConfig.ts';

test('uses the production scheduler by default and supports explicit local overrides', () => {
  assert.equal(resolveApiUrl(), PRODUCTION_API_URL);
  assert.equal(resolveApiUrl(' http://127.0.0.1:5000/parse '), 'http://127.0.0.1:5000/parse');
  assert.equal(resolveApiUrl('  '), PRODUCTION_API_URL);
});

test('normalizes times and treats all seven weekdays as every day', () => {
  const habit = normalizeHabit({
    label: ' Read ',
    times: [{ h: 20, m: 0 }, '07:30'],
    days: ['MON', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  });

  assert.equal(habit.label, 'Read');
  assert.deepEqual(habit.times, [{ h: 7, m: 30 }, { h: 20, m: 0 }]);
  assert.deepEqual(habit.days, []);
  assert.equal(habit.streakDays, 21);
});

test('accepts scheduler events that encode a single time as hour and minute fields', () => {
  const habit = normalizeHabit({ label: 'Walk', h: 16, m: 30, enabled: true });

  assert.deepEqual(habit.times, [{ h: 16, m: 30 }]);
});

test('detects changed predefined reminder categories in the scheduler response', () => {
  const baseline = structuredClone(defaultConfig);
  baseline.reminders.custom.enabled = false;
  baseline.reminders.custom.events = [];
  const updated = structuredClone(baseline);
  updated.reminders.hydration.mode = 'absolute';
  updated.reminders.hydration.abs.times = [{ h: 8, m: 0 }];
  updated.reminders.eye.enabled = false;
  updated.reminders.medication.enabled = true;
  updated.bottle_clean.hour = 19;
  updated.audio.healing_schedules[0].start_time = '12:00';
  updated.pomodoro.enabled = false;

  assert.deepEqual(
    changedCategories(baseline, updated),
    ['water', 'meds', 'eye', 'clean', 'healing', 'pomodoro'],
  );
});

test('filters unrelated scheduler defaults out of the requested preset changes', async () => {
  const updated = structuredClone(defaultConfig);
  updated.reminders.hydration = {
    enabled: true,
    start_date: '2026-10-29',
    end_date: '2027-10-29',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    abs: { times: [{ h: 8, m: 0 }, { h: 10, m: 0 }] },
    display_ms: 60000,
    require_ack: true,
  };
  updated.reminders.medication.enabled = true;
  updated.bottle_clean = {
    enabled: true,
    start_date: '2026-10-29',
    end_date: '2026-11-05',
    interval_days: 1,
    time: { h: 18, m: 0 },
    display_ms: 60000,
    require_ack: true,
  };
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: updated }) }),
  });

  const result = await scheduler.send('Change hydration to every 2 hours');
  assert.equal(result.status, 'scheduled');
  assert.deepEqual(result.changedCategories, ['water']);
});

test('applies only the first requested preset when the response normalizes other categories', async () => {
  const updated = structuredClone(defaultConfig);
  updated.reminders.medication.enabled = true;
  updated.reminders.medication.medicines = [{ id: 'med_001', name: 'Vitamin', times: [{ h: 8, m: 0 }] }];
  updated.reminders.hydration.enabled = true;
  updated.reminders.hydration.abs.times = [{ h: 8, m: 0 }];
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: updated }) }),
  });

  const result = await scheduler.send('Schedule medication at 8am with water and a 14-day streak');
  assert.equal(result.status, 'scheduled');
  assert.deepEqual(result.changedCategories, ['meds']);
  assert.equal(result.requestedStreakDays, 14);
});

test('keeps an unknown named habit custom and ignores normalized preset changes', async () => {
  const updated = structuredClone(defaultConfig);
  updated.reminders.custom.enabled = true;
  updated.reminders.custom.events = [{
    label: 'Reading',
    times: [{ h: 21, m: 0 }],
    days: [],
    start_date: '2026-10-29',
    end_date: '2026-11-18',
    enabled: true,
  }];
  updated.reminders.medication.enabled = true;
  updated.bottle_clean.start_date = '2026-10-29';
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: updated }) }),
  });

  const result = await scheduler.send('Add a Reading habit at 9pm with streak is 12 days');
  assert.equal(result.status, 'scheduled');
  assert.deepEqual(result.changedCategories, ['custom']);
  assert.equal(result.requestedStreakDays, 12);
  assert.equal(result.changes.added[0].streakDays, 12);
});

test('preserves the intended habit and exact streak across a scheduler follow-up', async () => {
  const updated = structuredClone(defaultConfig);
  updated.reminders.hydration.enabled = true;
  updated.reminders.hydration.days = ['mon', 'tue', 'wed', 'thu', 'fri'];
  updated.reminders.hydration.start_date = '2026-10-29';
  updated.reminders.hydration.end_date = '2026-11-27';
  updated.reminders.medication.enabled = true;
  const responses = [
    { reply: 'Which days should I use?', needs_input: true, pending: { kind: 'days' } },
    { data: updated, summary: ['Hydration scheduled on weekdays.'] },
  ];
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => responses.shift() }),
  });

  const question = await scheduler.send('Set hydration on a 2-hour interval');
  assert.equal(question.status, 'question');
  const result = await scheduler.send('Weekdays, with a streak of 14 days');
  assert.equal(result.status, 'scheduled');
  assert.deepEqual(result.changedCategories, ['water']);
  assert.equal(result.requestedStreakDays, 14);
});

test('applies requested weekdays and exact streak to the returned preset configuration', async () => {
  const updated = structuredClone(defaultConfig);
  updated.reminders.walk.enabled = true;
  updated.reminders.walk.days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  updated.reminders.walk.start_date = '2026-10-29';
  updated.reminders.walk.end_date = '2027-10-29';
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: updated }) }),
  });

  const result = await scheduler.send('Set Walk active days Monday to Friday and streak days to 14');
  assert.equal(result.status, 'scheduled');
  assert.deepEqual(result.changedCategories, ['walk']);
  assert.deepEqual(result.requestedActiveDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.deepEqual(result.configuration.reminders.walk.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(result.requestedStreakDays, 14);
});

test('applies selected active days to only the new custom habit', async () => {
  const existing = structuredClone(defaultConfig);
  existing.reminders.custom.enabled = true;
  existing.reminders.custom.events = [
    { id: 'custom_001', label: 'Existing', enabled: true, h: 8, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
  ];
  const updated = structuredClone(existing);
  updated.reminders.custom.events.push(
    { id: 'custom_002', label: 'Reading', enabled: true, h: 21, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
    { id: 'custom_003', label: 'Other', enabled: true, h: 9, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
  );
  const responses = [{ data: existing }, { data: updated }];
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => responses.shift() }),
  });

  await scheduler.send('Add an Existing habit at 8am');
  const result = await scheduler.send('Add a Reading habit on Mondays and Thursdays with a 10-day streak');
  assert.equal(result.status, 'scheduled');
  assert.deepEqual(result.changedCategories, ['custom']);
  assert.deepEqual(result.configuration.reminders.custom.events[0].days, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  assert.deepEqual(result.configuration.reminders.custom.events[1].days, ['mon', 'thu']);
  assert.deepEqual(result.configuration.reminders.custom.events[2].days, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  assert.deepEqual(result.changes.added.map((habit) => habit.label), ['Reading']);
  assert.deepEqual(result.changes.added[0].days, ['mon', 'thu']);
  assert.equal(result.changes.added[0].streakDays, 10);
});

test('updates active days and streak for only the named existing custom habit', async () => {
  const first = structuredClone(defaultConfig);
  first.reminders.custom.enabled = true;
  first.reminders.custom.events = [
    { id: 'custom_001', label: 'Reading', enabled: true, h: 21, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start_date: '2026-10-29', end_date: '2027-10-29' },
    { id: 'custom_002', label: 'Stretch more', enabled: true, h: 8, m: 0, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start_date: '2026-10-29', end_date: '2027-10-29' },
  ];
  const second = structuredClone(first);
  const responses = [{ data: first }, { data: second }];
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => responses.shift() }),
  });

  await scheduler.send('Add Reading habit at 9pm');
  const result = await scheduler.send('Set Reading active days to Saturdays and Sundays, streak length 8');
  assert.deepEqual(result.changedCategories, ['custom']);
  assert.deepEqual(result.configuration.reminders.custom.events[0].days, ['sat', 'sun']);
  assert.deepEqual(result.configuration.reminders.custom.events[1].days, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  assert.equal(result.changes.updated.length, 1);
  assert.equal(result.changes.updated[0].label, 'Reading');
  assert.deepEqual(result.changes.updated[0].days, ['sat', 'sun']);
  assert.equal(result.changes.updated[0].streakDays, 8);
});

test('retains explicit active days through a scheduler follow-up', async () => {
  const updated = structuredClone(defaultConfig);
  updated.reminders.meditation.days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const responses = [
    { reply: 'How long should the session be?', needs_input: true, pending: { kind: 'duration' } },
    { data: updated, summary: ['Meditation scheduled.'] },
  ];
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => responses.shift() }),
  });

  assert.equal((await scheduler.send('Set Meditation on weekends')).status, 'question');
  const result = await scheduler.send('30 minutes, streak length 8');
  assert.deepEqual(result.changedCategories, ['meditation']);
  assert.deepEqual(result.configuration.reminders.meditation.days, ['sat', 'sun']);
  assert.deepEqual(result.requestedActiveDays, ['sat', 'sun']);
  assert.equal(result.requestedStreakDays, 8);
});

test('writes the requested preset streak length to its active-day schedule window', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { setInterval: () => 1, clearInterval: () => {} };
  const windows = [];
  const view = {
    today: '2026-10-29',
    cats: [{ k: 'water', label: 'Hydration', on: true, type: 'win', dur: 1, times: [8], days: [1, 3, 5] }],
    pomo: { focus: 25, brk: 5, cycles: 4 },
    synced: false,
    syncedIds: null,
    restoreToken: 0,
    syncedStreakDays: {},
    streakWindows: { water: { start: '2026-10-29', end: '2026-11-27' } },
    ackToday: {},
    ackHistory: {},
  };
  const bridge = {
    getView: () => view,
    registerHabitIds: () => {},
    markAdded: () => {},
    subscribe: () => () => {},
    applyAiSchedule: () => [{ id: 'water', streakDays: 21 }],
    setStreakWindow: (id, start, end) => windows.push({ id, start, end }),
  };

  try {
    const store = new MyDayStore(bridge, 'ai-streak-test');
    assert.equal(store.applyAiSchedule({}, ['water'], 14), true);
    assert.deepEqual(windows, [{ id: 'water', start: '2026-10-29', end: '2026-11-30' }]);
    store.dispose();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('derives streak length from the active days in a finite schedule window', () => {
  const habit = normalizeHabit({
    label: 'Run',
    times: '06:15',
    days: ['mon', 'wed', 'fri'],
    start_date: '2026-10-26',
    end_date: '2026-10-30',
  });

  assert.equal(habit.streakDays, 3);
});

test('ignores malformed dates instead of using them as a streak start', () => {
  const habit = normalizeHabit({
    label: 'Read',
    times: '21:00',
    start_date: '2026-02-31',
    end_date: '2026-03-31',
  });

  assert.equal(habit.start_date, null);
  assert.equal(habit.streakDays, 21);
});

test('uses the scheduler endpoint, carries pending questions and updates its schedule', async () => {
  const requests = [];
  const updatedConfig = structuredClone(defaultConfig);
  updatedConfig.reminders.custom.enabled = true;
  updatedConfig.reminders.custom.events = [
    { label: 'Empty template', times: [], days: [], enabled: true },
    {
      label: 'Read',
      times: [{ h: 21, m: 0 }],
      days: ['mon', 'wed'],
      start_date: '2026-10-26',
      end_date: '2026-11-25',
      enabled: true,
    },
  ];
  const responses = [
    { reply: 'Which days?', needs_input: true, pending: { kind: 'days' } },
    {
      data: updatedConfig,
      summary: ['Read added for Monday and Wednesday.'],
    },
  ];
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, status: 200, json: async () => responses.shift() };
    },
  });

  const question = await scheduler.send('Add a reading habit');
  assert.equal(question.status, 'question');
  assert.equal(question.reply, 'Which days?');

  const scheduled = await scheduler.send('Monday and Wednesday with a 30-day streak');
  assert.equal(requests[0].url, 'https://scheduler.test/parse');
  assert.equal(requests[0].body.current_config.reminders.custom.enabled, false);
  assert.deepEqual(requests[0].body.current_config.reminders.custom.events, []);
  assert.deepEqual(requests[1].body.pending, { kind: 'days' });
  assert.equal(scheduled.status, 'scheduled');
  assert.equal(scheduled.changes.added[0].label, 'Read');
  assert.equal(scheduled.changes.added[0].streakDays, 30);
  assert.equal(scheduled.changes.added.length, 1);
  assert.deepEqual(scheduler.habits[0].days, ['mon', 'wed']);
  assert.deepEqual(scheduled.changedCategories, ['custom']);
});

test('returns useful network errors without treating the request as successful', async () => {
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => { throw new Error('offline'); },
  });

  const result = await scheduler.send('Add reading at 9pm');
  assert.equal(result.status, 'error');
  assert.equal(result.kind, 'network');
  assert.match(result.error, /Could not connect.*scheduler\.test/);
});

test('rejects malformed scheduler response bodies', async () => {
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => null }),
  });

  const result = await scheduler.send('Add a habit');
  assert.equal(result.status, 'error');
  assert.equal(result.kind, 'parse');
});

test('reports scheduler HTTP failures as backend errors with their status code', async () => {
  const scheduler = new HabitScheduler({
    apiUrl: 'https://scheduler.test/parse',
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad request' }),
    }),
  });

  const result = await scheduler.send('Add a habit');
  assert.equal(result.status, 'error');
  assert.equal(result.kind, 'backend');
  assert.match(result.error, /HTTP 400.*Bad request/);
});
