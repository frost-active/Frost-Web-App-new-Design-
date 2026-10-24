export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type ChallengeParticipantStatus = 'invited' | 'accepted' | 'declined' | 'expired';
export type ChallengeDeviceSyncStatus = 'pending' | 'synced' | 'failed';

export type ChallengeHabitDraft = {
  label: string;
  times: Array<{ h: number; m: number }>;
  days: string[];
  display_ms: number;
};

export type ChallengeHabitSnapshot = ChallengeHabitDraft & {
  habitId: string;
  text_x: number;
  text_y: number;
  text_size: number;
  text_color: number;
  text_align: number;
  text_width: number;
};

export type Challenge = {
  name?: string;
  creatorId: string;
  creatorName: string;
  creatorParticipates?: boolean;
  habit: ChallengeHabitSnapshot;
  startDate: string;
  endDate: string;
  durationDays: number;
  timezone: string;
  status: ChallengeStatus;
  participantIds: string[];
  acceptedIds: string[];
  idempotencyKey: string;
  createdAt: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  winnerId?: string | null;
  finalRanking?: FinalRankingRow[];
};

export type ChallengeParticipant = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  role: 'creator' | 'invitee';
  status: ChallengeParticipantStatus;
  habitId: string;
  deviceEventId?: string;
  deviceSyncStatus: ChallengeDeviceSyncStatus;
  deviceSyncedAt?: unknown;
  invitedAt: unknown;
  respondedAt?: unknown;
};

export type ChallengeCheckin = { day: string; completedAt: number };

export type ChallengeStanding = {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  daysCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDay: string | null;
  lastCompletedAt: number | null;
  rank: number;
};

export type FinalRankingRow = Pick<ChallengeStanding, 'uid' | 'rank' | 'daysCompleted' | 'longestStreak'>;

export type DeviceCustomEvent = {
  id: string;
  label: string;
  enabled: boolean;
  start_date: string;
  end_date: string;
  display_ms: number;
  days: string[];
  times: Array<{ h: number; m: number }>;
  text_x: number;
  text_y: number;
  text_size: number;
  text_color: number;
  text_align: number;
  text_width: number;
};

export type ChallengeDeviceJson = {
  _meta: { schema_ver: 6; device: 'FROST' };
  reminders: {
    custom: { enabled: true; require_ack: true; display_ms: 60000; events: DeviceCustomEvent[] };
  };
  audio: Record<string, never>;
};

export type ChallengeDraftSubmission = {
  draftId: string;
  name: string;
  habit: ChallengeHabitDraft;
  startDate: string;
  endDate: string;
  durationDays: number;
  timezone: string;
  invitees: Array<{ uid: string; name: string }>;
  includeCreator: boolean;
  step: number;
  ready: boolean;
  deviceEventId: string | null;
};