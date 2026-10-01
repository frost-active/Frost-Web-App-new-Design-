import { clamp, unitFor } from './format';
import type { CfgCategory, CfgGroup, ConfigureBridge, ConfigureView, PomoField } from './types';

/* ============================================================================
   The My day model.
   • The SCHEDULE (times, durations, days, labels, goal, on/off) is read live from
     the device schedule in src/legacy.ts and written back through the bridge.
   • The TRACKER (today's count, streaks, challenges, audio library) is kept here and
     stored in this browser (localStorage), exactly like the My day prototype.
   A "habit" is a device reminder: each category is one habit, except Medication
   (one habit per medicine) and Habit/custom (one per event).
   ============================================================================ */

export const DAYMS = 86400000;
export const FORM_MIN = 1, FORM_MAX = 90, FORM_DEFAULT = 21;
export const MAX_DIAL = 12, MAX_CUES = 12, MED_MAX_DOSES = 3, GLASS_ML = 250;
export const PEERS = ['Aarav', 'Meera', 'Rohit', 'Kavya', 'Nikhil', 'Tara'];

/* ---------- device JSON validity window: driven by each habit's own streak length ---------- */
const isoDate = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = (): string => isoDate(new Date());
/** the date the streak's Nth active day lands on, counting forward from `startISO` (inclusive) over the given active weekdays (0=Sun..6=Sat) */
function streakEndDate(startISO: string, streakDays: number, days: number[]): string {
  const active = days.length ? days : [0, 1, 2, 3, 4, 5, 6];
  let d = new Date(`${startISO}T00:00:00`);
  let count = 0, result = d;
  while (count < streakDays) {
    if (active.includes(d.getDay())) { count++; result = d; }
    if (count < streakDays) d = new Date(d.getTime() + DAYMS);
  }
  return isoDate(result);
}

/** the habits Aura ships with, in the order the "Add a habit" chooser lists them */
export const TEMPLATES = [
  { name: 'Hydration', k: 'water' }, { name: 'Medication', k: 'meds' }, { name: 'Eye break', k: 'eye' },
  { name: 'Stretch', k: 'stretch' }, { name: 'Walk', k: 'walk' }, { name: 'Meditation', k: 'meditation' },
  { name: 'Bottle Clean', k: 'clean' }, { name: 'Healing', k: 'healing' }, { name: 'Pomodoro', k: 'pomodoro' },
] as const;

const UNITS: Record<string, string> = {
  water: 'ml', meds: 'doses', eye: 'breaks', stretch: 'stretches', walk: 'walks', meditation: 'sessions',
  clean: 'rinses', healing: 'sessions', pomodoro: 'sprints', custom: 'times',
};

export type Habit = {
  id: string;
  k: string;
  gid: string | null;
  /** the habit type: Hydration, Medication, Habit … (stable, used for the editor heading) */
  name: string;
  /** a medicine / habit name the user typed ('' for the rest) */
  label: string;
  unit: string;
  /** CSS colour, e.g. var(--c-water) */
  color: string;
  parked: boolean;
  /** indices into cat.times — this habit's cues */
  occ: number[];
  times: number[];
  /** minutes each cue runs */
  dur: number;
  days: number[];
  target: number;
  cat: CfgCategory;
  group: CfgGroup | null;
};

export type Rec = { done: number; streak: number; best: number; log: number[]; streakDays: number; st: 'active' | 'formed'; a0: number };
export type HabitVM = Habit & { done: number; streak: number; best: number; log: number[]; streakDays: number; formed: boolean; audioId: string | null; a0: number };
export type Person = { n: string; p: number; v: number };
export type Challenge = { id: number; hk: string; len: number; start: number; people: Person[] };
export type Track = { id: string; name: string; size: number; type: string; added: number; dataUrl?: string };

type Tracker = { t0: number; today: number; removed: string[]; added: string[]; rec: Record<string, Rec>; ch: Challenge[]; nid: number; library: Track[]; audio: Record<string, string | null> };

export type Snapshot = {
  habits: HabitVM[];
  onDial: HabitVM[];
  selected: HabitVM | null;
  /** which of the selected habit's cues is picked (Pomodoro / Healing pager) */
  cueIdx: number;
  dnd: [number, number];
  dndOn: boolean;
  nowH: number;
  today: string;
  pomo: { focus: number; brk: number; cycles: number };
  challenges: Challenge[];
  library: Track[];
  day: number;
  room: number;
  medCount: number;
};

export const displayName = (h: { label: string; name: string }): string => h.label || h.name;
export const streakOf = (h: { streak: number; done: number; target: number }): number => h.streak + (h.done >= h.target ? 1 : 0);

/* ---------- day arithmetic (whole local calendar days) ---------- */
const dayNumber = (d: Date): number => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAYMS);

/* ---------- habits, derived from the live device schedule ---------- */
const occurrences = (cat: CfgCategory, gidx: number): number[] => cat.gi ? cat.gi.map((g, i) => g === gidx ? i : -1).filter((i) => i >= 0) : [];

export function deriveHabits(view: ConfigureView, removed: ReadonlySet<string>, added: ReadonlySet<string>): Habit[] {
  const out: Habit[] = [];
  view.cats.forEach((cat) => {
    const color = `var(${cat.color})`;
    if ((cat.k === 'meds' || cat.k === 'custom') && cat.groups) {
      cat.groups.forEach((group, gidx) => {
        const occ = occurrences(cat, gidx);
        if (!occ.length) return;
        const gid = String(group.id ?? gidx);
        const id = `${cat.k}:${gid}`;
        // Same rule as the simple reminders: a pre-existing (factory-default) medicine or
        // habit stays off the dial until it's been synced for real or added in this browser.
        if (!view.synced && !added.has(id)) return;
        const times = occ.map((i) => cat.times[i]);
        out.push({
          id, k: cat.k, gid, name: cat.label, label: group.name || '', unit: UNITS[cat.k], color,
          parked: !cat.on || group.enabled === false, occ, times,
          dur: cat.k === 'custom' ? (group.dur ?? cat.dur) : cat.dur,
          days: group.days ?? [], target: cat.k === 'meds' ? times.length : 1, cat, group,
        });
      });
      return;
    }
    // Before anything has ever been synced from the real device/cloud, the factory-default
    // reminders stay off the dial until the person adds them here — a genuinely synced
    // schedule (or a reminder they've explicitly added in this browser) always shows.
    if (!view.synced && !added.has(cat.k)) return;
    if (removed.has(cat.k) && !cat.on) return;
    const times = cat.times.slice();
    const target = cat.k === 'water' ? Math.max(1, Math.round(cat.goal ?? 2000))
      : cat.k === 'pomodoro' ? Math.max(1, times.length * view.pomo.cycles)
      : ['meditation', 'clean'].includes(cat.k) ? 1
      : Math.max(1, times.length);
    out.push({
      id: cat.k, k: cat.k, gid: null, name: cat.label, label: '', unit: UNITS[cat.k] ?? 'times', color,
      parked: !cat.on, occ: times.map((_, i) => i), times, dur: cat.dur, days: cat.days ?? [0, 1, 2, 3, 4, 5, 6], target, cat, group: null,
    });
  });
  return out;
}

/** is this habit actually scheduled on that day (weekday, a medicine's date range, a bottle-clean interval …) */
function isDue(h: Habit, idx: number, t0: number, a0: number): boolean {
  const dt = new Date((t0 + idx) * DAYMS);
  const iso = dt.toISOString().slice(0, 10), dow = dt.getUTCDay();
  if (h.k === 'custom' && h.group?.type === 'absolute') return (h.group.date || '') === iso;
  if (h.days.length && !h.days.includes(dow)) return false;
  if (h.k === 'meds' && h.group) {
    if (h.group.start && iso < h.group.start) return false;
    if (h.group.end && iso > h.group.end) return false;
  }
  if (h.k === 'clean') {
    const every = Math.max(1, Math.round(h.cat.everyDays || 1));
    if (every > 1) { const age = idx - a0; if (age < 0 || age % every !== 0) return false; }
  }
  return true;
}

/* deterministic pseudo-random, so the simulated colleagues behave the same on every load */
function h32(a: number, b: number, c: number): number {
  let x = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  x = Math.imul(x ^ (x >>> 15), 2246822507); x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

const blank = (): Tracker => ({ t0: dayNumber(new Date()), today: 0, removed: [], added: [], rec: {}, ch: [], nid: 1, library: [], audio: {} });
const storageKey = (uid: string) => `frost_aura_myday_v1:${uid}`;
function load(uid: string): Tracker | null {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Tracker>;
    const base = blank();
    return { ...base, ...parsed, rec: parsed.rec ?? {}, removed: parsed.removed ?? [], added: parsed.added ?? [], ch: parsed.ch ?? [], library: parsed.library ?? [], audio: parsed.audio ?? {} };
  } catch { return null; }
}

export class MyDayStore {
  private T: Tracker;
  private version = 0;
  private listeners = new Set<() => void>();
  private cache: { view: ConfigureView; version: number; snap: Snapshot } | null = null;
  private unsubscribe: () => void;
  private timer: number;

  constructor(readonly bridge: ConfigureBridge, private uid: string) {
    this.T = load(uid) ?? blank();
    this.roll();
    // cfgAddedIds lives only in legacy.ts's in-memory state, so it starts empty on every
    // page load — replay what this browser already knows was added, or it would vanish.
    this.T.added.forEach((id) => this.bridge.markAdded(id));
    this.syncAcknowledgements();
    this.unsubscribe = bridge.subscribe(() => {
      const rolled = this.roll();
      this.syncAcknowledgements();
      if (rolled) this.commit();
      else this.emit();
    });
    this.timer = window.setInterval(() => {
      if (this.roll()) {
        this.syncAcknowledgements();
        this.commit();
      }
    }, 60000);   // the day boundary
  }

  dispose(): void { this.unsubscribe(); window.clearInterval(this.timer); this.listeners.clear(); }
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(): void { this.cache = null; this.listeners.forEach((l) => l()); }
  private save(): void { try { localStorage.setItem(storageKey(this.uid), JSON.stringify(this.T)); } catch { /* storage full or blocked */ } }
  private commit(): void { this.version++; this.save(); this.emit(); }
  toast(message: string): void { this.bridge.toast(message); }

  /* ---------- tracker records ---------- */
  private rec(id: string): Rec {
    return this.T.rec[id] ??= { done: 0, streak: 0, best: 0, log: [], streakDays: FORM_DEFAULT, st: 'active', a0: this.T.today };
  }
  private habitsNow(): Habit[] { return deriveHabits(this.bridge.getView(), new Set(this.T.removed), new Set(this.T.added)); }

  private acknowledgement(h: Habit, counts: Record<string, number> | undefined): number {
    if (!counts) return 0;
    const habitKey = h.gid ? `${h.k}:${h.gid}` : h.k;
    return clamp(counts[habitKey] ?? counts[h.k] ?? 0, 0, h.target);
  }

  private syncAcknowledgements(): void {
    const counts = this.bridge.getView().ackToday;
    let changed = false;
    this.habitsNow().forEach((h) => {
      const r = this.rec(h.id);
      const done = this.acknowledgement(h, counts);
      if (r.done !== done) { r.done = done; changed = true; }
    });
    if (changed) this.save();
  }

  private historyStreak(h: Habit, history: ConfigureView['ackHistory'], today: string, a0: number): number | null {
    const date = new Date(`${today}T00:00:00`);
    date.setDate(date.getDate() - 1);
    let count = 0, found = false;
    for (let guard = 0; guard < 500; guard += 1, date.setDate(date.getDate() - 1)) {
      const idx = dayNumber(date) - this.T.t0;
      if (idx < a0) break;
      if (!isDue(h, idx, this.T.t0, a0)) continue;
      const counts = history[isoDate(date)];
      if (!counts) break;
      found = true;
      if (this.acknowledgement(h, counts) < h.target) break;
      count += 1;
    }
    return found ? count : null;
  }

  /** the day boundary: score yesterday, start a fresh count */
  private roll(): boolean {
    const idx = dayNumber(new Date()) - this.T.t0;
    if (this.T.today >= idx) return false;
    const ack = this.bridge.getView().ackToday || {};
    const list = this.habitsNow().filter((h) => !h.parked);
    let guard = 0;
    while (this.T.today < idx && guard++ < 500) {
      list.forEach((h) => {
        const r = this.rec(h.id);
        if (ack[h.k] != null) r.done = clamp(ack[h.k], 0, h.target);   // score off the freshest real Acknowledged count
        if (!isDue(h, this.T.today, this.T.t0, r.a0)) { r.done = 0; return; }   // not due: streak untouched, tally clears
        if (Math.min(r.done, h.target) >= h.target) { r.log.push(1); r.streak++; } else { r.log.push(0); r.streak = 0; }
        r.done = 0; r.best = Math.max(r.best, r.streak);
        if (r.st === 'active' && r.streak >= r.streakDays) r.st = 'formed';
      });
      this.T.ch.forEach((c) => c.people.forEach((p, i) => { if (this.T.today - c.start < c.len && h32(c.id, this.T.today, i) < p.p) p.v++; }));
      this.T.today++;
    }
    this.save();
    return true;
  }

  /* ---------- the snapshot React renders from ---------- */
  getSnapshot = (): Snapshot => {
    const view = this.bridge.getView();
    if (this.cache && this.cache.view === view && this.cache.version === this.version) return this.cache.snap;
    const removed = new Set(this.T.removed);
    const added = new Set(this.T.added);
    const ack = view.ackToday || {};
    const habits: HabitVM[] = deriveHabits(view, removed, added).map((h) => {
      const r = this.T.rec[h.id];
      const historicalStreak = this.historyStreak(h, view.ackHistory, view.today, r?.a0 ?? this.T.today);
      return {
        ...h, done: Math.min(r?.done ?? 0, h.target), streak: historicalStreak ?? r?.streak ?? 0, best: r?.best ?? 0, log: r?.log ?? [],
        streakDays: r?.streakDays ?? FORM_DEFAULT, formed: r?.st === 'formed', audioId: this.T.audio[h.id] ?? null, a0: r?.a0 ?? this.T.today,
      };
    });
    const onDial = habits.filter((h) => !h.parked);
    let selected: HabitVM | null = null, cueIdx = 0;
    if (view.sel) {
      const s = view.sel;
      selected = habits.find((h) => h.k === s.k && h.occ.includes(s.i)) ?? null;
      if (selected) cueIdx = Math.max(0, selected.occ.indexOf(s.i));
    }
    if (!selected) selected = onDial[0] ?? habits[0] ?? null;
    const snap: Snapshot = {
      habits, onDial, selected, cueIdx, dnd: view.dnd, dndOn: view.dndOn, nowH: view.nowH, today: view.today, pomo: view.pomo,
      challenges: this.T.ch, library: this.T.library, day: this.T.today, room: Math.max(0, MAX_DIAL - onDial.length),
      medCount: habits.filter((h) => h.k === 'meds').length,
    };
    this.cache = { view, version: this.version, snap };
    return snap;
  };

  /* ---------- selection ---------- */
  select(h: Habit, cue = 0): void { this.bridge.select(h.k, h.occ[cue] ?? h.occ[0] ?? 0); }

  /* ---------- logging & streaks ---------- */
  private form(h: Habit, r: Rec): void { r.st = 'formed'; this.toast(`${displayName(h)} is formed — it keeps running on the dial`); }

  setStreakDays(h: HabitVM, n: number): void {
    const r = this.rec(h.id);
    const v = clamp(Math.round(n), FORM_MIN, FORM_MAX);
    if (v === r.streakDays) return;
    r.streakDays = v;
    if (r.st === 'active' && r.streak >= v) this.form(h, r);   // a lowered bar promotes a streak that already clears it
    this.commit();
    this.pushStreakWindow(h, h.days, v);
    this.toast(`${displayName(h)}’s streak length set to ${v} day${v === 1 ? '' : 's'}`);
  }

  /** Pushes this habit's device-JSON validity window (start = today, end = the streak's Nth active day) —
   *  every reminder except Medication (which keeps its own manually-set course dates) and a custom habit
   *  in "Specific date" mode (a single fixed day, not a repeating streak). */
  /** Pushes this habit's device-JSON validity window — end = the streak's Nth active day,
   *  counting from today for every reminder except Medication, which anchors on its own
   *  (user-set) course start date instead. Skipped for a custom habit in "Specific date"
   *  mode (a single fixed day, not a repeating streak). */
  private pushStreakWindow(h: Habit, days: number[], streakDays: number): void {
    if (h.k === 'custom' && h.group?.type === 'absolute') return;
    const id = h.gid ? `${h.k}:${h.gid}` : h.k;
    const start = h.k === 'meds' ? (h.group?.start || todayISO()) : todayISO();
    this.bridge.setStreakWindow(id, start, streakEndDate(start, streakDays, days));
  }

  /* ---------- add / park / delete ---------- */
  addTemplate(name: string): void {
    const t = TEMPLATES.find((x) => x.name === name);
    if (!t) return;
    if (t.k === 'meds') {
      const id = this.bridge.addMedicine();
      if (id) {
        this.T.added.push(`meds:${id}`);
        this.bridge.markAdded(`meds:${id}`);
        const start = todayISO();
        this.bridge.setStreakWindow(`meds:${id}`, start, streakEndDate(start, FORM_DEFAULT, [0, 1, 2, 3, 4, 5, 6]));
      }
      this.commit();
      this.toast('New medicine added — name it and set dose times below');
      return;
    }
    this.T.removed = this.T.removed.filter((id) => id !== t.k);
    if (!this.T.added.includes(t.k)) this.T.added.push(t.k);
    delete this.T.rec[t.k];
    this.bridge.addTemplate(t.k);
    this.bridge.markAdded(t.k);
    { const start = todayISO(); this.bridge.setStreakWindow(t.k, start, streakEndDate(start, FORM_DEFAULT, [0, 1, 2, 3, 4, 5, 6])); }
    this.commit();
    this.toast(`${name} added — day 1 of ${FORM_DEFAULT}. Tune when Aura cues it below.`);
  }
  addCustom(): void {
    const id = this.bridge.addCustom();
    if (id) {
      this.T.added.push(`custom:${id}`);
      this.bridge.markAdded(`custom:${id}`);
      const start = todayISO();
      this.bridge.setStreakWindow(`custom:${id}`, start, streakEndDate(start, FORM_DEFAULT, [0, 1, 2, 3, 4, 5, 6]));
    }
    this.commit();
    this.toast(`Habit added — day 1 of ${FORM_DEFAULT}. Tune when Aura cues it below.`);
  }

  park(h: HabitVM): void {
    this.bridge.setEnabled(h.k, h.gid, false);
    const r = this.rec(h.id); r.streak = 0; r.done = 0;
    this.commit();
    this.toast(`${displayName(h)} parked — the streak stops here`);
  }
  resume(h: HabitVM): void {
    this.bridge.setEnabled(h.k, h.gid, true);
    const r = this.rec(h.id); r.a0 = this.T.today; r.log = []; r.streak = 0; r.done = 0;
    this.commit();
    this.toast(`${displayName(h)} back on the dial · day 1 of ${r.streakDays}`);
  }
  remove(h: HabitVM): void {
    if (h.gid) this.bridge.deleteGroup(h.k, h.gid);
    else { this.bridge.setEnabled(h.k, null, false); if (!this.T.removed.includes(h.id)) this.T.removed.push(h.id); }
    delete this.T.rec[h.id]; delete this.T.audio[h.id];
    this.T.ch = this.T.ch.filter((c) => c.hk !== h.id);
    this.commit();
    this.toast('Habit deleted');
  }

  /* ---------- schedule edits (all land in the device schedule) ---------- */
  setCueTime(h: Habit, cue: number, hour: number): void { this.bridge.setCueTime(h.k, h.occ[cue], hour); }
  setCueCount(h: Habit, n: number): void {
    this.bridge.setCueCount(h.k, h.gid, n);
    this.toast(`${displayName(h)} now has ${n} cue${n === 1 ? '' : 's'}${h.k === 'meds' || ['eye', 'stretch', 'walk'].includes(h.k) ? ` · target ${n} ${unitFor(n, h.unit)}` : ''}`);
  }
  removeCue(h: Habit, cue: number): void { this.bridge.removeCue(h.k, h.occ[cue]); }
  setDuration(h: Habit, minutes: number): void { this.bridge.setDuration(h.k, h.gid, minutes); this.toast(`Cue lasts ${Math.round(minutes)} min`); }
  setRange(h: Habit, cue: number, startHour: number, minutes: number): void { this.bridge.setRange(h.k, h.occ[cue], startHour, minutes); }
  setGoal(ml: number): void { this.bridge.setWaterGoal(ml); }
  setIntervalDays(days: number): void { this.bridge.setIntervalDays(days); this.toast(`Bottle Clean every ${days} day${days === 1 ? '' : 's'}`); }
  pomodoro(field: PomoField, delta: number): void { this.bridge.pomodoro(field, delta); }
  duplicateWindow(h: Habit, cue: number): void {
    if (h.times.length >= 6) { this.toast('That’s plenty of windows for one day — remove one before adding another'); return; }
    this.bridge.duplicateWindow(h.k, h.occ[cue]);
    this.toast(h.k === 'pomodoro' ? 'New window added to the clock, starting right after this one ends' : 'New session added to the clock');
  }
  toggleDay(h: HabitVM, day: number): void {
    if (h.days.includes(day) && h.days.length < 2) { this.toast('At least one active day is needed'); return; }
    const nextDays = h.days.includes(day) ? h.days.filter((d) => d !== day) : [...h.days, day].sort((a, b) => a - b);
    this.bridge.toggleDay(h.k, h.gid, day);
    this.pushStreakWindow(h, nextDays, h.streakDays);
  }
  setLabel(h: Habit, value: string): void { if (h.gid) this.bridge.setLabel(h.k, h.gid, value); }
  /** Medication's own course start date — the end date is worked out automatically (streak length × active days). */
  setMedDate(h: HabitVM, value: string): void {
    if (!h.gid) return;
    this.bridge.setMedDate(h.k, h.gid, 'start', value);
    this.pushStreakWindow(h, h.days, h.streakDays);
  }
  setCustomMode(h: HabitVM, mode: 'recurring' | 'absolute'): void {
    if (!h.gid) return;
    this.bridge.setCustomMode(h.gid, mode);
    if (mode === 'absolute') this.bridge.setStreakWindow(`${h.k}:${h.gid}`, h.group?.date || todayISO(), h.group?.date || todayISO());
    else this.pushStreakWindow(h, h.days, h.streakDays);
  }
  setCustomDate(h: Habit, value: string): void {
    if (!h.gid) return;
    this.bridge.setCustomDate(h.gid, value);
    this.bridge.setStreakWindow(`${h.k}:${h.gid}`, value, value);
  }
  scrollToEditor(): void { this.bridge.scrollToEditor(); }

  /* ---------- audio library (Meditation, Healing, Pomodoro, custom habits) ---------- */
  uploadTrack(h: HabitVM, file: File): Promise<boolean> {
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(file.name)) { this.toast('Choose an audio file (mp3, wav, m4a…)'); return Promise.resolve(false); }
    if (file.size > 8 * 1024 * 1024) { this.toast('Keep audio under 8 MB'); return Promise.resolve(false); }
    const entry: Track = { id: 'a' + this.T.nid++, name: file.name.replace(/\.[^.]+$/, '').slice(0, 48) || 'Track', size: file.size, type: file.type || 'audio', added: Date.now() };
    const finish = (): boolean => {
      this.T.library.push(entry); this.T.audio[h.id] = entry.id;
      this.commit(); this.toast(`"${entry.name}" uploaded · assigned to ${displayName(h)}`);
      return true;
    };
    if (file.size > 400 * 1024) return Promise.resolve(finish());       // only small files are kept in the browser so they survive a refresh
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => { entry.dataUrl = String(reader.result); resolve(finish()); };
      reader.onerror = () => resolve(finish());
      reader.readAsDataURL(file);
    });
  }
  pickTrack(h: HabitVM, id: string): void {
    if (h.audioId !== id) this.T.audio[h.id] = id;
    const t = this.T.library.find((x) => x.id === id);
    this.commit(); this.toast(t ? `"${t.name}" assigned to ${displayName(h)}` : 'Track assigned');
  }
  deleteTrack(id: string): void {
    this.T.library = this.T.library.filter((t) => t.id !== id);
    Object.keys(this.T.audio).forEach((k) => { if (this.T.audio[k] === id) this.T.audio[k] = null; });
    this.commit(); this.toast('Removed from music library');
  }
  clearAudio(h: HabitVM): void { this.T.audio[h.id] = null; this.commit(); this.toast('Audio cleared from this habit'); }

  /* ---------- challenges (colleagues are simulated) ---------- */
  createChallenge(hk: string, len: number, who: string[]): void {
    const id = this.T.nid++;
    this.T.ch.push({ id, hk, len, start: this.T.today, people: who.map((n, i) => ({ n, p: 0.55 + h32(id, i, 7) * 0.4, v: 0 })) });
    this.commit(); this.toast('Challenge sent');
  }
  inviteLink(): void { this.toast(`Invite link copied — frostactive.in/j/${this.T.today + 41}K7`); }
}

/* ---------- challenge scoring ---------- */
export function myScore(c: Challenge, h: HabitVM | undefined, today: number, a0 = 0): number {
  if (!h) return 0;
  const from = Math.max(0, c.start - a0), to = Math.min(h.log.length, from + c.len);
  let v = 0;
  for (let i = from; i < to; i++) if (h.log[i] > 0) v++;
  if (today - c.start < c.len && h.done >= h.target) v++;
  return v;
}
export function board(c: Challenge, h: HabitVM | undefined, today: number, a0: number): Array<{ n: string; v: number; me: boolean }> {
  const rows = c.people.map((p) => ({ n: p.n, v: p.v, me: false }));
  rows.push({ n: 'You', v: myScore(c, h, today, a0), me: true });
  rows.sort((a, b) => b.v - a.v || (a.me ? -1 : 1));
  return rows;
}
