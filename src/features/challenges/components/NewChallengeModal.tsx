import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ConfigureBridge } from '../../../components/configure/types';
import type { ChallengeUser } from '../../../services/userService';
import { computeEndDate, getChallengeScheduleError, isValidChallengeHabitDraft } from '../services/challengeRules';
import { createChallenge, getChallengeScheduleDate, reportDeviceSync } from '../services/challengeApi';
import { buildChallengeDeviceJson, syncChallengeToDevice } from '../services/challengeDeviceSync';
import { formatChallengeCueTimes, formatChallengeDate } from '../services/challengePresentation';
import type { ChallengeHabitDraft, ChallengeHabitSnapshot } from '../types';
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

type Props = { user: User; deviceConnected: boolean; bridge: ConfigureBridge };
type RetryState = { challengeId: string; deviceEventId: string; habit: ChallengeHabitSnapshot; startDate: string; endDate: string };

function newHabitDraft(): ChallengeHabitDraft {
  const nextCue = new Date();
  nextCue.setHours(nextCue.getHours() + 1, 0, 0, 0);
  return { label: '', times: [{ h: nextCue.getHours(), m: 0 }], days: [], display_ms: 60000 };
}

export default function NewChallengeModal({ user, deviceConnected, bridge }: Props) {
  const idempotencyKey = useRef<string | null>(null);
  const [step, setStep] = useState(1);
  const previousStep = useRef(step);
  const stepPanelRef = useRef<HTMLElement>(null);
  const [habit, setHabit] = useState<ChallengeHabitDraft>(newHabitDraft);
  const [challengeName, setChallengeName] = useState('My challenge');
  const [startDate, setStartDate] = useState('');
  const [serverToday, setServerToday] = useState('');
  const [currentMinuteOfDay, setCurrentMinuteOfDay] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState(21);
  const [email, setEmail] = useState('');
  const [invitees, setInvitees] = useState<ChallengeUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryState | null>(null);
  const [assignedDeviceEventId, setAssignedDeviceEventId] = useState<string | null>(null);
  const [eventIdRequest, setEventIdRequest] = useState(0);
  const { deviceEventId: candidateDeviceEventId, loading: eventIdLoading, error: eventIdError } = useChallengeDeviceEventId(true, String(eventIdRequest));
  const snapshot = isValidChallengeHabitDraft(habit) ? {
    ...habit, habitId: '', text_x: 120, text_y: 100, text_size: 1,
    text_color: 65535, text_align: 1, text_width: 180,
  } : null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_CHALLENGE_TIMEZONE;
  const endDate = (() => { try { return computeEndDate(startDate, durationDays, habit.days); } catch { return ''; } })();
  const deviceEventId = assignedDeviceEventId || candidateDeviceEventId;
  const deviceJson = snapshot && endDate && deviceEventId ? buildChallengeDeviceJson({
    habit: { ...snapshot, habitId: deviceEventId },
    startDate,
    endDate,
    deviceEventId,
  }) : null;
  const scheduleError = serverToday ? getChallengeScheduleError(startDate, serverToday, habit.times, currentMinuteOfDay) : null;
  const validStep = step === 1 ? Boolean(snapshot && challengeName.trim() && challengeName.trim().length <= 60
    && startDate && endDate && serverToday && currentMinuteOfDay !== null && !scheduleError && candidateDeviceEventId)
    : step === 2 ? invitees.length > 0
    : Boolean(snapshot && deviceConnected);

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

  const syncChallenge = async (state: RetryState) => {
    await syncChallengeToDevice(bridge, {
      habit: state.habit, startDate: state.startDate, endDate: state.endDate, deviceEventId: state.deviceEventId,
    });
    await reportDeviceSync({ challengeId: state.challengeId, status: 'synced', deviceEventId: state.deviceEventId });
    setRetry(null);
    setCompleted(true);
    setProgress('Done. Challenge synced to your device.');
  };

  const send = async () => {
    if (!snapshot || !deviceConnected || !validStep || completed) return;
    setBusy(true); setError(null); setProgress('Saving challenge…');
    setCompleted(false);
    idempotencyKey.current ||= crypto.randomUUID();
    let createdChallenge: RetryState | null = null;
    try {
      const serverSchedule = await getChallengeScheduleDate(timezone);
      setServerToday(serverSchedule.today);
      setCurrentMinuteOfDay(serverSchedule.currentMinuteOfDay);
      const latestScheduleError = getChallengeScheduleError(startDate, serverSchedule.today, habit.times, serverSchedule.currentMinuteOfDay);
      if (latestScheduleError) {
        setStep(1);
        setError(latestScheduleError);
        setProgress(null);
        return;
      }
      const created = await createChallenge({
        name: challengeName.trim(), habit, deviceEventId: candidateDeviceEventId || undefined, startDate, durationDays,
        timezone, inviteeIds: invitees.map((person) => person.uid), idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = null;
      if (!created.deviceEventId) throw new Error('The challenge was saved without a device event ID. Contact support before retrying.');
      setAssignedDeviceEventId(created.deviceEventId);
      const state: RetryState = { challengeId: created.challengeId, deviceEventId: created.deviceEventId, habit: { ...snapshot, habitId: created.deviceEventId }, startDate, endDate: created.endDate };
      createdChallenge = state;
      setRetry(state);
      setProgress('Syncing device…');
      await syncChallenge(state);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Challenge sync failed.';
      if (/current time/i.test(message)) setStep(1);
      setError(message);
      if (createdChallenge) {
        await reportDeviceSync({ challengeId: createdChallenge.challengeId, status: 'failed', deviceEventId: createdChallenge.deviceEventId }).catch(() => undefined);
      }
      setProgress(null);
    } finally { setBusy(false); }
  };

  const retrySync = async () => {
    if (!retry || !deviceConnected) return;
    setBusy(true); setError(null); setProgress('Syncing device…');
    try { await syncChallenge(retry); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Device sync failed.');
      await reportDeviceSync({ challengeId: retry.challengeId, status: 'failed', deviceEventId: retry.deviceEventId }).catch(() => undefined);
      setProgress(null);
    } finally { setBusy(false); }
  };

  const startAnother = () => {
    idempotencyKey.current = null;
    setStep(1);
    setHabit(newHabitDraft());
    setChallengeName('My challenge');
    setStartDate('');
    setDurationDays(21);
    setInvitees([]);
    setEmail('');
    setRetry(null);
    setAssignedDeviceEventId(null);
    setEventIdRequest((request) => request + 1);
    setError(null);
    setProgress(null);
    setCompleted(false);
  };

  return (
    <section className="challenge-workspace" aria-labelledby="new-challenge-title">
      <header className="challenge-setup-heading">
        <div><p>CREATE A CHALLENGE · STEP {step} OF 3</p><h2 id="new-challenge-title">Build a habit together</h2>
          <span>One shared habit, on your schedule. Your personal Configure settings stay untouched.</span></div>
      </header>
      <div className="challenge-setup-grid">
        <div className="challenge-setup-dial cfg-dialcard">
          <ChallengeDial name={habit.label} habitLabel={habit.label} cueTimes={habit.times} cueDurationMs={habit.display_ms} startDate={startDate}
            timezone={timezone} activeDays={habit.days} durationDays={durationDays} setup />
          <p className="challenge-dial-caption">The ring follows scheduled challenge days—not leaderboard check-ins.</p>
        </div>
        <div className="challenge-setup-content">
          {step === 1 && <section ref={stepPanelRef} className="challenge-modal challenge-setup-controls" aria-label="Configure your challenge">
            <label className="challenge-name-field" htmlFor="challenge-name">Challenge name
              <input id="challenge-name" type="text" maxLength={60} required value={challengeName}
                aria-describedby="challenge-name-help" onChange={(event) => setChallengeName(event.target.value)} />
              <small id="challenge-name-help">This is the shared title; your device will still show the habit label.</small>
            </label>
            <ChallengeHabitForm value={habit} onChange={setHabit} />
            <ChallengeConfigForm startDate={startDate} serverToday={serverToday} currentMinuteOfDay={currentMinuteOfDay}
              times={habit.times} activeDays={habit.days} durationDays={durationDays} onStartDate={setStartDate} onDuration={setDurationDays} />
            {eventIdError && <div className="challenge-device-gate" role="alert">{eventIdError}<button type="button" onClick={() => setEventIdRequest((request) => request + 1)}>Retry</button></div>}
          </section>}
          {step === 2 && <section ref={stepPanelRef} className="challenge-modal challenge-setup-controls" aria-labelledby="challenge-step-title">
            <h3 id="challenge-step-title" className="challenge-step-title">Invite your people</h3>
            <p className="challenge-muted">Find friends by email. They’ll need a bound Frost device to join.</p>
            <FriendSearch currentUid={user.uid} query={email} selected={invitees} onQuery={setEmail} onSelected={setInvitees} />
          </section>}
          {step === 3 && <section ref={stepPanelRef} className="challenge-modal challenge-setup-controls" aria-labelledby="challenge-step-title">
            <h3 id="challenge-step-title" className="challenge-step-title">Review and send</h3>
            <div className="challenge-review">
              <p><strong>{challengeName.trim()}</strong> · {snapshot?.label}</p>
              <p>Cue times · {snapshot ? formatChallengeCueTimes(snapshot.times) : 'No cue times set'} · {snapshot?.days.length ? snapshot.days.join(', ') : 'every day'}</p>
              <p>{formatChallengeDate(startDate)} to {formatChallengeDate(endDate)} · {durationDays} scheduled days</p>
              <p>Inviting {invitees.map((person) => person.name).join(', ')}</p>
              <DeviceGate connected={deviceConnected} />
              <ChallengeJsonActions
                deviceJson={deviceJson}
                pendingMessage={eventIdLoading ? 'Preparing the challenge device event…' : eventIdError || 'The device event ID is not available yet.'}
                fileName={`frost-challenge-${deviceEventId || 'pending'}`}
              />
            </div>
          </section>}
          {error && <p className="challenge-action-error" role="alert">{error}</p>}
          <footer className="challenge-setup-footer">
            {step > 1 && !retry && <button type="button" className="challenge-secondary" disabled={busy} onClick={() => setStep((value) => value - 1)}>Back</button>}
            {completed ? <div className="challenge-send-area"><p role="status">{progress}</p><button type="button" className="challenge-primary" onClick={startAnother}>Create another challenge</button></div>
              : retry ? <SendChallengeButton connected={deviceConnected} disabled={busy} progress={progress} onSend={send} onRetry={() => void retrySync()} />
              : step < 3 ? <button type="button" className="challenge-primary" disabled={!validStep || busy} onClick={() => setStep((value) => value + 1)}>{step === 1 ? 'Choose friends' : 'Review challenge'}</button>
                : <SendChallengeButton connected={deviceConnected} disabled={!validStep || busy} progress={progress} onSend={() => void send()} />}
          </footer>
        </div>
      </div>
    </section>
  );
}
