import { useState } from 'react';
import { respondToChallenge, type RespondToChallengeInput } from '../services/challengeApi';

export function useRespondToChallenge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (input: RespondToChallengeInput) => {
    setLoading(true);
    setError(null);
    try { return await respondToChallenge(input); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to respond to this invitation.';
      setError(message);
      throw cause;
    } finally { setLoading(false); }
  };

  return { respond, loading, error };
}