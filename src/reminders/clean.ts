import type { DeviceConfig, WindowReminder } from './types';

export function buildBottleReminder(config: DeviceConfig): WindowReminder {
  const source = config.bottle_clean;
  return { k: 'clean', label: 'Bottle Clean', color: '--c-clean', src: 'bottle_clean', type: 'win', mode: 'fixed', on: source.enabled, from: 0, to: 24, every: 1, dur: source.display_ms / 60000, everyDays: source.interval_days, times: [source.hour + source.minute / 60], days: [0, 1, 2, 3, 4, 5, 6] };
}