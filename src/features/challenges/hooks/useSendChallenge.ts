import { useState } from 'react';
import { createChallenge, type CreateChallengeInput } from '../services/challengeApi';

export function useSendChallenge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (input: CreateChallengeInput) => {
    setLoading(true);
    setError(null);
    try { return await createChallenge(input); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to send challenge.';
      setError(message);
      throw cause;
    } finally { setLoading(false); }
  };

  return { send, loading, error };
}