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
const { default: ChallengeJsonActions } = await import('../components/ChallengeJsonActions.tsx');
const { default: InviteCard } = await import('../components/InviteCard.tsx');

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
    challengeId: 'challenge-1', creatorName: 'Creator', habitLabel: 'Reading', startDate: '2026-10-16', endDate: '2026-11-05',
    habit: { habitId: 'source', label: 'Reading', times: [{ h: 14, m: 0 }], days: ['mon', 'wed', 'fri'], display_ms: 60000, text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180 },
    uid: 'friend', email: 'friend@example.com', displayName: 'Friend', role: 'invitee', status: 'invited', habitId: '',
    deviceSyncStatus: 'pending', invitedAt: null,
  };
  render(createElement(InviteCard, {
    invite, uid: 'friend', deviceConnected: true, deviceMac: 'AA-BB', savedConfig: null, bridge: {},
    onRespond: async (action) => { actions.push(action); },
  }));
  assert.ok(screen.getByText('Creator · Oct 16, 2026 to Nov 5, 2026'));
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