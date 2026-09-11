import { buildBottleReminder } from './clean';
import { buildCustomReminder } from './custom';
import { buildEyeReminder } from './eye';
import { buildHealingReminder } from './healing';
import { buildMedicationReminder } from './meds';
import { buildMeditationReminder } from './meditation';
import { buildPomodoroReminder } from './pomodoro';
import { buildStretchReminder } from './stretch';
import { buildWalkReminder } from './walk';
import { buildWaterReminder } from './water';
import type { DeviceConfig, ReminderCategory } from './types';

export type { DeviceConfig, EventReminder, LapReminder, ReminderCategory, WindowReminder } from './types';
export { buildBottleReminder } from './clean';
export { buildCustomReminder } from './custom';
export { buildEyeReminder } from './eye';
export { buildHealingReminder } from './healing';
export { buildMedicationReminder } from './meds';
export { buildMeditationReminder } from './meditation';
export { buildPomodoroReminder } from './pomodoro';
export { buildStretchReminder } from './stretch';
export { buildWalkReminder } from './walk';
export { buildWaterReminder } from './water';

export const reminderDefinitions = {
  water: { key: 'water', label: 'Hydration', color: '--c-water', source: 'hydration', category: 'window' },
  meds: { key: 'meds', label: 'Medication', color: '--c-meds', source: 'medication', category: 'event' },
  eye: { key: 'eye', label: 'Eye break', color: '--c-eye', source: 'eye', category: 'window' },
  stretch: { key: 'stretch', label: 'Stretch', color: '--c-stretch', source: 'stretch', category: 'window' },
  walk: { key: 'walk', label: 'Walk', color: '--c-walk', source: 'walk', category: 'window' },
  meditation: { key: 'meditation', label: 'Meditation', color: '--c-meditation', source: 'meditation', category: 'window' },
  custom: { key: 'custom', label: 'Custom', color: '--c-custom', source: 'custom', category: 'event' },
  clean: { key: 'clean', label: 'Bottle Clean', color: '--c-clean', source: 'bottle_clean', category: 'window' },
  healing: { key: 'healing', label: 'Healing', color: '--c-healing', source: 'healing', category: 'window' },
  pomodoro: { key: 'pomodoro', label: 'Pomodoro', color: '--c-pomodoro', source: 'pomodoro', category: 'lap' },
} as const;

export function buildCATS(raw: DeviceConfig): ReminderCategory[] {
  return [buildWaterReminder(raw), buildMedicationReminder(raw), buildEyeReminder(raw), buildStretchReminder(raw), buildWalkReminder(raw), buildMeditationReminder(raw), buildCustomReminder(raw), buildBottleReminder(raw), buildHealingReminder(raw), buildPomodoroReminder(raw)];
}

function materialise(category: ReminderCategory): number[] {
  const output: number[] = [];
  for (let hour = category.from ?? 0; hour <= (category.to ?? 0) + 1e-9; hour += category.every ?? 1) output.push(+hour.toFixed(4));
  return output;
}

export function buildActiveCategories(raw: DeviceConfig): ReminderCategory[] {
  const categories = buildCATS(raw);
  categories.forEach((category) => { if (category.type === 'win' && category.mode === 'interval') category.times = materialise(category); });
  categories.filter((category) => ['water', 'eye', 'stretch', 'walk'].includes(category.k)).forEach((category) => { category.mode = 'fixed'; });
  categories.forEach((category) => {
    if (category.type === 'ev') {
      category.times = [];
      category.labels = [];
      category.gi = [];
      category.groups?.forEach((group, groupIndex) => group.times.forEach((time) => { category.times.push(+time.toFixed(4)); category.labels?.push(group.name); category.gi?.push(groupIndex); }));
    }
  });
  return categories;
}
