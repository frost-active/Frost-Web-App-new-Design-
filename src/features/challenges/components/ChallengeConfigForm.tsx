import * as React from 'react';
import { SliderField } from '../../../components/configure/fields';
import { cn } from '../../../components/configure/format';
import { MAX_DURATION_DAYS, MIN_CUSTOM_DURATION_DAYS } from '../constants';
import { computeEndDate } from '../services/challengeRules';
import { getChallengeScheduleError } from '../services/challengeRules';
import { formatChallengeDate } from '../services/challengePresentation';

type Props = {
  startDate: string;
  serverToday: string;
  currentMinuteOfDay: number | null;
  times: Array<{ h: number; m: number }>;
  activeDays: string[];
  durationDays: number;
  onStartDate: (value: string) => void;
  onDuration: (value: number) => void;
};

export default function ChallengeConfigForm({ startDate, serverToday, currentMinuteOfDay, times, activeDays, durationDays, onStartDate, onDuration }: Props) {
  let endDate = '';
  let endDateError: string | null = null;
  try { endDate = computeEndDate(startDate, durationDays, activeDays); }
  catch (cause) { endDateError = cause instanceof Error ? cause.message : 'Choose a valid start date and duration.'; }
  const scheduleError = serverToday
    ? getChallengeScheduleError(startDate, serverToday, times, currentMinuteOfDay)
    : null;
  const dateError = scheduleError || endDateError;
  return (
    <div className="challenge-config-form">
      <div className={cn('msec')}>
        <div className={cn('mlabel')}><label htmlFor="challenge-start-date">Start date</label></div>
        <input id="challenge-start-date" className={cn('minput')} type="date" required min={serverToday || undefined} max="9999-12-31"
          aria-describedby={dateError ? 'challenge-start-date-error' : undefined}
          value={startDate} onChange={(event) => onStartDate(event.target.value)} />
      </div>
      <SliderField label="Streak length" value={durationDays} min={MIN_CUSTOM_DURATION_DAYS} max={MAX_DURATION_DAYS} unit="days"
        showCount={false} showHelp={false} onCommit={onDuration} />
      <p className="challenge-date-summary">Ends <strong>{endDate ? formatChallengeDate(endDate) : 'Choose a valid start and duration'}</strong> (inclusive)</p>
      {!serverToday && <p className="challenge-muted" role="status">Checking the challenge timezone…</p>}
      {dateError && <p id="challenge-start-date-error" className="challenge-action-error" role="alert">{dateError}</p>}
    </div>
  );
}