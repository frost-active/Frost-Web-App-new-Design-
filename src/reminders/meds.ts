import type { DeviceConfig, EventReminder } from './types';

const dayIndex = (day: string) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day);

export function buildMedicationReminder(config: DeviceConfig): EventReminder {
  const source = config.reminders.medication;
  const groups = source.medicines.map((medicine: any) => ({
    name: medicine.label, times: medicine.doses.map((dose: { h: number; m: number }) => dose.h + dose.m / 60),
    days: medicine.days.map(dayIndex).filter((day: number) => day >= 0).sort((a: number, b: number) => a - b),
    start: medicine.start, end: medicine.end, enabled: medicine.enabled,
  }));
  return { k: 'meds', label: 'Medication', color: '--c-meds', src: 'medication', type: 'ev', on: source.enabled, lock: true, snooze: source.snooze_min, dur: source.display_ms / 60000, groups, times: [], labels: [], gi: [], days: [] };
}
