import * as React from 'react';
import { useChallengeParticipants } from '../hooks/useChallengeParticipants';
import { MAX_INVITEES } from '../constants';
import type { ChallengeUser } from '../../../services/userService';

type Props = { currentUid: string; query: string; selected: ChallengeUser[]; onQuery: (value: string) => void; onSelected: (users: ChallengeUser[]) => void };

export default function FriendSearch({ currentUid, query: email, selected, onQuery, onSelected }: Props) {
  const { users, loading, error } = useChallengeParticipants(currentUid, email);
  const toggle = (user: ChallengeUser) => onSelected(selected.some((item) => item.uid === user.uid)
    ? selected.filter((item) => item.uid !== user.uid)
    : selected.length < MAX_INVITEES ? [...selected, user] : selected);
  return (
    <div className="challenge-friend-search">
      <label className="challenge-form-field">Friend's email
        <input type="email" autoComplete="off" value={email} onChange={(event) => onQuery(event.target.value)} placeholder="name@example.com" />
      </label>
      <p className="challenge-muted">Only exact email matches with a bound Frost device appear. Up to {MAX_INVITEES} friends.</p>
      {loading && <p role="status">Searching…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && email.includes('@') && !users.length && <p className="challenge-no-eligible-account">No eligible Frost account found for that email.</p>}
      <ul className="challenge-friend-results" aria-label="Matching friends">
        {users.map((user) => <li key={user.uid}>
          <label>
            <input type="checkbox" checked={selected.some((item) => item.uid === user.uid)} disabled={!selected.some((item) => item.uid === user.uid) && selected.length >= MAX_INVITEES} onChange={() => toggle(user)} />
            {user.photoURL ? <img src={user.photoURL} alt="" /> : <span className="challenge-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>}
            <span>{user.name}<small>{user.email}</small></span>
          </label>
        </li>)}
      </ul>
      <div className="challenge-selected-chips" aria-live="polite">
        {selected.map((user) => <button key={user.uid} type="button" aria-label={`Remove ${user.name}`} onClick={() => toggle(user)}>{user.name} <span aria-hidden="true">×</span></button>)}
      </div>
    </div>
  );
}