import { useEffect, useState } from 'react';
import { useChallengeUsers } from '../hooks/useChallengeUsers';
import type { ChallengeUser } from '../services/userService';
import { cn } from './configure/format';

type Props = { currentUid: string; onClose: () => void };

export default function NewChallengeModal({ currentUid, onClose }: Props) {
  const { users, loading, error, loaded, refetch } = useChallengeUsers(currentUid);
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<ChallengeUser[]>([]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleUsers = users.filter((user) =>
    user.name.toLocaleLowerCase().includes(normalizedSearch)
    || user.email.toLocaleLowerCase().includes(normalizedSearch));

  const toggleUser = (user: ChallengeUser) => {
    setSelectedUsers((selected) => selected.some((item) => item.uid === user.uid)
      ? selected.filter((item) => item.uid !== user.uid)
      : [...selected, user]);
  };

  return (
    <div
      className={cn('challenge-backdrop')}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className={cn('challenge-modal')} role="dialog" aria-modal="true" aria-labelledby="new-challenge-title">
        <header className={cn('challenge-heading')}>
          <h2 id="new-challenge-title">New Challenge</h2>
          <button type="button" className={cn('challenge-close')} aria-label="Close" onClick={onClose}>×</button>
        </header>

        <button type="button" className={cn('btn pri challenge-load')} disabled={loading} onClick={() => void refetch()}>
          {loading && <span className={cn('spinner')} aria-hidden="true" />}
          {loading ? 'Loading...' : error ? 'Retry' : loaded ? 'Refresh List' : 'Load Participants'}
        </button>

        {error && <p className={cn('challenge-error')} role="alert">Could not load participants: {error}</p>}

        {loaded && (
          <>
            <input
              className={cn('challenge-search')}
              type="search"
              aria-label="Search participants by name or email"
              placeholder="Search name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className={cn('challenge-list')} aria-live="polite" aria-busy={loading}>
              {loading ? (
                <div className={cn('challenge-state')} role="status">Loading participants...</div>
              ) : users.length === 0 ? (
                <div className={cn('challenge-state')}>No participants found</div>
              ) : visibleUsers.length === 0 ? (
                <div className={cn('challenge-state')}>No users found</div>
              ) : visibleUsers.map((user) => (
                <label key={user.uid} className={cn('challenge-user')}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.some((selected) => selected.uid === user.uid)}
                    onChange={() => toggleUser(user)}
                  />
                  <span>{user.name} {' — '} {user.email}</span>
                </label>
              ))}
            </div>
            <p className={cn('challenge-selected')} aria-live="polite">
              Selected: <b>{selectedUsers.length}</b>
            </p>
          </>
        )}
      </section>
    </div>
  );
}