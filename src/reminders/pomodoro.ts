import type { DeviceConfig, LapReminder } from './types';

export function buildPomodoroReminder(config: DeviceConfig): LapReminder {
  const source = config.pomodoro;
  return { k: 'pomodoro', label: 'Pomodoro', color: '--c-pomodoro', src: 'pomodoro', type: 'lap', on: source.enabled && source.lap_mode_enabled, times: (source.laps || []).map((lap: any) => lap.sh + lap.sm / 60), durs: (source.laps || []).map((lap: any) => Math.round((lap.eh * 60 + lap.em) - (lap.sh * 60 + lap.sm))), dur: (source.laps && source.laps[0]) ? Math.round((source.laps[0].eh * 60 + source.laps[0].em) - (source.laps[0].sh * 60 + source.laps[0].sm)) : 60, days: [0, 1, 2, 3, 4, 5, 6] };
}
