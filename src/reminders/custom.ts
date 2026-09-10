import type { DeviceConfig, EventReminder } from './types';

const dayIndex = (day: string) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day);

export function buildCustomReminder(config: DeviceConfig): EventReminder {
  const source = config.reminders.custom;
  const groups = source.events.map((event: any) => ({ name: event.label, times: [event.h + event.m / 60], days: event.days.map(dayIndex).filter((day: number) => day >= 0).sort((a: number, b: number) => a - b), enabled: event.enabled, dur: event.show_ms / 60000 }));
  return { k: 'custom', label: 'Custom', color: '--c-custom', src: 'custom', type: 'ev', on: source.enabled, dur: 1, groups, times: [], labels: [], gi: [], days: [] };
}