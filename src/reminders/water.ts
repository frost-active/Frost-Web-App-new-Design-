import type { DeviceConfig, WindowReminder } from './types';

export function buildWaterReminder(config: DeviceConfig): WindowReminder {
  const source = config.reminders.hydration;
  return {
    k: 'water', label: 'Hydration', color: '--c-water', src: 'hydration', type: 'win',
    mode: source.mode === 'interval' ? 'interval' : 'fixed', on: source.enabled,
    from: source.start_hour + source.start_min / 60, to: source.end_hour + source.end_min / 60,
    every: source.interval_ms / 3600000, dur: source.display_ms / 60000,
    times: source.abs.times.map((time: { h: number; m: number }) => time.h + time.m / 60),
    days: source.days.map((day: string) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day)).filter((day: number) => day >= 0).sort((a: number, b: number) => a - b), goal: 2000,
  };
}
