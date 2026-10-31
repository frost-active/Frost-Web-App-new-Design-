import { defaultConfig } from '../../config/defaultConfig';

export const PRODUCTION_API_URL = 'https://frost-ai-eehc.onrender.com/parse';
export const LOCAL_API_URL = 'http://127.0.0.1:5000/parse';

const DEFAULT_TIMEOUT_MS = 45000;
const OPEN_ENDED_DAYS = 360;
const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const INITIAL_CONFIG = {
  ...defaultConfig,
  reminders: {
    ...defaultConfig.reminders,
    custom: { ...defaultConfig.reminders.custom, enabled: false, events: [] },
  },
};

export type AiHabit = {
  label: string;
  times: Array<{ h: number; m: number }>;
  days: string[];
  start_date: string | null;
  end_date: string | null;
  enabled: boolean;
  streakDays: number;
};

type SchedulerResponse = {
  data?: unknown;
  reply?: string;
  needs_input?: boolean;
  pending?: unknown;
  summary?: string[];
  notes?: string[];
  invalid?: Array<{ reason?: string }>;
  logs?: string[];
  error?: string;
  [key: string]: unknown;
};

export type HabitSchedulerResult =
  | { status: 'empty' }
  | { status: 'question'; reply: string; logs: string[] }
  | { status: 'partial' | 'scheduled'; reply: string | null; configuration: unknown; habits: AiHabit[]; changes: { added: AiHabit[]; updated: AiHabit[]; removed: AiHabit[] }; changedCategories: string[]; requestedStreakDays: number | null; requestedActiveDays: string[] | null; summary: string[]; notes: string[]; invalid: string[]; logs: string[] }
  | { status: 'error'; kind: string; error: string; logs: string[] };

export function resolveApiUrl(configuredApiUrl = import.meta.env?.VITE_HABIT_API_URL): string {
  const configured = configuredApiUrl?.trim();
  return configured || PRODUCTION_API_URL;
}

function toHM(value: unknown): { h: number; m: number } | null {
  if (value === null || value === undefined || value === '') return null;
  let h: number, m: number;
  if (typeof value === 'object') {
    const time = value as { h?: unknown; m?: unknown };
    h = Number(time.h);
    m = Number(time.m ?? 0);
  } else {
    const parts = String(value).split(':').map(Number);
    h = parts[0];
    m = parts[1] || 0;
  }
  return Number.isInteger(h) && h >= 0 && h <= 23 && Number.isInteger(m) && m >= 0 && m <= 59
    ? { h, m }
    : null;
}

function normalizeDays(days: unknown): string[] {
  if (!Array.isArray(days)) return [];
  const normalized = [...new Set(days
    .map((day) => String(day).trim().toLowerCase().slice(0, 3))
    .filter((day) => ALL_DAYS.includes(day)))];
  return normalized.length === 7 ? [] : normalized.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
}

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) || date.getFullYear() !== parts[0]
    || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2] ? null : date;
}

function countStreakDays(start: string | null, end: string | null, days: string[]): number {
  const from = parseDate(start), through = parseDate(end);
  if (!from || !through || through < from || (through.getTime() - from.getTime()) / 86400000 >= OPEN_ENDED_DAYS) return 21;
  const active = days.length ? days : ALL_DAYS;
  let count = 0;
  for (const date = new Date(from); date <= through; date.setDate(date.getDate() + 1)) {
    const day = ALL_DAYS[(date.getDay() + 6) % 7];
    if (active.includes(day)) count += 1;
    if (count >= 90) return 90;
  }
  return Math.max(1, count);
}

export function normalizeHabit(value: unknown): AiHabit {
  const event = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawTimes = Array.isArray(event.times)
    ? event.times
    : event.times != null
      ? [event.times]
      : event.h != null
        ? [{ h: event.h, m: event.m ?? 0 }]
        : [];
  const times = rawTimes.map(toHM).filter((time): time is { h: number; m: number } => time !== null)
    .sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
  const days = normalizeDays(event.days);
  const rawStartDate = typeof event.start_date === 'string' ? event.start_date : null;
  const rawEndDate = typeof event.end_date === 'string' ? event.end_date : null;
  const startDate = parseDate(rawStartDate) ? rawStartDate : null;
  const endDate = parseDate(rawEndDate) ? rawEndDate : null;
  const explicitStreak = Number(event.streak_days);
  return {
    label: String(event.label || 'Habit').trim() || 'Habit',
    times,
    days,
    start_date: startDate,
    end_date: endDate,
    enabled: event.enabled !== false,
    streakDays: Number.isInteger(explicitStreak) && explicitStreak > 0
      ? Math.min(explicitStreak, 90)
      : countStreakDays(startDate, endDate, days),
  };
}

function getHabits(config: unknown): AiHabit[] {
  if (!config || typeof config !== 'object') return [];
  const reminders = (config as { reminders?: unknown }).reminders;
  if (!reminders || typeof reminders !== 'object') return [];
  const custom = (reminders as { custom?: { enabled?: boolean; events?: unknown[] } }).custom;
  if (!custom || custom.enabled === false || !Array.isArray(custom.events)) return [];
  return custom.events.map(normalizeHabit).filter((habit) => habit.enabled && habit.times.length > 0);
}

function habitSignature(habit: AiHabit): string {
  return JSON.stringify([habit.times, habit.days, habit.start_date, habit.end_date, habit.enabled, habit.streakDays]);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

export function changedCategories(before: unknown, after: unknown): string[] {
  const oldConfig = before as { reminders?: Record<string, unknown>; audio?: Record<string, unknown>; pomodoro?: unknown; bottle_clean?: unknown };
  const newConfig = after as { reminders?: Record<string, unknown>; audio?: Record<string, unknown>; pomodoro?: unknown; bottle_clean?: unknown };
  const oldReminders = oldConfig?.reminders || {};
  const nextReminders = newConfig?.reminders || {};
  const oldAudio = oldConfig?.audio || {};
  const nextAudio = newConfig?.audio || {};
  const changed: string[] = [];
  const compare = (key: string, previous: unknown, next: unknown) => {
    if (canonical(previous) !== canonical(next)) changed.push(key);
  };
  compare('water', oldReminders.hydration, nextReminders.hydration);
  compare('meds', oldReminders.medication, nextReminders.medication);
  compare('eye', oldReminders.eye, nextReminders.eye);
  compare('stretch', oldReminders.stretch, nextReminders.stretch);
  compare('walk', oldReminders.walk, nextReminders.walk);
  compare('meditation', oldReminders.meditation, nextReminders.meditation);
  compare('custom', oldReminders.custom, nextReminders.custom);
  compare('clean', oldReminders.bottle_clean ?? oldConfig.bottle_clean, nextReminders.bottle_clean ?? newConfig.bottle_clean);
  compare('healing', [oldAudio.healing, oldAudio.healing_schedules], [nextAudio.healing, nextAudio.healing_schedules]);
  compare('pomodoro', oldConfig.pomodoro, newConfig.pomodoro);
  return changed;
}

function mentionedCategories(text: string, config?: unknown): Set<string> {
  if (/\b(custom habit|new habit named|habit named|habit called)\b/i.test(text)) return new Set(['custom']);
  const aliases: Record<string, string[]> = {
    water: ['water', 'hydration', 'drink'],
    meds: ['medication', 'medicine', 'meds', 'pill', 'pills'],
    eye: ['eye break', 'eye breaks', 'screen break'],
    stretch: ['stretch', 'stretching'],
    walk: ['walk', 'walking'],
    meditation: ['meditation', 'meditate', 'mindfulness'],
    custom: ['custom habit'],
    clean: ['bottle clean', 'clean bottle', 'bottle cleaning'],
    healing: ['healing'],
    pomodoro: ['pomodoro'],
  };
  const normalizedText = text.toLowerCase();
  const mentions = Object.entries(aliases).flatMap(([category, terms]) => terms
    .map((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = new RegExp(`(^|[^a-z])${escaped}($|[^a-z])`).exec(normalizedText);
      return match ? { category, index: match.index } : null;
    })
    .filter((match): match is { category: string; index: number } => match !== null));
  mentions.sort((left, right) => left.index - right.index);
  if (mentions.length) return new Set([mentions[0].category]);
  const reminders = (config as { reminders?: { custom?: { events?: unknown[] } } } | undefined)?.reminders;
  const events = Array.isArray(reminders?.custom?.events) ? reminders.custom.events : [];
  const normalized = text.toLowerCase();
  const customMentioned = events.some((event) => {
    const label = event && typeof event === 'object'
      ? String((event as Record<string, unknown>).label || '').trim().toLowerCase()
      : '';
    return label.length > 1 && new RegExp(`(^|[^a-z0-9])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(normalized);
  });
  return customMentioned || /\bhabit\b/i.test(text) ? new Set(['custom']) : new Set();
}

const WEEKDAY_ALIASES: Record<string, string> = {
  monday: 'mon', mondays: 'mon', mon: 'mon',
  tuesday: 'tue', tuesdays: 'tue', tue: 'tue', tues: 'tue',
  wednesday: 'wed', wednesdays: 'wed', wed: 'wed',
  thursday: 'thu', thursdays: 'thu', thu: 'thu', thur: 'thu', thurs: 'thu',
  friday: 'fri', fridays: 'fri', fri: 'fri',
  saturday: 'sat', saturdays: 'sat', sat: 'sat',
  sunday: 'sun', sundays: 'sun', sun: 'sun',
};

function requestedActiveDays(text: string): string[] | null {
  const normalized = text.toLowerCase();
  const hasWeekdays = /\bweekdays?\b/.test(normalized);
  const hasWeekends = /\bweekends?\b/.test(normalized);
  const allDays = /\b(every day|all days|daily)\b/.test(normalized);
  const selected = new Set<string>();

  if (allDays) ALL_DAYS.forEach((day) => selected.add(day));
  else {
    if (hasWeekdays) ['mon', 'tue', 'wed', 'thu', 'fri'].forEach((day) => selected.add(day));
    if (hasWeekends) ['sat', 'sun'].forEach((day) => selected.add(day));
  }

  const dayNames = Object.entries(WEEKDAY_ALIASES)
    .sort(([left], [right]) => right.length - left.length)
    .map(([name, day]) => ({ name, day }));
  const ranges = /\b([a-z]+)\s*(?:to|through|[-–—])\s*([a-z]+)\b/g;
  for (const match of normalized.matchAll(ranges)) {
    const from = dayNames.find(({ name }) => name === match[1])?.day;
    const to = dayNames.find(({ name }) => name === match[2])?.day;
    const start = ALL_DAYS.indexOf(from || '');
    const end = ALL_DAYS.indexOf(to || '');
    if (start < 0 || end < 0) continue;
    for (let index = start; ; index = (index + 1) % ALL_DAYS.length) {
      selected.add(ALL_DAYS[index]);
      if (index === end) break;
    }
  }

  const excluded = /\b(?:except|excluding|but not)\b([\s\S]*)/.exec(normalized)?.[1];
  if (excluded) {
    Object.entries(WEEKDAY_ALIASES).forEach(([name, day]) => {
      if (new RegExp(`(^|[^a-z])${name}($|[^a-z])`).test(excluded)) selected.delete(day);
    });
    if (/\bweekdays?\b/.test(excluded)) ['mon', 'tue', 'wed', 'thu', 'fri'].forEach((day) => selected.delete(day));
    if (/\bweekends?\b/.test(excluded)) ['sat', 'sun'].forEach((day) => selected.delete(day));
  } else {
    Object.entries(WEEKDAY_ALIASES).forEach(([name, day]) => {
      if (new RegExp(`(^|[^a-z])${name}($|[^a-z])`).test(normalized)) selected.add(day);
    });
  }

  if (!selected.size || selected.size === 7) return selected.size === 7 ? ALL_DAYS.slice() : null;
  return ALL_DAYS.filter((day) => selected.has(day));
}

function requestedStreakDays(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\s*-?\s*days?\s+(?:long\s+)?streak\b|\bstreak(?:\s+(?:length|days?))?\s*(?:(?:of|for|is|should be|goal(?: of)?|to)\s*)?(?::|=)?\s*(\d{1,3})(?:\s+days?)?\b/i);
  const days = Number(match?.[1] || match?.[2]);
  return Number.isInteger(days) && days > 0 ? Math.min(days, 90) : null;
}

function configForDays(config: unknown, category: string, days: string[], previousConfig: unknown, intentText: string): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const updated = structuredClone(config) as Record<string, unknown>;
  const reminders = updated.reminders as Record<string, unknown> | undefined;
  if (!reminders) return updated;
  const keys: Record<string, string> = {
    water: 'hydration', meds: 'medication', eye: 'eye', stretch: 'stretch',
    walk: 'walk', meditation: 'meditation',
  };
  const assignDays = (entry: unknown) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      (entry as Record<string, unknown>).days = days.slice();
    }
  };
  if (keys[category]) {
    const section = reminders[keys[category]];
    if (category === 'meds' && section && typeof section === 'object') {
      const medicines = (section as Record<string, unknown>).medicines;
      if (Array.isArray(medicines)) medicines.forEach(assignDays);
    } else assignDays(section);
  } else if (category === 'healing') {
    const audio = updated.audio as Record<string, unknown> | undefined;
    const schedules = audio?.healing_schedules;
    if (Array.isArray(schedules)) schedules.forEach(assignDays);
  } else if (category === 'custom') {
    const custom = reminders.custom as Record<string, unknown> | undefined;
    const events = custom?.events;
    const oldCustom = (previousConfig as { reminders?: { custom?: { events?: unknown[] } } } | null)?.reminders?.custom;
    const before = Array.isArray(oldCustom?.events) ? oldCustom.events : [];
    if (Array.isArray(events)) {
      const oldById = new Map(before.map((event) => {
        const item = event && typeof event === 'object' ? event as Record<string, unknown> : {};
        return [String(item.id ?? item.label ?? ''), canonical(item)] as const;
      }));
      const mentionedEvents = events.filter((event) => {
        const label = event && typeof event === 'object'
          ? String((event as Record<string, unknown>).label || '').trim()
          : '';
        return label.length > 1 && new RegExp(`(^|[^a-z0-9])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i').test(intentText);
      });
      const changedEvents = events.filter((event) => {
        const item = event && typeof event === 'object' ? event as Record<string, unknown> : {};
        return oldById.get(String(item.id ?? item.label ?? '')) !== canonical(item);
      });
      const targets = mentionedEvents.length ? mentionedEvents
        : changedEvents.length ? changedEvents
          : events.length === 1 ? events : [];
      targets.forEach(assignDays);
    }
  }
  return updated;
}

function diffHabits(before: AiHabit[], after: AiHabit[]) {
  const previous = new Map(before.map((habit) => [habit.label.toLowerCase(), habit]));
  const next = new Map(after.map((habit) => [habit.label.toLowerCase(), habit]));
  const added: AiHabit[] = [], updated: AiHabit[] = [], removed: AiHabit[] = [];
  next.forEach((habit, key) => {
    const old = previous.get(key);
    if (!old) added.push(habit);
    else if (habitSignature(old) !== habitSignature(habit)) updated.push(habit);
  });
  previous.forEach((habit, key) => { if (!next.has(key)) removed.push(habit); });
  return { added, updated, removed };
}

function changesForRequestedCustomHabit(changes: ReturnType<typeof diffHabits>, text: string) {
  const candidates = [...changes.added, ...changes.updated];
  const normalized = text.toLowerCase();
  const named = candidates.filter((habit) => {
    const label = habit.label.trim().toLowerCase();
    return label.length > 1 && new RegExp(`(^|[^a-z0-9])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(normalized);
  });
  const selected = named.length === 1 ? named
    : changes.added.length === 1 ? changes.added
      : candidates.length === 1 ? candidates : [];
  return {
    added: selected.filter((habit) => changes.added.includes(habit)),
    updated: selected.filter((habit) => changes.updated.includes(habit)),
    removed: changes.removed,
  };
}

export class HabitScheduler {
  private config: unknown = INITIAL_CONFIG;
  private pending: unknown = null;
  private pendingCategories = new Set<string>();
  private pendingStreakDays: number | null = null;
  private pendingActiveDays: string[] | null = null;
  private pendingText = '';
  private busy = false;
  private readonly streakOverrides = new Map<string, number>();
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor({
    apiUrl = resolveApiUrl(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch.bind(globalThis),
  }: { apiUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}) {
    this.apiUrl = apiUrl;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  get habits(): AiHabit[] {
    return getHabits(this.config).map((habit) => ({
      ...habit,
      streakDays: this.streakOverrides.get(habit.label.toLowerCase()) ?? habit.streakDays,
    }));
  }
  get isBusy(): boolean { return this.busy; }

  async send(rawText: string): Promise<HabitSchedulerResult> {
    const text = rawText.trim();
    if (!text) return { status: 'empty' };
    if (this.busy) return { status: 'error', kind: 'busy', error: 'Still working on your last message.', logs: [] };

    this.busy = true;
    const previousHabits = this.habits;
    const previousConfig = this.config;
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await this.fetchImpl(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, current_config: this.config || undefined, pending: this.pending || undefined }),
          signal: controller.signal,
        });
      } finally {
        globalThis.clearTimeout(timer);
      }
    } catch (error) {
      this.busy = false;
      const timeout = error instanceof Error && error.name === 'AbortError';
      return {
        status: 'error',
        kind: timeout ? 'timeout' : 'network',
        error: timeout
          ? `The scheduler at ${this.apiUrl} took too long to respond. Please try again.`
          : `Could not connect to the habit scheduler at ${this.apiUrl}. Check your network and confirm the scheduler is online and allows this site.`,
        logs: [],
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      this.busy = false;
      return { status: 'error', kind: 'parse', error: `Unexpected response from the scheduler (HTTP ${response.status}).`, logs: [] };
    }
    this.busy = false;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { status: 'error', kind: 'parse', error: 'The scheduler returned an invalid response. Please try again.', logs: [] };
    }
    const result = payload as SchedulerResponse;

    if (!response.ok || result.error) {
      return {
        status: 'error',
        kind: 'backend',
        error: result.error
          ? `The scheduler rejected the request (HTTP ${response.status}): ${result.error}`
          : `The scheduler returned HTTP ${response.status}.`,
        logs: result.logs || [],
      };
    }

    const logs = result.logs || [];
    if (result.reply && !result.data) {
      this.pending = result.needs_input && result.pending ? result.pending : null;
      const categories = mentionedCategories(text, previousConfig);
      if (categories.size) this.pendingCategories = categories;
      const streakDays = requestedStreakDays(text);
      if (streakDays !== null) this.pendingStreakDays = streakDays;
      const activeDays = requestedActiveDays(text);
      if (activeDays) this.pendingActiveDays = activeDays;
      this.pendingText = `${this.pendingText} ${text}`.trim();
      if (!this.pending) {
        this.pendingCategories.clear();
        this.pendingStreakDays = null;
        this.pendingActiveDays = null;
        this.pendingText = '';
      }
      return { status: 'question', reply: result.reply, logs };
    }
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
      return { status: 'error', kind: 'parse', error: 'The scheduler did not return a habit schedule. Please try again.', logs };
    }
    this.pending = result.needs_input && result.reply && result.pending ? result.pending : null;
    const intentText = `${this.pendingText} ${text}`.trim();
    const currentIntent = mentionedCategories(text, previousConfig);
    const mentioned = currentIntent.size ? currentIntent : this.pendingCategories;
    const activeDays = requestedActiveDays(text) ?? this.pendingActiveDays;
    const beforeApply = changedCategories(previousConfig, result.data);
    const dayTarget = mentioned.values().next().value
      ?? (beforeApply.includes('custom') ? 'custom' : null);
    this.config = activeDays && dayTarget
      ? configForDays(result.data, dayTarget, activeDays, previousConfig, intentText)
      : result.data;
    const requestedDays = requestedStreakDays(text) ?? this.pendingStreakDays;
    const changed = changedCategories(previousConfig, this.config);
    const selectedCategories = mentioned.size
      ? changed.filter((category) => mentioned.has(category))
      : changed.filter((category) => category === 'custom');
    const stillAsking = Boolean(result.needs_input && result.reply);
    const rawHabitChanges = diffHabits(previousHabits, getHabits(this.config));
    const habitChanges = selectedCategories.includes('custom')
      ? changesForRequestedCustomHabit(rawHabitChanges, intentText)
      : rawHabitChanges;
    if (requestedDays !== null) {
      const changedHabits = [...habitChanges.added, ...habitChanges.updated];
      if (changedHabits.length === 1) this.streakOverrides.set(changedHabits[0].label.toLowerCase(), requestedDays);
    }
    if (!stillAsking) {
      this.pendingCategories.clear();
      this.pendingStreakDays = null;
      this.pendingActiveDays = null;
      this.pendingText = '';
    } else {
      if (currentIntent.size) this.pendingCategories = currentIntent;
      if (requestedStreakDays(text) !== null) this.pendingStreakDays = requestedStreakDays(text);
      if (requestedActiveDays(text)) this.pendingActiveDays = requestedActiveDays(text);
      this.pendingText = intentText;
    }
    const habits = this.habits;
    const finalChanges = diffHabits(previousHabits, habits);
    const appliedChanges = selectedCategories.includes('custom')
      ? changesForRequestedCustomHabit(finalChanges, intentText)
      : finalChanges;
    return {
      status: stillAsking ? 'partial' : 'scheduled',
      reply: stillAsking ? result.reply ?? null : null,
      configuration: this.config,
      habits,
      changes: appliedChanges,
      changedCategories: selectedCategories,
      requestedStreakDays: requestedDays,
      requestedActiveDays: activeDays,
      summary: result.summary || [],
      notes: result.notes || [],
      invalid: (result.invalid || []).map((item) => item.reason).filter((reason): reason is string => Boolean(reason)),
      logs,
    };
  }
}
