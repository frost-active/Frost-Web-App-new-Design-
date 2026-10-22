import * as React from 'react';
import { useState } from 'react';
import type { ChallengeRecord } from '../hooks/useMyChallenges';
import { useChallengeRoster } from '../hooks/useChallengeRoster';
import { useChallengeStandings } from '../hooks/useChallengeStandings';
import type { ChallengeParticipant } from '../types';
import { formatChallengeActiveDays, formatChallengeCueTimes, formatChallengeDate } from '../services/challengePresentation';
import { renameChallenge } from '../services/challengeApi';
import ChallengeEndedSummary from './ChallengeEndedSummary';
import ChallengeDial from './ChallengeDial';
import Leaderboard from './Leaderboard';

type Props = { challenge: ChallengeRecord; currentUid: string };

function statusLabel(participant: ChallengeParticipant): string {
  return participant.status === 'accepted' ? 'Accepted' : participant.status === 'invited' ? 'Pending'
    : participant.status === 'declined' ? 'Declined' : 'Expired';
}

export default function ChallengeCard({ challenge, currentUid }: Props) {
  const { participants, loading, error } = useChallengeRoster(challenge.id);
  const { standings } = useChallengeStandings(challenge.status === 'completed' ? challenge.id : null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(challenge.name || challenge.habit.label);
  const [savingName, setSavingName] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const title = challenge.name || challenge.habit.label;
  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || nextName.length > 60) return;
    setSavingName(true);
    setRenameError(null);
    try {
      await renameChallenge({ challengeId: challenge.id, name: nextName });
      setEditingName(false);
    } catch (cause) {
      setRenameError(cause instanceof Error ? cause.message : 'Unable to rename this challenge.');
    } finally {
      setSavingName(false);
    }
  };
  const header = <header><div><p className="challenge-status">{challenge.status}</p>
    {editingName ? <form className="challenge-rename-form" onSubmit={(event) => void saveName(event)}>
      <label htmlFor={`challenge-name-${challenge.id}`}>Challenge name</label>
      <input id={`challenge-name-${challenge.id}`} value={name} maxLength={60} required
        onChange={(event) => setName(event.target.value)} />
      <button type="submit" className="challenge-primary" disabled={savingName || !name.trim()}>Save name</button>
      <button type="button" className="challenge-secondary" disabled={savingName} onClick={() => { setName(title); setEditingName(false); }}>Cancel</button>
      {renameError && <p role="alert">{renameError}</p>}
    </form> : <div className="challenge-title-row"><h3>{title}</h3>
      {challenge.creatorId === currentUid && <button type="button" className="challenge-rename-trigger" onClick={() => { setName(title); setRenameError(null); setEditingName(true); }}>Rename</button>}
    </div>}
    <p className="challenge-cue-times">Cue times · {formatChallengeCueTimes(challenge.habit.times)}</p></div>
    <div className="challenge-schedule-summary">
      <span>{challenge.durationDays} days · {formatChallengeDate(challenge.startDate)} to {formatChallengeDate(challenge.endDate)}</span>
      <span>Active days · {formatChallengeActiveDays(challenge.habit.days)}</span>
    </div></header>;
  const dial = <div className="challenge-card-dial">
    <ChallengeDial name={challenge.habit.label} habitLabel={challenge.habit.label} cueTimes={challenge.habit.times} cueDurationMs={challenge.habit.display_ms}
      startDate={challenge.startDate} timezone={challenge.timezone || 'Asia/Kolkata'} activeDays={challenge.habit.days}
      durationDays={challenge.durationDays} />
  </div>;

  return <article className="challenge-card" id={`challenge-${challenge.id}`}>
    {challenge.status === 'active'
      ? <div className="challenge-active-layout">{dial}{header}</div>
      : header}
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