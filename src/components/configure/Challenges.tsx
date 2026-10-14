import { useState } from 'react';
import { arcMini, cn } from './format';
import { board, displayName, type MyDayStore, type Snapshot } from './store';
import NewChallengeModal from '../NewChallengeModal';

type Props = { snap: Snapshot; store: MyDayStore; currentUid: string };

/** Put one of your habits in front of a few colleagues for a fortnight — the board is the only prize. */
export default function Challenges({ snap, store, currentUid }: Props) {
  const [open, setOpen] = useState(false);
  const openNew = () => setOpen(true);

  return (
    <div className={cn('card')}>
      <h2>Challenges <span className={cn('r')}>friends &amp; colleagues</span></h2>
      {open && <NewChallengeModal currentUid={currentUid} onClose={() => setOpen(false)} />}
      {!snap.challenges.length ? (
        <p className={cn('empty')}>No challenges running. Put one of your habits in front of a few colleagues for a fortnight — the board is the only prize.</p>
      ) : snap.challenges.map((c) => {
        const h = snap.habits.find((x) => x.k === c.hk);
        if (!h) return null;
        const gone = Math.min(c.len, Math.max(0, snap.day - c.start)), left = c.len - gone;
        const rows = board(c, h, snap.day, h.a0);
        return (
          <div key={c.id} className={cn('chal')} style={{ '--c': h.color } as React.CSSProperties}>
            <div className={cn('ch')}>
              <span className={cn('cdays')}>
                <svg viewBox="0 0 44 44" aria-hidden="true">
                  <circle className={cn('bg')} cx="22" cy="22" r="18" />
                  <path className={cn('fg')} d={arcMini(18, Math.min(0.9999, Math.max(0.0001, gone / c.len)), 22)} />
                </svg>
                <span>{left}</span>
              </span>
              <b>{displayName(h)} board<small>{c.len}-day window · {left ? `${left} day${left === 1 ? '' : 's'} left` : `finished — ${rows[0].n} took it`}</small></b>
            </div>
            <div className={cn('racers')}>
              {rows.map((r, i) => (
                <div key={r.n} className={`${cn('racer')}${r.me ? ` ${cn('me')}` : ''}${i === 0 && r.v ? ` ${cn('lead')}` : ''}`}>
                  <span className={cn('g')}>
                    <svg viewBox="0 0 62 62" aria-hidden="true">
                      <circle className={cn('gt')} cx="31" cy="31" r="26" />
                      {r.v > 0 && <path className={cn('gv')} d={arcMini(26, Math.min(0.9999, Math.max(0.0001, r.v / c.len)), 31)} />}
                    </svg>
                    <span className={cn('in')}>{r.n[0]}</span>
                  </span>
                  <p><b>{r.v}/{c.len}</b>{r.n}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className={cn('rowbtns')}>
        <button type="button" className={cn('btn grow')} onClick={openNew}>New Challenge</button>
        <button type="button" className={cn('btn')} onClick={() => store.inviteLink()}>Copy invite link</button>
      </div>
    </div>
  );
}
