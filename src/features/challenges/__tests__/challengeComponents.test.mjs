import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { default: DeviceGate } = await import('../components/DeviceGate.tsx');
const { default: ChallengeConfigForm } = await import('../components/ChallengeConfigForm.tsx');
const { default: ChallengeHabitForm } = await import('../components/ChallengeHabitForm.tsx');
const { default: ChallengeDial } = await import('../components/ChallengeDial.tsx');
const { default: ChallengeJsonActions } = await import('../components/ChallengeJsonActions.tsx');
const { default: ChallengeDraftRail } = await import('../components/ChallengeDraftRail.tsx');
const { default: InviteCard } = await import('../components/InviteCard.tsx');
const { scrollToChangedChallengeStep } = await import('../services/challengeStepScroll.ts');
const { ptH, R_TICK } = await import('../../../components/configure/format.ts');

test('challenge step scrolling only runs on changes and respects reduced motion', () => {
  const calls = [];
  const target = { scrollIntoView: (options) => calls.push(options) };

  scrollToChangedChallengeStep(1, 1, target, false);
  assert.equal(calls.length, 0);

  scrollToChangedChallengeStep(1, 2, target, false);
  assert.deepEqual(calls[0], { behavior: 'smooth', block: 'nearest', inline: 'nearest' });

  scrollToChangedChallengeStep(2, 3, target, true);
  assert.deepEqual(calls[1], { behavior: 'auto', block: 'nearest', inline: 'nearest' });

  scrollToChangedChallengeStep(2, 3, null, false);
  assert.equal(calls.length, 2);
});

test('challenge draft rail selects independent named drafts and adds another draft', () => {
  const actions = [];
  render(createElement(ChallengeDraftRail, {
    drafts: [{ id: 'draft-a', name: 'Morning focus' }, { id: 'draft-b', name: 'Evening wind-down' }],
    selectedId: 'draft-a',
    onSelect: (id) => actions.push(['select', id]),
    onAdd: () => actions.push(['add']),
    onRemove: (id) => actions.push(['remove', id]),
  }));

  assert.equal(screen.getByRole('heading', { name: 'Your Challenges' }) !== null, true);
  assert.equal(screen.getByRole('button', { name: /Morning focus.*Draft/ }).getAttribute('aria-pressed'), 'true');
  assert.equal(screen.getByRole('button', { name: /Evening wind-down.*Draft/ }).getAttribute('aria-pressed'), 'false');
  fireEvent.click(screen.getByRole('button', { name: /Evening wind-down.*Draft/ }));
  fireEvent.click(screen.getByRole('button', { name: '+ Add challenge' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Evening wind-down draft' }));
  assert.deepEqual(actions, [['select', 'draft-b'], ['add'], ['remove', 'draft-b']]);
  assert.equal(screen.queryByText(/Hydration|Medication|Walk|Meditation/), null);
  cleanup();
});

test('empty challenge dial shows the Configure-style empty face without schedule tracks', () => {
  const view = render(createElement(ChallengeDial, {
    name: '', habitLabel: '', cueTimes: [{ h: 9, m: 0 }], startDate: '', timezone: 'UTC', activeDays: [], durationDays: 0, emptyState: true,
  }));

  assert.ok(screen.getByRole('img', { name: 'No Challenges Yet. ADD ONE ON THE RIGHT' }));
  assert.equal(view.container.querySelector('.cfg-cattrack'), null);
  assert.equal(view.container.querySelector('.cfg-dosetrk'), null);
  assert.equal(view.container.querySelectorAll('.cfg-seg').length, 0);
  assert.equal(view.container.querySelectorAll('.cfg-ticknum').length, 12);
  assert.equal(view.container.querySelectorAll('.cfg-tickline').length, 12);
  assert.ok(view.container.querySelector('.cfg-nowdot'));
  assert.equal(view.container.querySelectorAll('.cfg-ctrName')[0].textContent, 'No Challenges Yet');
  assert.equal(view.container.querySelector('.cfg-ctrSub').textContent, 'ADD ONE ON THE RIGHT');
  cleanup();
});

test('challenge live-time marker is positioned using IST regardless of selected timezone', () => {
  const RealDate = globalThis.Date;
  const fixedTimestamp = new RealDate('2026-10-23T10:00:00.000Z').getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedTimestamp]));
    }
    static now() { return fixedTimestamp; }
  };
  try {
    const view = render(createElement(ChallengeDial, {
      name: 'Reading',
      habitLabel: 'Reading',
      cueTimes: [{ h: 9, m: 0 }],
      startDate: '',
      timezone: 'UTC',
      activeDays: [],
      durationDays: 21,
    }));
    const marker = view.container.querySelector('.challenge-nowdot');
    const indiaTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new RealDate(fixedTimestamp));
    const hour = Number(indiaTime.find((part) => part.type === 'hour').value);
    const minute = Number(indiaTime.find((part) => part.type === 'minute').value);
    const [expectedX, expectedY] = ptH(hour + minute / 60, R_TICK + 7);
    assert.ok(Math.abs(Number(marker.getAttribute('cx')) - expectedX) < 0.01);
    assert.ok(Math.abs(Number(marker.getAttribute('cy')) - expectedY) < 0.01);
    assert.match(marker.getAttribute('class'), /challenge-nowdot/);
    assert.equal(marker.style.fill, 'rgb(255, 255, 255)');
    cleanup();
  } finally {
    globalThis.Date = RealDate;
  }
});

test('device gate appears only when the Frost device is disconnected', () => {
  const disconnected = render(createElement(DeviceGate, { connected: false }));
  assert.match(screen.getByRole('status').textContent, /Connect your Frost device/);
  cleanup();

  render(createElement(DeviceGate, { connected: true }));
  assert.equal(screen.queryByRole('status'), null);
  disconnected.unmount();
  cleanup();
});

test('challenge date form uses the server minimum and computes inclusive end date', () => {
  let selectedStart = '';
  const view = render(createElement(ChallengeConfigForm, {
    startDate: '2026-10-15',
    serverToday: '2026-10-15',
    currentMinuteOfDay: 540,
    times: [{ h: 14, m: 27 }],
    activeDays: [],
    durationDays: 21,
    onStartDate: (value) => { selectedStart = value; },
    onDuration: () => undefined,
  }));

  assert.equal(screen.getByLabelText('Start date').getAttribute('min'), '2026-10-15');
  assert.equal(screen.getByLabelText('Start date').getAttribute('max'), '9999-12-31');
  assert.equal(screen.getByLabelText('Start date').hasAttribute('required'), true);
  assert.equal(screen.getByLabelText('Streak length').getAttribute('min'), '1');
  assert.match(view.container.textContent, /Nov 4, 2026/);
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-20' } });
  assert.equal(selectedStart, '2026-10-20');
  cleanup();
});

test('challenge date preview counts streak days only on selected weekdays', () => {
  const view = render(createElement(ChallengeConfigForm, {
    startDate: '2026-10-16',
    serverToday: '2026-10-16',
    currentMinuteOfDay: 480,
    times: [{ h: 14, m: 0 }],
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    durationDays: 8,
    onStartDate: () => undefined,
    onDuration: () => undefined,
  }));

  assert.match(view.container.textContent, /Oct 27, 2026/);
  cleanup();
});

test('invite card dispatches Accept and Decline actions', async () => {
  const actions = [];
  const invite = {
    challengeId: 'challenge-1', creatorName: 'Creator', name: 'Morning routine', habitLabel: 'Reading', startDate: '2026-10-16', endDate: '2026-11-05',
    durationDays: 15, timezone: 'UTC',
    habit: { habitId: 'source', label: 'Reading', times: [{ h: 14, m: 0 }], days: ['mon', 'wed', 'fri'], display_ms: 60000, text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180 },
    uid: 'friend', email: 'friend@example.com', displayName: 'Friend', role: 'invitee', status: 'invited', habitId: '',
    deviceSyncStatus: 'pending', invitedAt: null,
  };
  render(createElement(InviteCard, {
    invite, uid: 'friend', deviceConnected: true, deviceMac: 'AA-BB', savedConfig: null, bridge: {},
    onRespond: async (action) => { actions.push(action); },
  }));
  assert.ok(screen.getByText('Creator · Oct 16, 2026 to Nov 5, 2026'));
  assert.ok(screen.getByText('Morning routine'));
  assert.ok(screen.getByRole('img', { name: /Reading: Day \d+ of 15/ }));
  assert.equal(document.querySelector('.cfg-ctrName')?.textContent, 'Reading');
  assert.equal(document.querySelectorAll('.cfg-time-node').length, 1);
  assert.match(screen.getByText('15 scheduled days').textContent, /15 scheduled days/);
  assert.ok(screen.getByText('Active days · Monday, Wednesday, Friday'));
  assert.ok(screen.getByText('Cue times · 2:00 PM'));
  assert.ok(screen.getByText(/Preparing the challenge device event ID/));
  assert.equal(screen.getByRole('button', { name: 'View device JSON' }).disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Export JSON' }).disabled, true);
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
  await screen.findByText('Accepted and synced to your device.');
  cleanup();

  render(createElement(InviteCard, {
    invite, uid: 'friend', deviceConnected: true, deviceMac: 'AA-BB', savedConfig: null, bridge: {},
    onRespond: async (action) => { actions.push(action); },
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
  await screen.findByText('Invitation declined.');
  assert.deepEqual(actions, ['accept', 'decline']);
  cleanup();
});

test('challenge habit editor configures custom cues and days without audio controls', () => {
  let value = { label: '', times: [{ h: 9, m: 0 }], days: [], display_ms: 60000 };
  const view = render(createElement(ChallengeHabitForm, { value, onChange: (next) => { value = next; view.rerender(createElement(ChallengeHabitForm, { value, onChange: (nextValue) => { value = nextValue; } })); } }));

  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Reading' } });
  assert.equal(value.label, 'Reading');
  fireEvent.change(screen.getByLabelText('Number of cues'), { target: { value: '2' } });
  assert.equal(value.times.length, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Sat' }));
  assert.equal(value.days.includes('sat'), false);
  assert.equal(screen.queryByText(/audio|upload music/i), null);
  cleanup();
});

test('challenge dial reuses Configure geometry, labeled hour ticks, cue arcs, and challenge-day center', () => {
  const view = render(createElement(ChallengeDial, {
    name: 'Morning Reading',
    habitLabel: 'Read',
    cueTimes: [{ h: 8, m: 0 }, { h: 20, m: 0 }],
    cueDurationMs: 600000,
    startDate: '2026-10-19',
    timezone: 'UTC',
    activeDays: ['mon', 'wed', 'fri'],
    durationDays: 21,
  }));

  const dial = screen.getByRole('img', { name: /Morning Reading: Day \d+ of 21/ });
  assert.equal(dial.getAttribute('viewBox'), '0 0 640 640');
  assert.equal(view.container.querySelectorAll('.cfg-ticknum').length, 12);
  assert.equal(view.container.querySelector('.cfg-ticknum')?.textContent, '12');
  assert.equal(view.container.querySelectorAll('.cfg-seg').length, 2);
  assert.equal(view.container.querySelectorAll('.cfg-time-node').length, 2);
  assert.equal(view.container.querySelector('.cfg-dosetrk') !== null, true);
  assert.match(view.container.querySelector('.cfg-ctrStreak')?.textContent || '', /^Day \d+ of 21$/);
  assert.match(view.container.querySelector('.cfg-ctrSub')?.textContent || '', /OF 21 SCHEDULED DAYS/);
  cleanup();
});

test('challenge draft rings select the matching challenge when activated', () => {
  const selected = [];
  const view = render(createElement(ChallengeDial, {
    name: 'Evening wind-down',
    habitLabel: 'Read',
    cueTimes: [{ h: 20, m: 0 }],
    cueDurationMs: 60000,
    startDate: '',
    timezone: 'UTC',
    activeDays: [],
    durationDays: 21,
    selectedDraftId: 'draft-b',
    draftRings: [
      { id: 'draft-a', name: 'Morning focus', cueTimes: [{ h: 8, m: 0 }], cueDurationMs: 60000 },
      { id: 'draft-b', name: 'Evening wind-down', cueTimes: [{ h: 20, m: 0 }], cueDurationMs: 60000 },
    ],
    onSelectDraft: (id) => selected.push(id),
  }));

  const rings = view.container.querySelectorAll('.cfg-cattrack');
  assert.equal(rings.length, 2);
  assert.equal(screen.getByRole('button', { name: 'Select Morning focus ring' }).getAttribute('tabindex'), '0');
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Select Morning focus ring' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Select Evening wind-down ring' }), { key: 'Enter' });
  assert.deepEqual(selected, ['draft-a', 'draft-b']);
  cleanup();
});

test('challenge JSON disclosure shows the exact payload and offers export', () => {
  const deviceJson = {
    _meta: { schema_ver: 6, device: 'FROST' },
    reminders: { custom: { enabled: true, require_ack: true, display_ms: 60000, events: [{ id: 'custom_004', label: 'Reading' }] } },
    audio: {},
  };
  render(createElement(ChallengeJsonActions, { deviceJson, pendingMessage: 'Not ready', fileName: 'challenge-reading' }));
  fireEvent.click(screen.getByRole('button', { name: 'View device JSON' }));
  assert.match(screen.getByLabelText('Challenge device JSON').textContent, /"schema_ver": 6/);
  assert.match(screen.getByLabelText('Challenge device JSON').textContent, /"id": "custom_004"/);
  assert.doesNotMatch(screen.getByLabelText('Challenge device JSON').textContent, /custom_preview/);
  assert.ok(screen.getByRole('button', { name: 'Export JSON' }));
  cleanup();
});

test('challenge JSON cannot be viewed or exported before a real device event ID is assigned', () => {
  render(createElement(ChallengeJsonActions, {
    deviceJson: null,
    pendingMessage: 'Accept the invite to assign its device event ID.',
    fileName: 'challenge-pending',
  }));
  assert.ok(screen.getByText(/assign its device event ID/));
  assert.equal(screen.getByRole('button', { name: 'View device JSON' }).disabled, true);
  assert.equal(screen.getByRole('button', { name: 'Export JSON' }).disabled, true);
  assert.equal(screen.queryByLabelText('Challenge device JSON'), null);
  cleanup();
});