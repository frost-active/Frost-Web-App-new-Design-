import * as React from 'react';
import type { ChallengeRecord } from '../hooks/useMyChallenges';
import { useChallengeStandings } from '../hooks/useChallengeStandings';
import LeaderboardRow from './LeaderboardRow';

type Props = { challenge: ChallengeRecord; currentUid: string };

export default function Leaderboard({ challenge, currentUid }: Props) {
  const { standings, loading, error } = useChallengeStandings(challenge.id);
  return <section className="challenge-leaderboard" aria-label={`${challenge.habit.label} leaderboard`}>
    <h3>Leaderboard</h3>
    {loading && <p role="status">Loading standings…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !standings.length && <p>No completed days yet.</p>}
    {!!standings.length && <ol>{standings.map((standing) => <LeaderboardRow key={standing.uid} standing={standing} durationDays={challenge.durationDays} currentUid={currentUid} />)}</ol>}
  </section>;
}