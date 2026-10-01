/* Types shared by the Configure ("My day") tab.
   The schedule model lives in src/legacy.ts; React reads a snapshot (ConfigureView)
   and calls the actions on ConfigureBridge. Every action addresses a habit explicitly
   by (category key, group id) — it never depends on what happens to be selected. */

export type CfgSelection = { k: string; i: number } | null;

export type CfgGroup = {
  id?: string;
  name: string;
  times: number[];
  days: number[];
  start?: string;
  end?: string;
  enabled?: boolean;
  type?: 'absolute' | 'recurring';
  date?: string | null;
  dur?: number;
};

export type CfgCategory = {
  k: string;
  label: string;
  /** CSS custom-property name, e.g. "--c-water" */
  color: string;
  on: boolean;
  type: 'win' | 'ev' | 'lap';
  dur: number;
  times: number[];
  labels?: string[];
  gi?: number[];
  groups?: CfgGroup[];
  days?: number[];
  goal?: number;
  everyDays?: number;
};

export type ConfigureView = {
  version: number;
  cats: CfgCategory[];
  sel: CfgSelection;
  nowH: number;
  dnd: [number, number];
  dndOn: boolean;
  pomo: { focus: number; brk: number; cycles: number };
  /** local date as YYYY-MM-DD */
  today: string;
  /** a real saved schedule has been restored from the device/cloud — as opposed to the untouched factory defaults */
  synced: boolean;
  /** today's real Acknowledged count from the Statistics sync, per category key (water/meds/eye/stretch/walk/meditation/custom) — drives the dial automatically, no manual logging */
  ackToday: Record<string, number>;
  /** actual device acknowledgements by date and habit/category key */
  ackHistory: Record<string, Record<string, number>>;
};

export type PomoField = 'focus_min' | 'break_min' | 'cycles';

export type ConfigureBridge = {
  subscribe: (listener: () => void) => () => void;
  getView: () => ConfigureView;
  select: (k: string, i: number) => void;
  scrollToEditor: () => void;
  toast: (message: string) => void;

  /** i = index into the category's `times` (one cue) */
  setCueTime: (k: string, i: number, hour: number) => void;
  setCueCount: (k: string, gid: string | null, n: number) => void;
  removeCue: (k: string, i: number) => void;
  duplicateWindow: (k: string, i: number) => void;
  setDuration: (k: string, gid: string | null, minutes: number) => void;
  /** Meditation / Healing: start time + session length in one step */
  setRange: (k: string, i: number, startHour: number, minutes: number) => void;
  setIntervalDays: (days: number) => void;
  setWaterGoal: (ml: number) => void;
  pomodoro: (field: PomoField, delta: number) => void;

  setLabel: (k: string, gid: string, value: string) => void;
  setMedDate: (k: string, gid: string, field: 'start' | 'end', value: string) => void;
  toggleDay: (k: string, gid: string | null, day: number) => void;
  setCustomMode: (gid: string, mode: 'recurring' | 'absolute') => void;
  setCustomDate: (gid: string, value: string) => void;
  /** Device-JSON validity window for one reminder (id = cat.k, or `${cat.k}:${gid}` for a medicine/habit group) */
  setStreakWindow: (id: string, startISO: string, endISO: string) => void;
  /** Marks a reminder as explicitly added through this UI, so it's included in the exported JSON even before any real device sync */
  markAdded: (id: string) => void;

  setEnabled: (k: string, gid: string | null, on: boolean) => void;
  addTemplate: (k: string) => void;
  /** returns the new medicine's group id */
  addMedicine: () => string | null;
  /** returns the new habit's group id */
  addCustom: () => string | null;
  deleteGroup: (k: string, gid: string) => void;
};
