import * as React from 'react';
import { arcF, CX, CY, cn, cssVars, ptH, R_DOSE, R_NUM, R_TICK, ringRadius, ringStep, TAU, TOP, to12 } from '../../../components/configure/format';
import { useEffect, useState } from 'react';
import { scheduledChallengeDay } from '../services/challengeSchedule';

type Props = {
  name: string;
  habitLabel: string;
  cueTimes: Array<{ h: number; m: number }>;
  cueDurationMs?: number;
  startDate: string;
  timezone: string;
  activeDays: string[];
  durationDays: number;
  setup?: boolean;
  emptyState?: boolean;
  draftRings?: ChallengeDraftRing[];
  selectedDraftId?: string;
  onSelectDraft?: (id: string) => void;
};

export type ChallengeDraftRing = {
  id: string;
  name: string;
  cueTimes: Array<{ h: number; m: number }>;
  cueDurationMs: number;
};

function cueArcPath(radius: number, sweepHours: number) {
  const sweep = sweepHours / 12 * TAU;
  const halfSweep = sweep / 2;
  const large = sweepHours > 6 ? 1 : 0;
  const halfX = radius * Math.sin(halfSweep), y = radius * (1 - Math.cos(halfSweep));
  return `M${(-halfX).toFixed(2)} ${y.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${halfX.toFixed(2)} ${y.toFixed(2)}`;
}

function cueMeridiems(times: Array<{ h: number; m: number }>) {
  const hours = times.map(({ h, m }) => h + m / 60);
  const cues = new Map<string, { time: number; indexes: number[]; periods: Set<'AM' | 'PM'> }>();
  hours.forEach((time, index) => {
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
    times: [...new Set(indexes.map((index) => hours[index]))],
  }));
}

function currentHourInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour + minute / 60;
}

const shorten = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
const CHALLENGE_CLOCK_TIMEZONE = 'Asia/Kolkata';

export default function ChallengeDial({ name, habitLabel, cueTimes, cueDurationMs = 60_000, startDate, timezone, activeDays, durationDays, setup = false, emptyState = false, draftRings, selectedDraftId, onSelectDraft }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const day = startDate ? scheduledChallengeDay(startDate, timezone, activeDays, durationDays, now) : 0;
  const progress = durationDays > 0 ? day / durationDays : 0;
  const ringCount = draftRings?.length || 1;
  const ring = ringRadius(0, ringCount);
  const step = ringStep(ringCount);
  const band = Math.max(2.5, Math.min(13, step - 1));
  const indiaHour = currentHourInTimezone(now, CHALLENGE_CLOCK_TIMEZONE);
  const [nowX, nowY] = ptH(indiaHour, R_TICK + 7);

  return (
    <svg className={`${cn('dial challenge-dial')}${emptyState ? ' challenge-dial-empty' : ''}`} viewBox="0 0 640 640" role="img"
      aria-label={emptyState ? 'No Challenges Yet. ADD ONE ON THE RIGHT' : `${name || habitLabel || 'Challenge'}: Day ${day} of ${durationDays}`}>
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

      {!emptyState && (draftRings ? draftRings.map((draft, index) => {
        const draftRing = ringRadius(index, ringCount);
        const selected = draft.id === selectedDraftId;
        const draftBand = Math.max(2.5, Math.min(selected ? 13 : 10, step - (selected ? 1 : 3)));
        const selectDraft = () => onSelectDraft?.(draft.id);
        return (
          <g key={draft.id}>
            <circle cx={CX} cy={CY} r={draftRing} className={`${cn('cattrack')}${selected ? ` ${cn('selectedtrack')}` : ''}`}
              style={cssVars({ '--c': 'var(--c-custom)' })} strokeWidth={draftBand + 2}
              role="button" tabIndex={0} aria-label={`Select ${draft.name || 'Untitled challenge'} ring`}
              onPointerDown={selectDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectDraft();
                }
              }} />
            {cueMeridiems(draft.cueTimes).map(({ time, indexes, label, times }) => {
              const sweepHours = Math.max(0.08, draft.cueDurationMs / 3_600_000);
              const theta = TOP + (((time + sweepHours / 2) % 12) / 12) * TAU;
              const rotation = theta * 180 / Math.PI + 90;
              const x = CX + draftRing * Math.cos(theta), y = CY + draftRing * Math.sin(theta);
              return (
                <g key={`${draft.id}:${time}:${label}`} transform={`translate(${x} ${y}) rotate(${rotation})`}>
                  {indexes.map((index) => <path key={index} d={cueArcPath(draftRing, sweepHours)} className={cn('seg')}
                    stroke="var(--c-custom)" strokeWidth={draftBand} onPointerDown={selectDraft} />)}
                  {times.map((cueTime, cueIndex) => {
                    const markerOffset = times.length > 1 ? (cueIndex === 0 ? -5.2 : 5.2) : 0;
                    const { h12, m, mer } = to12(cueTime);
                    const labelText = `${h12}${m === 0 ? '' : `:${String(m).padStart(2, '0')}`} ${mer}`;
                    return (
                      <g key={cueTime} className={cn('time-node')} style={cssVars({ '--c': 'var(--c-custom)' })} aria-label={labelText}
                        onPointerDown={selectDraft}>
                        <title>{labelText}</title>
                        <circle cx={markerOffset} cy={0} r={5.5} />
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      }) : <>
        <circle cx={CX} cy={CY} r={ring} className={`${cn('cattrack')} ${cn('selectedtrack')}`}
          style={cssVars({ '--c': 'var(--c-custom)' })} strokeWidth={band + 2} />
        {cueMeridiems(cueTimes).map(({ time, indexes, label, times }) => {
          const sweepHours = Math.max(0.08, cueDurationMs / 3_600_000);
          const theta = TOP + (((time + sweepHours / 2) % 12) / 12) * TAU;
          const rotation = theta * 180 / Math.PI + 90;
          const x = CX + ring * Math.cos(theta), y = CY + ring * Math.sin(theta);
          return (
            <g key={`${time}:${label}`} transform={`translate(${x} ${y}) rotate(${rotation})`}>
              {indexes.map((index) => {
                const path = cueArcPath(ring, sweepHours);
                return <path key={index} d={path} className={cn('seg')} stroke="var(--c-custom)" strokeWidth={band} />;
              })}
              {times.map((cueTime, index) => {
                const markerOffset = times.length > 1 ? (index === 0 ? -5.2 : 5.2) : 0;
                const { h12, m, mer } = to12(cueTime);
                const labelText = `${h12}${m === 0 ? '' : `:${String(m).padStart(2, '0')}`} ${mer}`;
                return (
                  <g key={cueTime} className={cn('time-node')} style={cssVars({ '--c': 'var(--c-custom)' })} aria-label={labelText}>
                    <title>{labelText}</title>
                    <circle cx={markerOffset} cy={0} r={5.5} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </>)}

      <circle className={`${cn('nowdot')} challenge-nowdot`} cx={nowX} cy={nowY} r={5}
        style={{ fill: '#fff', stroke: 'rgba(4,24,40,.55)', strokeWidth: 1.5 }} />
      {!emptyState && <>
        <circle cx={CX} cy={CY} r={R_DOSE} className={cn('dosetrk')} />
        {progress > 0 && <path d={arcF(R_DOSE, 0, Math.min(0.9999, Math.max(0.0001, progress)))}
          className={cn('dosearc')} style={cssVars({ '--c': 'var(--mint)' })} />}
      </>}
      {emptyState ? <>
        <text x={CX} y={CY} className={cn('ctrName')}>No Challenges Yet</text>
        <text x={CX} y={CY + 24} className={cn('ctrSub')}>ADD ONE ON THE RIGHT</text>
      </> : <>
        <text x={CX} y={CY - 54} className={cn('ctrName')}>{shorten(name || (setup ? 'Name your challenge' : habitLabel), 18)}</text>
        <text x={CX} y={CY + 8} className={cn('ctrBig')}>{day}</text>
        <text x={CX} y={CY + 32} className={cn('ctrSub')}>OF {durationDays || '—'} SCHEDULED DAYS</text>
        <text x={CX} y={CY + 68} className={cn('ctrStreak')}>{`Day ${day} of ${durationDays || '—'}`}</text>
      </>}
    </svg>
  );
}
