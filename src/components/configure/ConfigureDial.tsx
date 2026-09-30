import { arcF, arcMini, CX, CY, cn, cssVars, ptH, R_DOSE, R_NUM, R_RIM, R_TICK, ringRadius, ringStep, unitFor, wedge } from './format';
import { displayName, FORM_DEFAULT, streakOf, type HabitVM, type MyDayStore, type Snapshot } from './store';

type Props = { snap: Snapshot; store: MyDayStore };

/* ---------------------------------------------------------------------------
   The day dial, ported from the "My day" prototype: a real 12-hour analog
   face (one lap = 12 hours, 3 AM and 3 PM share a spot, just like a watch).
   It is read-only — tap a ring or arc to pick that reminder. The centre shows
   today's Acknowledged count, filled in automatically whenever Statistics
   syncs (no manual logging any more). Every schedule edit happens below.
   DND (device quiet hours) is the one addition the prototype doesn't have.
   -------------------------------------------------------------------------- */
const shorten = (text: string, max: number) => text.length > max ? text.slice(0, max - 1) + '…' : text;

export default function ConfigureDial({ snap, store }: Props) {
  const list = snap.onDial;
  const n = list.length;
  const stp = ringStep(n);
  const sel = snap.selected;
  const gap = 0.006;

  return (
    <svg className={cn('dial')} id="cfg-dial" viewBox="0 0 640 640" role="img" aria-label="Your day on Aura">
      {/* device quiet hours, so the empty part of the dial still says something */}
      {snap.dndOn && (
        <>
          <path d={wedge(R_TICK, snap.dnd[0], snap.dnd[1])} className={cn('quiet')} />
          {snap.dnd.map((hour) => { const [x, y] = ptH(hour, R_TICK); return <line key={hour} x1={CX} y1={CY} x2={x} y2={y} className={cn('quietline')} />; })}
        </>
      )}

      {/* hour ticks and numbers — a plain 12-hour face, 12 marks only, like an analog watch */}
      {Array.from({ length: 12 }, (_, hour) => {
        const major = hour % 3 === 0;
        const [x1, y1] = ptH(hour, R_TICK), [x2, y2] = ptH(hour, major ? R_TICK - 14 : R_TICK - 7);
        const [tx, ty] = ptH(hour, R_NUM - 16);
        return (
          <g key={hour}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className={cn('tickline')} strokeWidth={major ? 2 : 1} />
            <text x={tx} y={ty + 4} className={`${cn('ticknum')}${major ? ` ${cn('major')}` : ''}`}>{hour === 0 ? 12 : hour}</text>
          </g>
        );
      })}

      {/* the rim: the selected reminder's streak, out of its own streak length */}
      {sel ? (() => {
        const streakDays = sel.streakDays, streak = streakOf(sel), off = Math.max(0, streak - streakDays);
        return Array.from({ length: streakDays }, (_, i) => {
          const abs = i + off;
          let cls = cn('rimseg');
          if (abs < sel.streak) cls += ` ${cn(sel.log[abs] === 2 ? 's' : 'f')}`;
          else if (abs < streak) cls += ` ${cn('f')}`;
          else if (abs === streak && !sel.formed) cls += ` ${cn('t')}`;
          return <path key={i} d={arcF(R_RIM, i / streakDays + gap, (i + 1) / streakDays - gap)} className={cls} style={cssVars({ '--c': sel.color })} />;
        });
      })() : Array.from({ length: FORM_DEFAULT }, (_, i) => <path key={i} d={arcF(R_RIM, i / FORM_DEFAULT + gap, (i + 1) / FORM_DEFAULT - gap)} className={cn('rimseg')} />)}

      {/* one ring per reminder on the dial; each cue is an arc as long as it lasts */}
      {list.map((h, index) => {
        const r = ringRadius(index, n);
        const on = sel?.id === h.id;
        const band = Math.max(2.5, Math.min(on ? 13 : 10, stp - (on ? 1 : 3)));
        const hitW = Math.max(band + 2, Math.min(band + 14, stp));
        const tap = (i: number) => {
          if (sel?.id !== h.id) { store.select(h); return; }
          if (h.k === 'pomodoro' && h.times.length > 1) { store.select(h, i); return; }
          store.toast(`Edit ${displayName(h)}’s schedule in the fields below — the clock is read-only`);
        };
        return (
          <g key={h.id}>
            <circle cx={CX} cy={CY} r={r} className={cn('cattrack')} strokeWidth={band + 2} onPointerDown={() => tap(0)} />
            {h.times.map((t, i) => {
              const sweep = Math.max(0.08, h.dur / 60) / 12, f0 = (t % 12) / 12;
              const d = arcF(r, f0, f0 + sweep);
              return (
                <g key={i}>
                  <path d={d} className={`${cn('seg')}${on ? '' : ` ${cn('dim')}`}`} stroke={h.color} strokeWidth={band} onPointerDown={() => tap(i)} />
                  <path d={d} className={`${cn('seg')} ${cn('hit')}`} stroke="transparent" strokeWidth={hitW} onPointerDown={() => tap(i)} />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* now */}
      {(() => { const [x, y] = ptH(snap.nowH, R_RIM); return <circle className={cn('nowdot')} cx={x} cy={y} r={5} />; })()}

      {/* centre: the selected reminder's day, filled in from real Acknowledged data */}
      {sel ? (() => {
        const fraction = sel.done / sel.target, met = sel.done >= sel.target, streak = streakOf(sel);
        return (
          <>
            <circle cx={CX} cy={CY} r={R_DOSE} className={cn('dosetrk')} />
            {sel.done > 0 && <path d={arcF(R_DOSE, 0, Math.min(0.9999, Math.max(0.0001, fraction)))} className={cn('dosearc')} style={cssVars({ '--c': sel.color })} />}
            <text x={CX} y={CY - 54} className={cn('ctrName')}>{shorten(displayName(sel), 18)}</text>
            <text x={CX} y={CY + 8} className={cn('ctrBig')}>{met ? '✓' : sel.done}</text>
            <text x={CX} y={CY + 32} className={cn('ctrSub')}>{(met ? 'ALL ' : 'OF ') + sel.target + ' ' + unitFor(sel.target, sel.unit).toUpperCase()}</text>
            <text x={CX} y={CY + 68} className={cn('ctrStreak')}>{streak ? `${streak} of ${sel.streakDays} days` : `day 1 of ${sel.streakDays}`}</text>
          </>
        );
      })() : (
        <>
          <text x={CX} y={CY} className={cn('ctrName')}>No habits yet</text>
          <text x={CX} y={CY + 24} className={cn('ctrSub')}>ADD ONE ON THE RIGHT</text>
        </>
      )}
    </svg>
  );
}

export function DialHint({ snap }: { snap: Snapshot }) {
  const sel = snap.selected;
  return (
    <p className={cn('dialhint')}>
      {sel
        ? <>Rim = <b>{displayName(sel)}’s {sel.streakDays}-day streak</b> · arcs = when Aura cues it · centre = today’s {sel.unit}, updated automatically each time you sync Statistics. Tap an arc to switch habit — the clock is read-only, edit times in the fields below.</>
        : 'The dial is empty until you add a habit.'}
    </p>
  );
}

/** the small progress ring used in the habit rail (kept here so it shares arcMini) */
export function MiniProgress({ h }: { h: HabitVM }) {
  const f = h.done / h.target;
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <circle className={cn('mt')} cx="17" cy="17" r="14" />
      {h.done > 0 && <path className={cn('mv')} d={arcMini(14, f, 17)} />}
    </svg>
  );
}
