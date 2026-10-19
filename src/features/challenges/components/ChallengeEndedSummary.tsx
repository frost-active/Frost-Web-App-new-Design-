import * as React from 'react';
import type { ChallengeRecord } from '../hooks/useMyChallenges';
import type { ChallengeStanding } from '../types';
import LeaderboardRow from './LeaderboardRow';

type Props = { challenge: ChallengeRecord; standings: ChallengeStanding[]; currentUid: string };

export default function ChallengeEndedSummary({ challenge, standings, currentUid }: Props) {
  const podium = standings.slice(0, 3);
  return <section className="challenge-ended-summary" aria-label={`${challenge.habit.label} final results`}>
    <h3>Final results</h3>
    {podium.length > 0 && <div className="challenge-podium" aria-label="Podium">
      {podium.map((standing) => <div key={standing.uid} className={`challenge-podium-place place-${standing.rank}`}>
        <span>{standing.rank === 1 ? 'Winner' : `Rank ${standing.rank}`}</span><strong>{standing.displayName}</strong><small>{standing.daysCompleted}/{challenge.durationDays} days</small>
      </div>)}
    </div>}
    <ol className="challenge-final-ranking">{standings.map((standing) => <LeaderboardRow key={standing.uid} standing={standing} durationDays={challenge.durationDays} currentUid={currentUid} />)}</ol>
  </section>;
}