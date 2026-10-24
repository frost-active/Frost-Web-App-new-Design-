import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ChallengeUser } from '../../../services/userService';
import { computeEndDate, getChallengeScheduleError, isValidChallengeHabitDraft } from '../services/challengeRules';
import { getChallengeScheduleDate } from '../services/challengeApi';
import { formatChallengeCueTimes, formatChallengeDate } from '../services/challengePresentation';
import type { ChallengeDeviceJson, ChallengeDraftSubmission, ChallengeHabitDraft } from '../types';
import { DEFAULT_CHALLENGE_TIMEZONE } from '../constants';
import { useChallengeDeviceEventId } from '../hooks/useChallengeDeviceEventId';
import { scrollToChangedChallengeStep } from '../services/challengeStepScroll';
import ChallengeConfigForm from './ChallengeConfigForm';
import ChallengeDial from './ChallengeDial';
import DeviceGate from './DeviceGate';
import FriendSearch from './FriendSearch';
import ChallengeHabitForm from './ChallengeHabitForm';
import SendChallengeButton from './SendChallengeButton';
import ChallengeJsonActions from './ChallengeJsonActions';
import ChallengeDraftRail, { type ChallengeDraftEntry } from './ChallengeDraftRail';

type Props = {
  user: User;
  deviceConnected: boolean;
  draftId: string;
  initialName: string;
  active: boolean;
  drafts: ChallengeDraftEntry[];
  batchSubmissions: ChallengeDraftSubmission[];
  batchReady: boolean;
  batchIncludesCreator: boolean;
  batchDeviceJson: ChallengeDeviceJson | null;
  batchBusy: boolean;
  batchLocked: boolean;
  batchProgress: string | null;
  batchError: string | null;
  friendEmail: string;
  selectedFriends: ChallengeUser[];
  onSelectDraft: (id: string) => void;
  onAddDraft: () => void;
  onRemoveDraft: (id: string) => void;
  onDraftStateChange: (submission: ChallengeDraftSubmission) => void;
  onFriendEmailChange: (value: string) => void;
  onSelectedFriendsChange: (users: ChallengeUser[]) => void;
  onSendAll: () => void;
  onNameChange: (id: string, name: string) => void;
  onDraftRingChange: (id: string, cueTimes: ChallengeDraftEntry['cueTimes'], cueDurationMs: number) => void;
};

function newHabitDraft(): ChallengeHabitDraft {
  const nextCue = new Date();
  nextCue.setHours(nextCue.getHours() + 1, 0, 0, 0);
  return { label: '', times: [{ h: nextCue.getHours(), m: 0 }], days: [], display_ms: 60000 };
}

export default function NewChallengeModal({
  user, deviceConnected, draftId, initialName, active, drafts, batchSubmissions, batchReady,
  batchIncludesCreator, batchDeviceJson, batchBusy, batchLocked, batchProgress, batchError,
  friendEmail, selectedFriends, onSelectDraft, onAddDraft, onRemoveDraft, onDraftStateChange,
  onFriendEmailChange, onSelectedFriendsChange, onSendAll, onNameChange, onDraftRingChange,
}: Props) {
  const [step, setStep] = useState(1);
  const previousStep = useRef(step);
  const stepPanelRef = useRef<HTMLElement>(null);
  const [habit, setHabit] = useState<ChallengeHabitDraft>(newHabitDraft);
  const [challengeName, setChallengeName] = useState(initialName);
  const [startDate, setStartDate] = useState('');
  const [serverToday, setServerToday] = useState('');
  const [currentMinuteOfDay, setCurrentMinuteOfDay] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState(21);
  const [includeCreator, setIncludeCreator] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventIdRequest, setEventIdRequest] = useState(0);
  const { deviceEventId: candidateDeviceEventId, loading: eventIdLoading, error: eventIdError } =
    useChallengeDeviceEventId(includeCreator && step === 3, String(eventIdRequest));
  const snapshot = isValidChallengeHabitDraft(habit) ? {
    ...habit, habitId: '', text_x: 120, text_y: 100, text_size: 1,
    text_color: 65535, text_align: 1, text_width: 180,
  } : null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_CHALLENGE_TIMEZONE;
  const endDate = (() => { try { return computeEndDate(startDate, durationDays, habit.days); } catch { return ''; } })();
  const scheduleError = serverToday ? getChallengeScheduleError(startDate, serverToday, habit.times, currentMinuteOfDay) : null;
  const validStep = step === 1 ? Boolean(snapshot && challengeName.trim() && challengeName.trim().length <= 60
    && startDate && endDate && serverToday && currentMinuteOfDay !== null && !scheduleError)
    : step === 2 ? selectedFriends.length > 0
    : Boolean(snapshot && (!includeCreator || (deviceConnected && (batchLocked || candidateDeviceEventId))));

  useEffect(() => {
    onDraftRingChange(draftId, habit.times, habit.display_ms);
  }, [draftId, habit.times, habit.display_ms, onDraftRingChange]);

  useEffect(() => {
    onDraftStateChange({
      draftId,
      name: challengeName.trim(),
      habit,
      startDate,
      endDate,
      durationDays,
      timezone,
      invitees: selectedFriends.map(({ uid, name }) => ({ uid, name })),
      includeCreator,
      step,
      ready: step === 3 && validStep,
      deviceEventId: candidateDeviceEventId,
    });
  }, [draftId, challengeName, habit, startDate, endDate, durationDays, timezone, selectedFriends, includeCreator, step, validStep, candidateDeviceEventId, onDraftStateChange]);

  useLayoutEffect(() => {
    const lastStep = previousStep.current;
    previousStep.current = step;
    scrollToChangedChallengeStep(
      lastStep,
      step,
      stepPanelRef.current,
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    );
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    void getChallengeScheduleDate(timezone).then((date) => {
      if (cancelled) return;
      setServerToday(date.today);
      setCurrentMinuteOfDay(date.currentMinuteOfDay);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to check the challenge start date.');
    });
    return () => { cancelled = true; };
  }, [timezone]);

  return (
    <section className="challenge-workspace" aria-labelledby={`new-challenge-title-${draftId}`} hidden={!active}>
      <header className="challenge-setup-heading">
        <div><p>CREATE A CHALLENGE · STEP {step} OF 3</p><h2 id={`new-challenge-title-${draftId}`}>Build a habit together</h2>
          <span>One shared habit, on your schedule. Your personal Configure settings stay untouched.</span></div>
      </header>
      <div className="challenge-setup-grid">
        <div className="challenge-setup-dial cfg-dialcard">
          <ChallengeDial name={habit.label} habitLabel={habit.label} cueTimes={habit.times} cueDurationMs={habit.display_ms} startDate={startDate}
            timezone={timezone} activeDays={habit.days} durationDays={durationDays} setup draftRings={drafts}
            selectedDraftId={draftId} onSelectDraft={onSelectDraft} />
          <p className="challenge-dial-caption">The ring follows scheduled challenge days—not leaderboard check-ins.</p>
        </div>
        <div className="challenge-setup-content">
          <ChallengeDraftRail drafts={drafts} selectedId={draftId} headingId={`your-challenges-title-${draftId}`}
            onSelect={onSelectDraft} onAdd={onAddDraft} onRemove={onRemoveDraft} disabled={batchLocked || batchBusy} />
          {step === 1 && <section ref={stepPanelRef} className="challenge-modal challenge-setup-controls" aria-label="Configure your challenge">
            <fieldset className="challenge-disabled-fields" disabled={batchLocked || batchBusy}>
              <label className="challenge-name-field" htmlFor={`challenge-name-${draftId}`}>Challenge name
                <input id={`challenge-name-${draftId}`} type="text" maxLength={60} required value={challengeName}
                  aria-describedby={`challenge-name-help-${draftId}`} onChange={(event) => {
                    setChallengeName(event.target.value);
                    onNameChange(draftId, event.target.value);
                  }} />
                <small id={`challenge-name-help-${draftId}`}>This is the shared title; your device will still show the habit label.</small>
              </label>
              <ChallengeHabitForm value={habit} onChange={setHabit} />
              <ChallengeConfigForm startDate={startDate} serverToday={serverToday} currentMinuteOfDay={currentMinuteOfDay}
                times={habit.times} activeDays={habit.days} durationDays={durationDays} onStartDate={setStartDate} onDuration={setDurationDays} idSuffix={draftId} />
            </fieldset>
          </section>}
          {step === 2 && <section ref={stepPanelRef} className="challenge-modal challenge-setup-controls" aria-labelledby={`challenge-step-title-${draftId}`}>
            <h3 id={`challenge-step-title-${draftId}`} className="challenge-step-title">Invite your people</h3>
            <p className="challenge-muted">Find friends by email. They’ll need a bound Frost device to join.</p>
            <fieldset className="challenge-disabled-fields" disabled={batchLocked || batchBusy}>
            <div className="challenge-participation-choice" role="group" aria-labelledby={`challenge-participation-title-${draftId}`}>
              <p id={`challenge-participation-title-${draftId}`} className="challenge-participation-legend">Your participation</p>
              <label>
                <input type="radio" name={`challenge-participation-${draftId}`} checked={includeCreator}
                  onChange={() => setIncludeCreator(true)} />
                <span><strong>Include me</strong><small>You’ll join the challenge, sync it to your device, and appear on the leaderboard.</small></span>
              </label>
              <label>
                <input type="radio" name={`challenge-participation-${draftId}`} checked={!includeCreator}
                  onChange={() => setIncludeCreator(false)} />
                <span><strong>Exclude me</strong><small>You’ll host and see the leaderboard, but won’t participate or sync the challenge to your device.</small></span>
              </label>
            </div>
            <p className="challenge-muted">Select friends once to invite them to every challenge in this batch.</p>
            {active && <FriendSearch currentUid={user.uid} query={friendEmail} selected={selectedFriends}
              onQuery={onFriendEmailChange} onSelected={onSelectedFriendsChange} />}
            </fieldset>
          </section>}
          {step === 3 && <section ref={stepPanelRef} className="challenge-modal challenge-setup-controls" aria-labelledby={`challenge-step-title-${draftId}`}>
            <h3 id={`challenge-step-title-${draftId}`} className="challenge-step-title">Review and send</h3>
            <div className="challenge-review challenge-batch-review">
              <p>Reviewing {drafts.length} {drafts.length === 1 ? 'challenge' : 'challenges'} in this send.</p>
              {drafts.map((draft) => {
                const item = batchSubmissions.find((submission) => submission.draftId === draft.id);
                return <article key={draft.id} className="challenge-review-item">
                  <strong>{item?.name || draft.name.trim() || 'Untitled challenge'} · {item?.habit.label || 'Habit not configured'}</strong>
                  {item && <>
                    <p>Cue times · {formatChallengeCueTimes(item.habit.times)} · {item.habit.days.length ? item.habit.days.join(', ') : 'every day'}</p>
                    <p>{formatChallengeDate(item.startDate)} to {formatChallengeDate(item.endDate)} · {item.durationDays} scheduled days</p>
                    <p>Inviting {selectedFriends.map((person) => person.name).join(', ') || 'No friends selected'}</p>
                    <p>{item.includeCreator ? 'You are participating; this event will sync to your device.' : 'You are hosting only; no device event will be synced.'}</p>
                  </>}
                  {!item && <p>Finish configuring this challenge before sending the batch.</p>}
                  {item && <p className={item.ready ? 'challenge-review-ready' : 'challenge-review-pending'}>
                    {item.ready ? 'Ready to send' : `Step ${item.step} of 3 · not ready`}
                  </p>}
                </article>;
              })}
              {batchIncludesCreator && <>
                <DeviceGate connected={deviceConnected} />
                {eventIdLoading && <p role="status">Preparing a device event ID…</p>}
                {eventIdError && <div className="challenge-device-gate" role="alert">{eventIdError}<button type="button" disabled={batchLocked} onClick={() => setEventIdRequest((request) => request + 1)}>Retry</button></div>}
                <ChallengeJsonActions
                  deviceJson={batchDeviceJson}
                  pendingMessage="Complete the challenge drafts to preview the combined device JSON."
                  fileName="frost-challenge-batch"
                  note="Event IDs are provisional until the batch is saved; the actual device write uses IDs returned by the server."
                />
              </>}
            </div>
          </section>}
          {(batchError || error) && <p className="challenge-action-error" role="alert">{batchError || error}</p>}
          <footer className="challenge-setup-footer">
            {step > 1 && <button type="button" className="challenge-secondary" disabled={batchBusy || batchLocked} onClick={() => setStep((value) => value - 1)}>Back</button>}
            {step < 3
              ? <button type="button" className="challenge-primary" disabled={!validStep || batchBusy || batchLocked} onClick={() => setStep((value) => value + 1)}>{step === 1 ? 'Choose friends' : 'Review challenge'}</button>
              : <SendChallengeButton connected={!batchIncludesCreator || deviceConnected} disabled={!batchReady || batchBusy}
                progress={batchProgress} onSend={onSendAll} label={batchLocked ? 'Retry send' : 'Send all challenges'} />}
          </footer>
        </div>
      </div>
    </section>
  );
}
