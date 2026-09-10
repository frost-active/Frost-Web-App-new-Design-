export const defaultConfig = {
  _meta: { schema_ver: 6, device: 'FROST' },
  reminders: {
    hydration: { enabled: true, mode: 'absolute', interval_ms: 3600000, display_ms: 60000, require_ack: true, goal_ml: 2000, start_hour: 0, start_min: 0, end_hour: 23, end_min: 59, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], abs: { times: [{ h: 12, m: 13 }] } },
    stretch: { enabled: true, mode: 'absolute', interval_ms: 3600000, display_ms: 60000, require_ack: true, start_hour: 0, start_min: 0, end_hour: 23, end_min: 59, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], abs: { times: [{ h: 12, m: 14 }] } },
    eye: { enabled: true, mode: 'absolute', interval_ms: 2700000, display_ms: 60000, require_ack: true, start_hour: 0, start_min: 0, end_hour: 23, end_min: 59, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], abs: { times: [{ h: 12, m: 15 }] } },
    walk: { enabled: true, mode: 'absolute', interval_ms: 7200000, display_ms: 60000, require_ack: true, start_hour: 0, start_min: 0, end_hour: 23, end_min: 59, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], abs: { times: [{ h: 12, m: 16 }] } },
    meditation: { enabled: true, sh: 12, sm: 18, eh: 12, em: 20, display_sec: 120, require_ack: true, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
    medication: { enabled: true, require_ack: true, snooze_min: 15, display_ms: 60000, medicines: [{ id: 'med_001', label: 'Take Pill', enabled: true, start: '2026-01-01', end: '2026-12-31', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], text_x: 120, text_y: 135, text_size: 1, text_color: 65535, text_align: 1, text_width: 180, doses: [{ h: 12, m: 17 }] }] },
    custom: { enabled: true, require_ack: true, events: [{ id: 'custom_001', label: 'Meet 1 ', enabled: true, h: 12, m: 21, show_ms: 60000, type: 'recurring', days: ['tue'], text_x: 120, text_y: 100, text_size: 1, text_color: 65535, text_align: 1, text_width: 180 }] },
  },
  audio: { volume: 30, pomodoro: { enabled: true, tracks: [45] }, meditation: { enabled: true, tracks: [45] }, healing: { enabled: true, require_dock: true, tracks: [45] }, healing_schedules: [{ enabled: true, start_time: '11:00', end_time: '12:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, { enabled: true, start_time: '16:00', end_time: '17:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }] },
  bottle_clean: { enabled: true, interval_days: 1, hour: 18, minute: 0, display_ms: 60000, require_ack: true },
  pomodoro: { enabled: true, focus_min: 1, break_min: 1, cycles: 4, auto_start_break: true, auto_start_focus: true, lap_mode_enabled: false, laps: [{ enabled: true, sh: 11, sm: 52, eh: 11, em: 54 }], focus_counter: { x: 118, y: 105, text_size: 1, text_color: 65535, text_align: 1 }, break_counter: { x: 118, y: 105, text_size: 1, text_color: 65535, text_align: 1 } },
} as const;

export type DeviceConfig = typeof defaultConfig;
