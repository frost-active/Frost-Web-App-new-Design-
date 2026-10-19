import * as React from 'react';
import { ActiveDays, NameField, SliderField, TimeChip } from '../../../components/configure/fields';
import { cn } from '../../../components/configure/format';
import type { ChallengeHabitDraft } from '../types';

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ALL_DAYS = DAY_CODES.map((_, index) => index);

type Props = { value: ChallengeHabitDraft; onChange: (value: ChallengeHabitDraft) => void };

function cueHours(value: ChallengeHabitDraft): number[] {
  return value.times.map(({ h, m }) => h + m / 60);
}

export default function ChallengeHabitForm({ value, onChange }: Props) {
  const activeDays = value.days.length
    ? value.days.map((day) => DAY_CODES.indexOf(day)).filter((day) => day >= 0)
    : ALL_DAYS;
  const setActiveDays = (days: number[]) => {
    if (days.length === ALL_DAYS.length) onChange({ ...value, days: [] });
    else onChange({ ...value, days: [...days].sort((left, right) => left - right).map((day) => DAY_CODES[day]) });
  };
  const setCueCount = (count: number) => {
    const times = cueHours(value);
    while (times.length < count) {
      const sorted = [...times].sort((left, right) => left - right);
      let largestGap = -1;
      let nextTime = 9;
      sorted.forEach((time, index) => {
        const next = index === sorted.length - 1 ? (sorted[0] ?? 9) + 24 : sorted[index + 1];
        if (next - time > largestGap) {
          largestGap = next - time;
          nextTime = ((time + next) / 2) % 24;
        }
      });
      times.push(Math.round(nextTime * 2) / 2);
    }
    while (times.length > count) {
      let latest = 0;
      for (let index = 1; index < times.length; index += 1) if (times[index] > times[latest]) latest = index;
      times.splice(latest, 1);
    }
    onChange({ ...value, times: times.map((time) => ({ h: Math.floor(time), m: Math.round((time % 1) * 60) })) });
  };

  return (
    <div className="challenge-habit-form">
      <div className={cn('card')}>
        <h2>Configuration<span className={cn('r')}>Habit</span></h2>
        <div className={cn('medform')}>
          <NameField title="Label" value={value.label} placeholder="e.g. Reading" max={20} showCount={false}
            help="Text to show on device" onChange={(label) => onChange({ ...value, label })} />
          <SliderField label="Number of cues" value={value.times.length} min={1} max={12} unit="cues" sliderOnly
            count={(count) => `${count} ${count === 1 ? 'cue' : 'cues'}`} help="Drag and release to set the count."
            onCommit={setCueCount} />
          <div className={cn('msec')} style={{ marginBottom: 11 }}>
            <div className={cn('mlabel')}><span>Cue times</span></div>
            <div className={cn('chips cues')}>
              {cueHours(value).map((hour, index) => <div key={`challenge-cue-${index}`} className={cn('chipb x cue-time-card')} style={{ '--c': 'var(--c-custom)' } as React.CSSProperties}>
                <TimeChip value={hour} label={`Cue ${index + 1}`} onCommit={(next) => {
                  const times = cueHours(value).map((current, cueIndex) => cueIndex === index ? next : current);
                  onChange({ ...value, times: times.map((time) => ({ h: Math.floor(time), m: Math.round((time % 1) * 60) })) });
                }} />
              </div>)}
            </div>
            <p className={cn('mhelp')}>Drag each time slider in 15-minute steps, then choose AM or PM.</p>
          </div>
          <SliderField label="Cue lasts" value={Math.round(value.display_ms / 60000)} min={1} max={60} unit="min"
            showCount={false} showHelp={false} onCommit={(minutes) => onChange({ ...value, display_ms: minutes * 60000 })} />
          <ActiveDays days={activeDays} onToggle={(day) => {
            if (activeDays.includes(day) && activeDays.length === 1) return;
            setActiveDays(activeDays.includes(day) ? activeDays.filter((item) => item !== day) : [...activeDays, day]);
          }} />
        </div>
      </div>
    </div>
  );
}