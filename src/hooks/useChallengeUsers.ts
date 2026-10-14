import { useEffect, useRef, useState } from 'react';
import { getChallengeableUsers, type ChallengeUser } from '../services/userService';

export function useChallengeUsers(currentUid: string) {
  const [users, setUsers] = useState<ChallengeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const refetch = async () => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const nextUsers = await getChallengeableUsers(currentUid);
      if (!mounted.current || activeRequest !== requestId.current) return;
      setUsers(nextUsers);
      setLoaded(true);
    } catch (cause) {
      if (!mounted.current || activeRequest !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : 'Unable to load participants. Please try again.');
    } finally {
      if (mounted.current && activeRequest === requestId.current) setLoading(false);
    }
  };

  return { users, loading, error, loaded, refetch };
}