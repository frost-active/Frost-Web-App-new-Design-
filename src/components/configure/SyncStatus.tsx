import type { ReactNode } from 'react';
import { cn } from './format';
import type { MyDayStore, Snapshot } from './store';

const stamp = (ms: number): string => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/* ---------------------------------------------------------------------------
   Says what the Configure tab is showing and how current it is: the last synced
   schedule is still loading, was never synced, is on screen (with when it was
   synced), or could not be read. A Sync that did not complete never replaces it —
   the schedule shown is always the last one that reached both Aura and the account.
   -------------------------------------------------------------------------- */
export default function SyncStatus({ snap, store }: { snap: Snapshot; store: MyDayStore }) {
  const { status, lastSyncedAt, failed, message } = snap.sync;
  const when = lastSyncedAt ? stamp(lastSyncedAt) : null;
  let tone: 'info' | 'ok' | 'warn' = 'info';
  let body: ReactNode;
  if (status === 'loading') {
    body = 'Loading your last synced schedule…';
  } else if (status === 'error') {
    tone = 'warn';
    body = <>{when ? 'Couldn’t refresh your last synced schedule — showing the last version loaded.' : 'Couldn’t load your last synced schedule.'}{message && <small>{message}</small>}</>;
  } else if (status === 'empty') {
    tone = failed ? 'warn' : 'info';
    body = failed
      ? 'Sync didn’t complete, so nothing is saved yet. Press Sync Now to try again.'
      : snap.habits.length
        ? 'Nothing synced yet — what you see is a draft. Press Sync Now to save it to Aura and your account.'
        : 'Nothing synced yet. Add your habits, then press Sync Now to save them to Aura and your account.';
  } else if (failed) {
    tone = 'warn';
    body = `Last sync didn’t complete — showing your last successful sync${when ? ` (${when})` : ''}.`;
  } else {
    tone = 'ok';
    body = when ? `Last synced ${when}` : 'Synced to Aura and your account';
  }
  return (
    <div className={cn('syncstate')} data-tone={tone} role="status" aria-live="polite" aria-busy={status === 'loading'}>
      <span>{body}</span>
      {status === 'error' && <button type="button" className={cn('btn sm')} onClick={() => store.bridge.retryLoad()}>Retry</button>}
    </div>
  );
}
