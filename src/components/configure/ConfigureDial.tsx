import { arcF, arcMini, CX, CY, cn, cssVars, ptH, R_DOSE, R_NUM, R_RIM, R_TICK, ringRadius, ringStep, TAU, TOP, to12, unitFor, wedge } from './format';
import { dayOf, displayName, FORM_DEFAULT, streakOf, type HabitVM, type MyDayStore, type Snapshot } from './store';

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

function cueMeridiems(times: number[]) {
  const cues = new Map<string, { time: number; indexes: number[]; periods: Set<'AM' | 'PM'> }>();
  times.forEach((time, index) => {
    const { mer } = to12(time);
    const ringTime = ((time % 12) + 12) % 12;
    const key = ringTime.toFixed(8);
    const cue = cues.get(key) ?? { time, indexes: [], periods: new Set<'AM' | 'PM'>() };
    cue.indexes.push(index);
    cue.periods.add(mer);
    cues.set(key, cue);
  });
  return [...cues.values()].map(({ time, indexes, periods }) => ({
    time,
    indexes,
    label: (['AM', 'PM'] as const).filter((period) => periods.has(period)).join('/'),
    times: [...new Set(indexes.map((index) => times[index]))],
  }));
}

function cueArcPath(radius: number, sweepHours: number) {
  const sweep = sweepHours / 12 * TAU;
  const halfSweep = sweep / 2;
  const large = sweepHours > 6 ? 1 : 0;
  const halfX = radius * Math.sin(halfSweep), y = radius * (1 - Math.cos(halfSweep));
  return `M${(-halfX).toFixed(2)} ${y.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${halfX.toFixed(2)} ${y.toFixed(2)}`;
}

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
            <circle cx={CX} cy={CY} r={r} className={`${cn('cattrack')}${on ? ` ${cn('selectedtrack')}` : ''}`} style={cssVars({ '--c': h.color })} strokeWidth={band + 2} onPointerDown={() => tap(0)} />
            {cueMeridiems(h.times).map(({ time, indexes, label, times }) => {
              const sweepHours = Math.max(0.08, h.dur / 60);
              const theta = TOP + (((time + sweepHours / 2) % 12) / 12) * TAU;
              const rotation = theta * 180 / Math.PI + 90;
              const x = CX + r * Math.cos(theta), y = CY + r * Math.sin(theta);
              return (
                <g key={`${h.id}:${time}:${label}`} transform={`translate(${x} ${y}) rotate(${rotation})`}>
                  {indexes.map((i) => {
                    const d = cueArcPath(r, sweepHours);
                    return (
                      <g key={i} style={cssVars({ '--c': h.color })}>
                        <path d={d} className={`${cn('seg')}${on ? '' : ` ${cn('dim')}`}`} stroke={h.color} strokeWidth={band} onPointerDown={() => tap(i)} />
                        <path d={d} className={`${cn('seg')} ${cn('hit')}`} stroke="transparent" strokeWidth={hitW} onPointerDown={() => tap(i)} />
                      </g>
                    );
                  })}
                  {times.map((cueTime, markerIndex) => {
                    const markerOffset = times.length > 1 ? (markerIndex === 0 ? -5.2 : 5.2) : 0;
                    const cueIndex = indexes.find((index) => h.times[index] === cueTime) ?? indexes[0] ?? 0;
                    const { h12, m, mer } = to12(cueTime);
                    const timeLabel = `${h12}${m === 0 ? '' : `:${String(m).padStart(2, '0')}`} ${mer}`;
                    return (
                      <g key={cueTime} className={cn('time-node')} style={cssVars({ '--c': h.color })}
                        role="button" tabIndex={0} aria-label={`Select ${displayName(h)} at ${timeLabel}`}
                        onPointerDown={(event) => { event.stopPropagation(); tap(cueIndex); }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            tap(cueIndex);
                          }
                        }}>
                        <title>{timeLabel}</title>
                        <circle cx={markerOffset} cy={0} r={5.5} />
                      </g>
                    );
                  })}
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
        const fraction = sel.done / sel.target, met = sel.done >= sel.target;
        const currentDay = dayOf(sel);
        return (
          <>
            <circle cx={CX} cy={CY} r={R_DOSE} className={cn('dosetrk')} />
            {sel.done > 0 && <path d={arcF(R_DOSE, 0, Math.min(0.9999, Math.max(0.0001, fraction)))} className={cn('dosearc')} style={cssVars({ '--c': sel.color })} />}
            <text x={CX} y={CY - 54} className={cn('ctrName')}>{shorten(displayName(sel), 18)}</text>
            <text x={CX} y={CY + 8} className={cn('ctrBig')}>{met ? '✓' : sel.done}</text>
            <text x={CX} y={CY + 32} className={cn('ctrSub')}>{(met ? 'ALL ' : 'OF ') + sel.target + ' ' + unitFor(sel.target, sel.unit).toUpperCase()}</text>
            <text x={CX} y={CY + 68} className={cn('ctrStreak')}>{`day ${currentDay} of ${sel.streakDays}`}</text>
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
