import { defaultConfig } from './defaultConfig';

/* ============================================================================
   The last synced schedule, read back from the database.

   What is saved on every successful Sync is the device JSON (schema_ver 6) plus a
   small `ui_meta` block for things only this web app needs (which habits are on the
   list, the hydration goal, Pomodoro cycles, whether a custom habit is a one-off date).
   The Configure tab does not edit that JSON directly — it edits the schedule model
   `defaultConfig` describes — so this module converts the saved document back into
   that model, exactly, and works out the streak windows that go with it.

   It reads every shape the app has ever saved:
     • the current one (nested bottle_clean, meditation `times`, Pomodoro `laps[].start`,
       custom habits with a `times` list and a start/end validity window, plus `ui_meta`),
     • saves made before `ui_meta` existed (the habit list is worked out from what is on),
     • the older flat shape (meditation `sh`/`sm`, top-level bottle_clean, one `h`/`m` per
       custom habit, Pomodoro `laps[].sh`).
   Anything missing or malformed falls back to the factory default for that field, so one
   bad value can never stop the rest of the schedule from loading.
   ============================================================================ */

type Obj = Record<string, unknown>;
/** the schedule model: the same shape as `defaultConfig`, but editable */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawConfig = Record<string, any>;

export type SyncedModel = {
  raw: RawConfig;
  musicTrackSelections: Record<'pomodoro' | 'meditation' | 'healing', number[]>;
  /** every habit on the "Your habits" list when this was synced (parked ones included) */
  habitIds: string[];
  /** each habit's device-JSON validity window (id = category key, or `meds:<id>` / `custom:<id>`) */
  streakWindows: Record<string, { start: string; end: string }>;
  /** each habit's streak length, i.e. the number of active days inside its validity window */
  streakDays: Record<string, number>;
};

const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_NUMBER: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^(\d{1,2}):(\d{2})$/;
const MAX_STREAK_SCAN = 400;

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}
const positive = (value: unknown, fallback: number): number => { const parsed = num(value, NaN); return parsed > 0 ? parsed : fallback; };
const isoDate = (value: unknown): string | null => (typeof value === 'string' && ISO_DATE.test(value) ? value : null);
const pad = (value: number): string => String(value).padStart(2, '0');

/** the device writes "every day" as an empty list; the editor needs the seven days spelled out */
function dayList(value: unknown, whenEmpty: readonly string[] = WEEK): string[] {
  const days = list(value).filter((day): day is string => typeof day === 'string' && day in DAY_NUMBER);
  return days.length ? [...new Set(days)] : [...whenEmpty];
}

/** {h, m} -> whole minutes past midnight, or null when it is not a time of day */
function timeOf(value: unknown): { h: number; m: number } | null {
  if (!isObj(value)) return null;
  const hour = num(value.h, NaN), minute = num(value.m, NaN);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 24 || minute < 0 || minute > 60) return null;
  const total = Math.round(hour * 60 + minute) % 1440;   // the exporter can write 59.99 min as m:60
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** "HH:MM" -> minutes, tolerating an end time that runs past midnight ("24:30") */
function clockMinutes(value: unknown): number | null {
  const match = typeof value === 'string' ? value.match(HH_MM) : null;
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour > 47 || minute > 59 ? null : hour * 60 + minute;
}

/** how many of the given weekdays (0 = Sunday) fall inside start..end inclusive */
function activeDaysBetween(start: string, end: string, weekdays: number[]): number {
  if (end < start) return 0;
  const active = new Set(weekdays.length ? weekdays : [0, 1, 2, 3, 4, 5, 6]);
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return 0;
  let count = 0;
  for (let guard = 0; cursor <= last && guard < MAX_STREAK_SCAN; guard += 1) {
    if (active.has(cursor.getDay())) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

type Collected = { windows: SyncedModel['streakWindows']; streakDays: SyncedModel['streakDays'] };

/** remember a habit's validity window and the streak length it implies */
function keepWindow(out: Collected, id: string, start: unknown, end: unknown, days: string[]): void {
  const from = isoDate(start), to = isoDate(end);
  if (!from || !to || to < from) return;
  out.windows[id] = { start: from, end: to };
  const length = activeDaysBetween(from, to, days.map((day) => DAY_NUMBER[day]));
  if (length > 0) out.streakDays[id] = clamp(length, 1, 90);
}

/* ---------- hydration / eye / stretch / walk ---------- */
const WINDOW_REMINDERS = [['hydration', 'water'], ['stretch', 'stretch'], ['eye', 'eye'], ['walk', 'walk']] as const;

function readWindowReminder(raw: RawConfig, key: string, id: string, node: unknown, ui: Obj | null, modern: boolean, out: Collected): void {
  if (!isObj(node)) return;
  const target = raw.reminders[key];
  target.enabled = flag(node.enabled, target.enabled);
  target.display_ms = positive(node.display_ms, target.display_ms);
  target.require_ack = flag(node.require_ack, true);
  target.days = dayList(node.days);
  if (node.mode === 'interval') {
    // an older save that still held the repeating window rather than the cue times
    target.mode = 'interval';
    ['interval_ms', 'start_hour', 'start_min', 'end_hour', 'end_min'].forEach((field) => { target[field] = num(node[field], target[field]); });
  } else {
    target.mode = 'absolute';
    const times = list(isObj(node.abs) ? node.abs.times : []).map(timeOf).filter((time): time is { h: number; m: number } => time !== null);
    target.abs = { times };
  }
  if (key === 'hydration') {
    const goal = num(ui?.goal_ml, num(node.goal_ml, NaN));
    if (Number.isFinite(goal)) target.goal_ml = clamp(Math.round(goal), 0, 6000);
  }
  if (modern) keepWindow(out, id, node.start_date, node.end_date, target.days);
}

/* ---------- meditation ---------- */
function readMeditation(raw: RawConfig, node: unknown, modern: boolean, out: Collected): void {
  if (!isObj(node)) return;
  const target = raw.reminders.meditation;
  target.enabled = flag(node.enabled, target.enabled);
  target.require_ack = flag(node.require_ack, true);
  target.days = dayList(node.days);
  const slot = isObj(list(node.times)[0]) ? (list(node.times)[0] as Obj) : null;
  const start = slot ? timeOf(slot.start) : null;
  const end = slot ? timeOf(slot.end) : null;
  if (start) { target.sh = start.h; target.sm = start.m; }
  else if (Number.isFinite(Number(node.sh))) { target.sh = clamp(Math.floor(num(node.sh, 7)), 0, 23); target.sm = clamp(Math.round(num(node.sm, 0)), 0, 59); }
  let seconds = node.display_ms !== undefined ? num(node.display_ms, NaN) / 1000 : num(node.display_sec, NaN);
  if (!(seconds > 0) && start && end) seconds = ((((end.h * 60 + end.m) - (start.h * 60 + start.m)) + 1440) % 1440) * 60;
  if (seconds > 0) target.display_sec = Math.round(seconds);
  const finish = (target.sh * 60 + target.sm + target.display_sec / 60) % 1440;
  target.eh = Math.floor(finish / 60);
  target.em = Math.round(finish % 60);
  if (modern) keepWindow(out, 'meditation', node.start_date, node.end_date, target.days);
}

/* ---------- medication ---------- */
function readMedication(raw: RawConfig, node: unknown, modern: boolean, out: Collected): void {
  if (!isObj(node)) return;
  const target = raw.reminders.medication;
  target.enabled = flag(node.enabled, target.enabled);
  target.require_ack = flag(node.require_ack, true);
  target.snooze_min = positive(node.snooze_min, target.snooze_min);
  target.display_ms = positive(node.display_ms, target.display_ms);
  if (!Array.isArray(node.medicines)) return;
  target.medicines = node.medicines.flatMap((item, index) => {
    if (!isObj(item)) return [];
    const doses = list(item.doses).map(timeOf).filter((dose): dose is { h: number; m: number } => dose !== null);
    if (!doses.length) return [];
    const id = text(item.id) || `med_${pad(index + 1)}`;
    const days = dayList(item.days);
    if (modern) keepWindow(out, `meds:${id}`, item.start, item.end, days);
    return [{
      id, label: text(item.label), enabled: item.enabled !== false, start: isoDate(item.start) ?? '', end: isoDate(item.end) ?? '', days,
      text_x: num(item.text_x, 120), text_y: num(item.text_y, 135), text_size: num(item.text_size, 1),
      text_color: num(item.text_color, 65535), text_align: num(item.text_align, 1), text_width: num(item.text_width, 180),
      doses,
    }];
  });
}

/* ---------- custom habits ---------- */
function readCustom(raw: RawConfig, node: unknown, ui: Obj | null, modern: boolean, out: Collected): void {
  if (!isObj(node)) return;
  const target = raw.reminders.custom;
  target.enabled = flag(node.enabled, target.enabled);
  target.require_ack = flag(node.require_ack, true);
  if (!Array.isArray(node.events)) return;
  const kinds = new Map<string, Obj>();
  list(ui?.custom).forEach((entry) => { if (isObj(entry) && typeof entry.id === 'string') kinds.set(entry.id, entry); });
  target.events = node.events.flatMap((item, index) => {
    if (!isObj(item)) return [];
    const id = text(item.id) || `custom_${pad(index + 1)}`;
    const saved = list(item.times).map(timeOf).filter((time): time is { h: number; m: number } => time !== null);
    const times = saved.length ? saved : [timeOf({ h: item.h, m: item.m }) ?? { h: 0, m: 0 }];
    const from = isoDate(item.start_date), to = isoDate(item.end_date);
    const kind = kinds.get(id);
    // Saves without ui_meta only say "start date = end date" for a one-off day (a habit with a one-day streak is the rare exception)
    const type = kind?.type === 'absolute' || kind?.type === 'recurring' ? kind.type
      : item.type === 'absolute' || item.type === 'recurring' ? item.type
      : from && to && from === to ? 'absolute' : 'recurring';
    const date = type === 'absolute' ? (isoDate(kind?.date) ?? isoDate(item.date) ?? from) : null;
    const days = type === 'absolute' ? [] : dayList(item.days);
    if (modern && type === 'recurring') keepWindow(out, `custom:${id}`, item.start_date, item.end_date, days);
    return [{
      id, label: text(item.label), enabled: item.enabled !== false,
      h: times[0].h, m: times[0].m, times, show_ms: positive(item.display_ms ?? item.show_ms, 60000), type, date, days,
      text_x: num(item.text_x, 120), text_y: num(item.text_y, 100), text_size: num(item.text_size, 1),
      text_color: num(item.text_color, 65535), text_align: num(item.text_align, 1), text_width: num(item.text_width, 180),
      ...(text(item.mode_pair_id) ? { mode_pair_id: text(item.mode_pair_id) } : {}),
    }];
  });
}

/* ---------- bottle clean (nested under reminders now, top level before) ---------- */
function readBottleClean(raw: RawConfig, node: unknown, modern: boolean, out: Collected): void {
  if (!isObj(node)) return;
  const target = raw.bottle_clean;
  target.enabled = flag(node.enabled, target.enabled);
  target.require_ack = flag(node.require_ack, true);
  target.interval_days = Math.max(1, Math.round(num(node.interval_days, target.interval_days)));
  target.display_ms = positive(node.display_ms, target.display_ms);
  const time = timeOf(node.time) ?? (node.hour !== undefined ? timeOf({ h: node.hour, m: node.minute }) : null);
  if (time) { target.hour = time.h; target.minute = time.m; }
  if (modern) keepWindow(out, 'clean', node.start_date, node.end_date, [...WEEK]);
}

/* ---------- audio + healing sessions ---------- */
function readAudio(raw: RawConfig, node: unknown, ui: Obj | null): Record<'pomodoro' | 'meditation' | 'healing', number[]> {
  const target = raw.audio;
  const audioNode = isObj(node) ? node : {};
  const uiSelections = isObj(ui?.music_tracks) ? ui.music_tracks : null;
  const musicTrackSelections = { pomodoro: [], meditation: [], healing: [] } as Record<'pomodoro' | 'meditation' | 'healing', number[]>;
  target.volume = num(audioNode.volume, target.volume);
  (['pomodoro', 'meditation', 'healing'] as const).forEach((key) => {
    const section = audioNode[key];
    if (!isObj(section)) return;
    target[key].enabled = flag(section.enabled, target[key].enabled);
    if (key === 'healing') target.healing.require_dock = flag(section.require_dock, target.healing.require_dock);
    const tracks = list(section.tracks).filter((track): track is number => typeof track === 'number' && Number.isSafeInteger(track) && track >= 0);
    const savedSelection = uiSelections?.[key];
    if (Array.isArray(savedSelection)) {
      musicTrackSelections[key] = savedSelection.filter((track): track is number => typeof track === 'number' && Number.isSafeInteger(track) && track >= 0);
    } else if (ui?.music_tracks_configured === true) {
      musicTrackSelections[key] = tracks;
    } else {
      const isLegacyDefaultTrack = tracks.length === 1 && (tracks[0] === 45 || tracks[0] === 46);
      musicTrackSelections[key] = isLegacyDefaultTrack ? [] : tracks;
    }
    target[key].tracks = [...musicTrackSelections[key]];
  });
  const sessions = list(audioNode.healing_schedules).flatMap((session) => {
    if (!isObj(session) || clockMinutes(session.start_time) === null || clockMinutes(session.end_time) === null) return [];
    // a parked habit saves every session as disabled; whether it is on is `audio.healing.enabled`, the sessions themselves must survive
    return [{ enabled: true, start_time: text(session.start_time), end_time: text(session.end_time), days: dayList(session.days) }];
  });
  if (sessions.length) target.healing_schedules = sessions;
  return musicTrackSelections;
}

/* ---------- pomodoro ---------- */
function readPomodoro(raw: RawConfig, node: unknown, ui: Obj | null, modern: boolean, out: Collected): void {
  if (!isObj(node)) return;
  const target = raw.pomodoro;
  target.enabled = flag(node.enabled, target.enabled);
  target.focus_min = clamp(Math.round(num(node.focus_min, target.focus_min)), 5, 60);
  target.break_min = clamp(Math.round(num(node.break_min, target.break_min)), 5, 30);
  const extra = isObj(ui?.pomodoro) ? (ui?.pomodoro as Obj) : {};
  target.cycles = clamp(Math.round(num(extra.cycles, num(node.cycles, target.cycles))), 1, 8);
  target.auto_start_break = flag(node.auto_start_break, target.auto_start_break);
  target.auto_start_focus = flag(node.auto_start_focus, target.auto_start_focus);
  target.days = dayList(node.days);
  ['focus_counter', 'break_counter'].forEach((field) => { if (isObj(node[field])) target[field] = { ...target[field], ...(node[field] as Obj) }; });
  const starts = list(node.laps).flatMap((lap) => {
    if (!isObj(lap)) return [];
    const start = timeOf(lap.start) ?? (lap.sh !== undefined ? timeOf({ h: lap.sh, m: lap.sm }) : null);
    return start ? [start] : [];
  });
  if (starts.length) {
    // one lap per window, spanning the whole session: Start -> Start + (Focus + Break) x Cycles
    target.laps = starts.map((start) => {
      const end = Math.min(24, start.h + start.m / 60 + ((target.focus_min + target.break_min) * target.cycles) / 60);
      return { enabled: true, sh: start.h, sm: start.m, eh: Math.floor(end) % 24, em: Math.round((end % 1) * 60) % 60 };
    });
    target.lap_mode_enabled = true;
  } else {
    target.lap_mode_enabled = flag(node.lap_mode_enabled, target.lap_mode_enabled);
  }
  if (modern) keepWindow(out, 'pomodoro', node.start_date, node.end_date, target.days);
}

/** the habits that were on the list, when the save does not say so itself (a reminder the save never mentions was never on it) */
function inferHabitIds(raw: RawConfig, doc: Obj, reminders: Obj, modern: boolean): string[] {
  const ids: string[] = [];
  WINDOW_REMINDERS.forEach(([key, id]) => { if (isObj(reminders[key]) && raw.reminders[key].enabled) ids.push(id); });
  if (isObj(reminders.meditation) && raw.reminders.meditation.enabled) ids.push('meditation');
  if (isObj(modern ? reminders.bottle_clean : doc.bottle_clean) && raw.bottle_clean.enabled) ids.push('clean');
  if (isObj(doc.audio) && raw.audio.healing.enabled) ids.push('healing');
  if (isObj(doc.pomodoro) && raw.pomodoro.enabled) ids.push('pomodoro');
  if (isObj(reminders.medication)) raw.reminders.medication.medicines.forEach((medicine: Obj) => ids.push(`meds:${text(medicine.id)}`));
  if (isObj(reminders.custom)) raw.reminders.custom.events.forEach((event: Obj) => ids.push(`custom:${text(event.id)}`));
  return ids;
}

/**
 * Converts the configuration saved with the last successful sync into the schedule model.
 * Throws only when the document is not a device configuration at all.
 */
export function syncedConfigToModel(doc: unknown): SyncedModel {
  if (!isObj(doc) || !isObj(doc.reminders)) throw new Error('The saved configuration is not in a format this version understands.');
  const reminders = doc.reminders;
  const ui = isObj(doc.ui_meta) && doc.ui_meta.v === 1 ? doc.ui_meta : null;
  // every current save carries the nested bottle_clean; the older flat shape has it at the top level
  const modern = isObj(reminders.bottle_clean);
  const raw: RawConfig = structuredClone(defaultConfig);
  const out: Collected = { windows: {}, streakDays: {} };

  WINDOW_REMINDERS.forEach(([key, id]) => readWindowReminder(raw, key, id, reminders[key], ui, modern, out));
  readMeditation(raw, reminders.meditation, modern, out);
  readMedication(raw, reminders.medication, modern, out);
  readCustom(raw, reminders.custom, ui, modern, out);
  readBottleClean(raw, modern ? reminders.bottle_clean : doc.bottle_clean, modern, out);
  const musicTrackSelections = readAudio(raw, doc.audio, ui);
  readPomodoro(raw, doc.pomodoro, ui, modern, out);

  const listed = ui && Array.isArray(ui.habits) ? ui.habits.filter((id): id is string => typeof id === 'string') : null;
  return { raw, musicTrackSelections, habitIds: listed ?? inferHabitIds(raw, doc, reminders, modern), streakWindows: out.windows, streakDays: out.streakDays };
}

/** JSON with sorted keys, so two copies of the same configuration always compare equal */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => (isObj(nested)
    ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
    : nested));
}
