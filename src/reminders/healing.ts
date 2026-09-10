import type { DeviceConfig, WindowReminder } from './types';

const parseTime = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return hours + minutes / 60; };
const dayIndex = (day: string) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day);

export function buildHealingReminder(config: DeviceConfig): WindowReminder {
  const source = config.audio;
  const schedules = source.healing_schedules;
  const first = schedules[0];
  return { k: 'healing', label: 'Healing', color: '--c-healing', src: 'healing', type: 'win', mode: 'fixed', on: source.healing.enabled, from: 0, to: 24, every: 1, dur: (parseTime(first.end_time) - parseTime(first.start_time)) * 60, times: schedules.filter((schedule: any) => schedule.enabled).map((schedule: any) => parseTime(schedule.start_time)), days: first.days.map(dayIndex).filter((day: number) => day >= 0).sort((a: number, b: number) => a - b) };
}
