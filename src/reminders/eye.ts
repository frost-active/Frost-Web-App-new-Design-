import type { DeviceConfig, WindowReminder } from './types';

const dayIndex = (day: string) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day);

export function buildEyeReminder(config: DeviceConfig): WindowReminder {
  const source = config.reminders.eye;
  return { k: 'eye', label: 'Eye break', color: '--c-eye', src: 'eye', type: 'win', mode: source.mode === 'interval' ? 'interval' : 'fixed', on: source.enabled, from: source.start_hour + source.start_min / 60, to: source.end_hour + source.end_min / 60, every: source.interval_ms / 3600000, dur: source.display_ms / 60000, times: source.abs.times.map((time: { h: number; m: number }) => time.h + time.m / 60), days: source.days.map(dayIndex).filter((day: number) => day >= 0).sort((a: number, b: number) => a - b) };
}