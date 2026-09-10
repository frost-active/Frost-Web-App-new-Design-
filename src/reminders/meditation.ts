import type { DeviceConfig, WindowReminder } from './types';

export function buildMeditationReminder(config: DeviceConfig): WindowReminder {
  const source = config.reminders.meditation;
  return { k: 'meditation', label: 'Meditation', color: '--c-meditation', src: 'meditation', type: 'win', mode: 'fixed', on: source.enabled, from: 0, to: 24, every: 1, dur: source.display_sec / 60, times: [source.sh + source.sm / 60], days: source.days.map((day: string) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day)).filter((day: number) => day >= 0).sort((a: number, b: number) => a - b) };
}
