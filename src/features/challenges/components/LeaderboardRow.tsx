import * as React from 'react';
import type { ChallengeStanding } from '../types';

type Props = { standing: ChallengeStanding; durationDays: number; currentUid: string };

export default function LeaderboardRow({ standing, durationDays, currentUid }: Props) {
  const isCurrentUser = standing.uid === currentUid;
  return <li className={`challenge-leaderboard-row${isCurrentUser ? ' is-you' : ''}`}>
    <span className="challenge-rank">{standing.rank}</span>
    {standing.photoURL ? <img className="challenge-avatar-image" src={standing.photoURL} alt="" />
      : <span className="challenge-avatar-fallback" aria-hidden="true">{standing.displayName.slice(0, 1).toUpperCase()}</span>}
    <span className="challenge-leaderboard-name">{standing.displayName}{isCurrentUser && <small>You</small>}</span>
    <span className="challenge-progress-count" aria-label={`${standing.daysCompleted} of ${durationDays} days completed`}>{standing.daysCompleted}/{durationDays} days</span>
    <span className="challenge-streak-count">{standing.currentStreak} current · {standing.longestStreak} best</span>
  </li>;
}