import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebaseDb } from '../../../firebase';
import type { ChallengeHabitSnapshot, ChallengeParticipant } from '../types';
import type { ChallengeRecord } from './useMyChallenges';

export type ChallengeInvite = ChallengeParticipant & {
  challengeId: string;
  creatorName: string;
  name: string;
  habitLabel: string;
  habit: ChallengeHabitSnapshot;
  startDate: string;
  endDate: string;
  durationDays: number;
  timezone: string;
};
type InviteResult = { challengeIds: string; invites: ChallengeInvite[] };

export function useChallengeInvites(challenges: ChallengeRecord[], uid: string) {
  const [result, setResult] = useState<InviteResult>({ challengeIds: '', invites: [] });
  const challengeIds = challenges.map((challenge) => challenge.id).sort().join('|');

  useEffect(() => {
    const ids = challengeIds ? challengeIds.split('|') : [];
    if (!ids.length) return;
    const values = new Map<string, ChallengeInvite>();
    const stops = ids.map((challengeId) => {
      const challenge = challenges.find((item) => item.id === challengeId);
      return onSnapshot(doc(firebaseDb, 'challenges', challengeId, 'participants', uid), (snapshot) => {
        if (!snapshot.exists() || !challenge) values.delete(challengeId);
        else values.set(challengeId, {
          ...(snapshot.data() as ChallengeParticipant), challengeId,
          creatorName: challenge.creatorName, name: challenge.name || challenge.habit.label, habitLabel: challenge.habit.label,
          habit: challenge.habit,
          startDate: challenge.startDate, endDate: challenge.endDate,
          durationDays: challenge.durationDays, timezone: challenge.timezone,
        });
        setResult({ challengeIds, invites: [...values.values()] });
      }, () => {
        values.delete(challengeId);
        setResult({ challengeIds, invites: [...values.values()] });
      });
    });
    return () => stops.forEach((stop) => stop());
  }, [challengeIds, challenges, uid]);

  return result.challengeIds === challengeIds ? result.invites : [];
}