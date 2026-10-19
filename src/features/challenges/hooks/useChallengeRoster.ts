import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firebaseDb } from '../../../firebase';
import type { ChallengeParticipant } from '../types';
type RosterResult = { challengeId: string; participants: ChallengeParticipant[]; loading: boolean; error: string | null };

export function useChallengeRoster(challengeId: string) {
  const [result, setResult] = useState<RosterResult>({ challengeId: '', participants: [], loading: true, error: null });

  useEffect(() => {
    const reference = collection(firebaseDb, 'challenges', challengeId, 'participants');
    return onSnapshot(reference, (snapshot) => {
      setResult({ challengeId, participants: snapshot.docs.map((item) => item.data() as ChallengeParticipant), loading: false, error: null });
    }, (cause) => {
      setResult({ challengeId, participants: [], loading: false, error: cause.message || 'Challenge participants could not be loaded.' });
    });
  }, [challengeId]);

  return result.challengeId === challengeId ? result : { challengeId, participants: [], loading: true, error: null };
}