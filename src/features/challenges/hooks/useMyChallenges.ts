import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firebaseDb } from '../../../firebase';
import type { Challenge } from '../types';

export type ChallengeRecord = Challenge & { id: string };
type ChallengeResult = { uid: string; challenges: ChallengeRecord[]; loading: boolean; error: string | null };

export function useMyChallenges(uid: string) {
  const [result, setResult] = useState<ChallengeResult>({ uid: '', challenges: [], loading: true, error: null });

  useEffect(() => {
    const reference = query(collection(firebaseDb, 'challenges'), where('participantIds', 'array-contains', uid));
    return onSnapshot(reference, (snapshot) => {
      setResult({
        uid,
        challenges: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChallengeRecord)
          .sort((left, right) => left.startDate.localeCompare(right.startDate)),
        loading: false,
        error: null,
      });
    }, (cause) => {
      setResult({ uid, challenges: [], loading: false, error: cause.message || 'Unable to load challenges.' });
    });
  }, [uid]);

  return result.uid === uid ? result : { uid, challenges: [], loading: true, error: null };
}