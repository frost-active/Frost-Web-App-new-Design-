import { useEffect, useState } from 'react';
import { getChallengeDeviceEventId } from '../services/challengeApi';

type Result = { requestKey: string; deviceEventId: string | null; loading: boolean; error: string | null };

export function useChallengeDeviceEventId(enabled: boolean, refreshKey = ''): Result {
  const [result, setResult] = useState<Result>({ requestKey: '', deviceEventId: null, loading: false, error: null });

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void getChallengeDeviceEventId().then((deviceEventId) => {
      if (current) setResult({ requestKey: refreshKey, deviceEventId, loading: false, error: null });
    }).catch((cause: unknown) => {
      if (current) setResult({
        requestKey: refreshKey,
        deviceEventId: null,
        loading: false,
        error: cause instanceof Error ? cause.message : 'Unable to prepare the challenge device event.',
      });
    });
    return () => { current = false; };
  }, [enabled, refreshKey]);

  if (!enabled) return { requestKey: refreshKey, deviceEventId: null, loading: false, error: null };
  if (result.requestKey !== refreshKey) return { requestKey: refreshKey, deviceEventId: null, loading: true, error: null };
  return result;
}
