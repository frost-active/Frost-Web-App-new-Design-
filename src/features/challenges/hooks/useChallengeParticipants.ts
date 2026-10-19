import { useEffect, useState } from 'react';
import { getChallengeableUsers, type ChallengeUser } from '../../../services/userService';
type ParticipantResult = { email: string; users: ChallengeUser[]; loading: boolean; error: string | null };

export function useChallengeParticipants(currentUid: string, emailQuery: string) {
  const [result, setResult] = useState<ParticipantResult>({ email: '', users: [], loading: false, error: null });
  const email = emailQuery.trim();

  useEffect(() => {
    if (!email.includes('@')) return;
    let cancelled = false;
    void getChallengeableUsers(currentUid, email).then((results) => {
      if (!cancelled) setResult({ email, users: results, loading: false, error: null });
    }).catch((cause: unknown) => {
      if (!cancelled) setResult({ email, users: [], loading: false, error: cause instanceof Error ? cause.message : 'Unable to search for a friend.' });
    });
    return () => { cancelled = true; };
  }, [currentUid, email]);

  if (!email.includes('@')) return { users: [], loading: false, error: null };
  return result.email === email ? result : { users: [], loading: true, error: null };
}