import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '../../../firebase';
import type { ConfigureBridge } from '../../../components/configure/types';
import type { Challenge, ChallengeHabitSnapshot } from '../types';
import { reportDeviceSync, respondToChallenge } from './challengeApi';
import { syncChallengeToDevice } from './challengeDeviceSync';

export class ChallengeDeviceSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChallengeDeviceSyncError';
  }
}

export async function respondAndSyncChallenge(input: {
  challengeId: string;
  action: 'accept' | 'decline';
  uid: string;
  deviceConnected: boolean;
  deviceMac: string | null;
  deviceEventId?: string;
  bridge: ConfigureBridge;
}): Promise<{ status: 'accepted' | 'declined'; deviceEventId: string | null }> {
  if (input.action === 'accept' && !input.deviceConnected) throw new Error('Connect your Frost device before accepting.');
  const result = await respondToChallenge({ challengeId: input.challengeId, action: input.action, deviceEventId: input.deviceEventId });
  if (input.action === 'decline') return result;
  if (!result.deviceEventId) throw new Error('The accepted challenge has no device event ID.');
  if (!input.deviceMac) throw new Error('Connect your Frost device before syncing this challenge.');

  try {
    const challengeSnapshot = await getDoc(doc(firebaseDb, 'challenges', input.challengeId));
    if (!challengeSnapshot.exists()) throw new Error('Challenge details could not be loaded.');
    const challenge = challengeSnapshot.data() as Challenge;
    await syncChallengeToDevice(input.bridge, {
      habit: challenge.habit as ChallengeHabitSnapshot,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      deviceEventId: result.deviceEventId,
    });
    await reportDeviceSync({ challengeId: input.challengeId, status: 'synced', deviceEventId: result.deviceEventId });
  } catch (cause) {
    await reportDeviceSync({ challengeId: input.challengeId, status: 'failed', deviceEventId: result.deviceEventId }).catch(() => undefined);
    throw new ChallengeDeviceSyncError(cause instanceof Error ? cause.message : 'Challenge was accepted, but device sync failed.');
  }

  return result;
}