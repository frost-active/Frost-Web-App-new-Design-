import { useState } from 'react';
import { arcMini, cn } from './format';
import { board, displayName, PEERS, type MyDayStore, type Snapshot } from './store';

type Props = { snap: Snapshot; store: MyDayStore };

/** Put one of your habits in front of a few colleagues for a fortnight — the board is the only prize. */
export default function Challenges({ snap, store }: Props) {
  const [open, setOpen] = useState(false);
  const pickable = snap.onDial;
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [draftLen, setDraftLen] = useState(14);
  const [draftWho, setDraftWho] = useState<string[]>([]);
  const draftHabit = pickable.find((h) => h.id === draftKey) || pickable[0] || null;

  const openNew = () => { setDraftKey(pickable[0]?.id ?? null); setDraftLen(14); setDraftWho([]); setOpen(true); };
  const create = () => {
    if (!draftHabit || !draftWho.length) { store.toast('Pick at least one person'); return; }
    store.createChallenge(draftHabit.k, draftLen, draftWho);
    setOpen(false);
  };

  return (
    <div className={cn('card')}>
      <h2>Challenges <span className={cn('r')}>friends &amp; colleagues</span></h2>
      {open && pickable.length > 0 && (
        <div className={cn('newchal')}>
          <p className={cn('empty')} style={{ marginBottom: 10 }}>Same habit, same window, one board. Everyone counts the days they hit <b>their own</b> target.</p>
          <div className={cn('chips')}>
            {pickable.map((h) => <button key={h.id} type="button" className={cn('chipb')} aria-pressed={draftHabit?.id === h.id} onClick={() => setDraftKey(h.id)}>{displayName(h)}</button>)}
          </div>
          <div className={cn('chips')} style={{ marginTop: 9 }}>
            {[7, 14, 21].map((n) => <button key={n} type="button" className={cn('chipb')} aria-pressed={draftLen === n} onClick={() => setDraftLen(n)}>{n} days</button>)}
          </div>
          <div className={cn('chips')} style={{ marginTop: 9 }}>
            {PEERS.map((name) => <button key={name} type="button" className={cn('chipb')} aria-pressed={draftWho.includes(name)} onClick={() => setDraftWho((w) => w.includes(name) ? w.filter((n) => n !== name) : [...w, name])}>{name}</button>)}
          </div>
          <div className={cn('rowbtns')}>
            <button type="button" className={cn('btn pri grow')} onClick={create}>Send challenge</button>
            <button type="button" className={cn('btn')} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
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
        <button type="button" className={cn('btn grow')} disabled={!pickable.length} onClick={openNew}>New challenge</button>
        <button type="button" className={cn('btn')} onClick={() => store.inviteLink()}>Copy invite link</button>
      </div>
    </div>
  );
}
