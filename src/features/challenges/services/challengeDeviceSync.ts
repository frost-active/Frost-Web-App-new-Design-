import type { ConfigureBridge } from '../../../components/configure/types';
import type { ChallengeHabitSnapshot, ChallengeDeviceJson, DeviceCustomEvent } from '../types.ts';

export type BuildChallengeDeviceJsonInput = {
  habit: ChallengeHabitSnapshot;
  startDate: string;
  endDate: string;
  deviceEventId: string;
};

export function buildChallengeDeviceJson(input: BuildChallengeDeviceJsonInput): ChallengeDeviceJson {
  const challengeEvent: DeviceCustomEvent = {
    id: input.deviceEventId,
    label: input.habit.label,
    enabled: true,
    start_date: input.startDate,
    end_date: input.endDate,
    display_ms: input.habit.display_ms,
    days: [...input.habit.days],
    times: input.habit.times.map(({ h, m }) => ({ h: Math.trunc(h), m: Math.trunc(m) })),
    text_x: input.habit.text_x,
    text_y: input.habit.text_y,
    text_size: input.habit.text_size,
    text_color: input.habit.text_color,
    text_align: input.habit.text_align,
    text_width: input.habit.text_width,
  };

  return {
    _meta: { schema_ver: 6, device: 'FROST' },
    reminders: {
      custom: {
        enabled: true,
        require_ack: true,
        display_ms: 60000,
        events: [challengeEvent],
      },
    },
    audio: {},
  };
}

export async function syncChallengeToDevice(
  bridge: ConfigureBridge,
  input: BuildChallengeDeviceJsonInput,
): Promise<ChallengeDeviceJson> {
  const deviceJson = buildChallengeDeviceJson(input);
  await bridge.syncChallengeDevice(deviceJson);
  return deviceJson;
}