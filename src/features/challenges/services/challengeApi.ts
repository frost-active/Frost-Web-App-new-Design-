import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../../../firebase';
import type { ChallengeHabitDraft } from '../types';

export type CreateChallengeInput = {
  name: string;
  habit: ChallengeHabitDraft;
  includeCreator: boolean;
  deviceEventId?: string;
  startDate: string;
  durationDays: number;
  timezone: string;
  inviteeIds: string[];
  idempotencyKey: string;
};

export type CreateChallengeResult = { challengeId: string; endDate: string; deviceEventId: string | null };
export type RespondToChallengeInput = { challengeId: string; action: 'accept' | 'decline' };
export type RespondToChallengeResult = { status: 'accepted' | 'declined'; deviceEventId: string | null };
export type DeviceSyncStatus = 'synced' | 'failed';

export async function getChallengeScheduleDate(timezone: string): Promise<{ today: string; earliestStartDate: string; currentMinuteOfDay: number }> {
  const callable = httpsCallable<{ timezone: string }, { today: string; earliestStartDate: string; currentMinuteOfDay: number }>(firebaseFunctions, 'getChallengeScheduleDate');
  return (await callable({ timezone })).data;
}

export async function getChallengeDeviceEventId(): Promise<string> {
  const callable = httpsCallable<Record<string, never>, { deviceEventId: string }>(firebaseFunctions, 'getChallengeDeviceEventId');
  return (await callable({})).data.deviceEventId;
}

export async function createChallenge(input: CreateChallengeInput): Promise<CreateChallengeResult> {
  const callable = httpsCallable<CreateChallengeInput, CreateChallengeResult>(firebaseFunctions, 'createChallenge');
  return (await callable(input)).data;
}

export async function renameChallenge(input: { challengeId: string; name: string }): Promise<void> {
  const callable = httpsCallable<typeof input, { name: string }>(firebaseFunctions, 'renameChallenge');
  await callable(input);
}

export async function respondToChallenge(input: RespondToChallengeInput & { deviceEventId?: string }): Promise<RespondToChallengeResult> {
  const callable = httpsCallable<RespondToChallengeInput & { deviceEventId?: string }, RespondToChallengeResult>(firebaseFunctions, 'respondToChallenge');
  return (await callable(input)).data;
}

export async function reportDeviceSync(input: { challengeId: string; status: DeviceSyncStatus; deviceEventId?: string }): Promise<void> {
  const callable = httpsCallable<typeof input, { status: DeviceSyncStatus }>(firebaseFunctions, 'reportDeviceSync');
  await callable(input);
}