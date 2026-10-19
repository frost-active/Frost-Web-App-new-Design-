import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { firebaseDb } from '../../../firebase';
import type { ChallengeStanding } from '../types';
type StandingResult = { challengeId: string; standings: ChallengeStanding[]; loading: boolean; error: string | null };

export function useChallengeStandings(challengeId: string | null) {
  const [result, setResult] = useState<StandingResult>({ challengeId: '', standings: [], loading: false, error: null });

  useEffect(() => {
    if (!challengeId) return;
    const reference = query(collection(firebaseDb, 'challenges', challengeId, 'standings'), orderBy('rank'));
    return onSnapshot(reference, (snapshot) => {
      setResult({ challengeId, standings: snapshot.docs.map((item) => item.data() as ChallengeStanding), loading: false, error: null });
    }, (cause) => {
      setResult({ challengeId, standings: [], loading: false, error: cause.message || 'Unable to load the leaderboard.' });
    });
  }, [challengeId]);

  if (!challengeId) return { challengeId: null, standings: [], loading: false, error: null };
  return result.challengeId === challengeId ? result : { challengeId, standings: [], loading: true, error: null };
}