import * as React from 'react';
import type { ChallengeRecord } from '../hooks/useMyChallenges';
import { useChallengeRoster } from '../hooks/useChallengeRoster';
import { useChallengeStandings } from '../hooks/useChallengeStandings';
import type { ChallengeParticipant } from '../types';
import { formatChallengeActiveDays, formatChallengeCueTimes, formatChallengeDate } from '../services/challengePresentation';
import ChallengeEndedSummary from './ChallengeEndedSummary';
import Leaderboard from './Leaderboard';

type Props = { challenge: ChallengeRecord; currentUid: string };

function statusLabel(participant: ChallengeParticipant): string {
  return participant.status === 'accepted' ? 'Accepted' : participant.status === 'invited' ? 'Pending'
    : participant.status === 'declined' ? 'Declined' : 'Expired';
}

export default function ChallengeCard({ challenge, currentUid }: Props) {
  const { participants, loading, error } = useChallengeRoster(challenge.id);
  const { standings } = useChallengeStandings(challenge.status === 'completed' ? challenge.id : null);
  return <article className="challenge-card" id={`challenge-${challenge.id}`}>
    <header><div><p className="challenge-status">{challenge.status}</p><h3>{challenge.habit.label}</h3>
      <p className="challenge-cue-times">Cue times · {formatChallengeCueTimes(challenge.habit.times)}</p></div>
      <div className="challenge-schedule-summary">
        <span>{challenge.durationDays} days · {formatChallengeDate(challenge.startDate)} to {formatChallengeDate(challenge.endDate)}</span>
        <span>Active days · {formatChallengeActiveDays(challenge.habit.days)}</span>
      </div></header>
    {challenge.status === 'pending' && <section className="challenge-roster">
      <h4>Roster</h4>
      {loading && <p role="status">Loading participants…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && <ul>{participants.map((participant) => <li key={participant.uid}>
        {participant.photoURL ? <img src={participant.photoURL} alt="" /> : <span aria-hidden="true">{participant.displayName.slice(0, 1).toUpperCase()}</span>}
        <strong>{participant.displayName}{participant.uid === currentUid ? ' · You' : ''}</strong><small>{statusLabel(participant)}</small>
      </li>)}</ul>}
    </section>}
    {challenge.status === 'active' && <Leaderboard challenge={challenge} currentUid={currentUid} />}
    {challenge.status === 'completed' && <ChallengeEndedSummary challenge={challenge} standings={standings} currentUid={currentUid} />}
    {challenge.status === 'cancelled' && <p className="challenge-muted">No invitees accepted before the start date.</p>}
  </article>;
}