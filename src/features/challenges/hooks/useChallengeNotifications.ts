import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { firebaseDb } from '../../../firebase';

export type ChallengeNotification = {
  id: string;
  type: 'challenge_invite' | 'challenge_accepted' | 'challenge_started' | 'challenge_cancelled' | 'challenge_ended';
  challengeId: string;
  title: string;
  body: string;
  createdAt: Timestamp | null;
  readAt?: Timestamp | null;
};
type NotificationResult = { uid: string; notifications: ChallengeNotification[]; loading: boolean; error: string | null };

export function useChallengeNotifications(uid: string) {
  const [result, setResult] = useState<NotificationResult>({ uid: '', notifications: [], loading: true, error: null });

  useEffect(() => {
    const reference = query(collection(firebaseDb, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(reference, (snapshot) => {
      setResult({
        uid,
        notifications: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChallengeNotification)
          .filter((item) => item.type.startsWith('challenge_')),
        loading: false,
        error: null,
      });
    }, (cause) => {
      setResult({ uid, notifications: [], loading: false, error: cause.message || 'Notifications could not be loaded.' });
    });
  }, [uid]);

  return result.uid === uid ? result : { uid, notifications: [], loading: true, error: null };
}