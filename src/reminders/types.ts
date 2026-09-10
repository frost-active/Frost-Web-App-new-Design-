export type ReminderKey =
  | 'water'
  | 'meds'
  | 'eye'
  | 'stretch'
  | 'walk'
  | 'meditation'
  | 'custom'
  | 'clean'
  | 'healing'
  | 'pomodoro';

export type ReminderCategory = {
  k: ReminderKey;
  label: string;
  color: string;
  src: string;
  type: 'win' | 'ev' | 'lap';
  mode?: 'fixed' | 'interval';
  on: boolean;
  dur: number;
  from?: number;
  to?: number;
  every?: number;
  everyDays?: number;
  times: number[];
  days: number[];
  goal?: number;
  lock?: boolean;
  snooze?: number;
  durs?: number[];
  labels?: string[];
  gi?: number[];
  groups?: Array<{
    name: string;
    times: number[];
    days: number[];
    start?: string;
    end?: string;
    enabled: boolean;
    dur?: number;
  }>;
};

export type WindowReminder = ReminderCategory & {
  type: 'win';
  mode: 'fixed' | 'interval';
  from: number;
  to: number;
  every: number;
  times: number[];
  days: number[];
};

export type EventReminder = ReminderCategory & {
  type: 'ev';
  groups: NonNullable<ReminderCategory['groups']>;
  labels?: string[];
  gi?: number[];
};

export type LapReminder = ReminderCategory & {
  type: 'lap';
  durs: number[];
  times: number[];
  days: number[];
};

export type DeviceConfig = {
  reminders: any;
  audio: any;
  bottle_clean: any;
  pomodoro: any;
};
