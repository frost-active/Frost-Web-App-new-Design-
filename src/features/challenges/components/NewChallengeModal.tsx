import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
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
import ChallengeConfigForm from './ChallengeConfigForm';
import DeviceGate from './DeviceGate';
import FriendSearch from './FriendSearch';
import ChallengeHabitForm from './ChallengeHabitForm';
import SendChallengeButton from './SendChallengeButton';
import ChallengeJsonActions from './ChallengeJsonActions';

type Props = { user: User; deviceConnected: boolean; bridge: ConfigureBridge; onClose: () => void };
type RetryState = { challengeId: string; deviceEventId: string; habit: ChallengeHabitSnapshot; startDate: string; endDate: string };

function newHabitDraft(): ChallengeHabitDraft {
  const nextCue = new Date();
  nextCue.setHours(nextCue.getHours() + 1, 0, 0, 0);
  return { label: '', times: [{ h: nextCue.getHours(), m: 0 }], days: [], display_ms: 60000 };
}

export default function NewChallengeModal({ user, deviceConnected, bridge, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [step, setStep] = useState(1);
  const [habit, setHabit] = useState<ChallengeHabitDraft>(newHabitDraft);
  const [startDate, setStartDate] = useState('');
  const [serverToday, setServerToday] = useState('');
  const [currentMinuteOfDay, setCurrentMinuteOfDay] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState(21);
  const [email, setEmail] = useState('');
  const [invitees, setInvitees] = useState<ChallengeUser[]>([]);
  const [busy, setBusy] = useState(false);
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
  const validStep = step === 1 ? Boolean(snapshot && startDate && endDate && serverToday && currentMinuteOfDay !== null && !scheduleError && candidateDeviceEventId)
    : step === 2 ? invitees.length > 0
    : Boolean(snapshot && deviceConnected);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])')];
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog.addEventListener('keydown', keydown);
    return () => dialog.removeEventListener('keydown', keydown);
  }, [busy, onClose, step]);

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
    setProgress('Done. Challenge synced to your device.');
  };

  const send = async () => {
    if (!snapshot || !deviceConnected || !validStep) return;
    setBusy(true); setError(null); setProgress('Saving challenge…');
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
      const created = await createChallenge({ habit, deviceEventId: candidateDeviceEventId || undefined, startDate, durationDays, timezone, inviteeIds: invitees.map((person) => person.uid), idempotencyKey: idempotencyKey.current });
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

  return (
    <div className="challenge-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="new-challenge-title" ref={dialogRef}>
        <header className="challenge-modal-heading"><div><p>Step {step} of 3</p><h2 id="new-challenge-title">New Challenge</h2></div>
          <button type="button" aria-label="Close challenge setup" disabled={busy} onClick={onClose}>×</button></header>
        <div className="challenge-step-content">
          {step === 1 && <>
            <ChallengeHabitForm value={habit} onChange={setHabit} />
            <ChallengeConfigForm startDate={startDate} serverToday={serverToday} currentMinuteOfDay={currentMinuteOfDay}
              times={habit.times} activeDays={habit.days} durationDays={durationDays} onStartDate={setStartDate} onDuration={setDurationDays} />
            {eventIdError && <div className="challenge-device-gate" role="alert">{eventIdError}<button type="button" onClick={() => setEventIdRequest((request) => request + 1)}>Retry</button></div>}
          </>}
          {step === 2 && <FriendSearch currentUid={user.uid} query={email} selected={invitees} onQuery={setEmail} onSelected={setInvitees} />}
          {step === 3 && <div className="challenge-review"><p><strong>{snapshot?.label}</strong></p><p>Cue times · {snapshot ? formatChallengeCueTimes(snapshot.times) : 'No cue times set'} · {snapshot?.days.length ? snapshot.days.join(', ') : 'every day'}</p><p>{formatChallengeDate(startDate)} to {formatChallengeDate(endDate)} · {durationDays} active days</p><p>Inviting {invitees.map((person) => person.name).join(', ')}</p><DeviceGate connected={deviceConnected} /><ChallengeJsonActions
            deviceJson={deviceJson}
            pendingMessage={eventIdLoading ? 'Preparing the challenge device event…' : eventIdError || 'The device event ID is not available yet.'}
            fileName={`frost-challenge-${deviceEventId || 'pending'}`}
          /></div>}
        </div>
        {error && <p className="challenge-action-error" role="alert">{error}</p>}
        <footer className="challenge-modal-footer">
          {step > 1 && !retry && <button type="button" className="challenge-modal-back" disabled={busy} onClick={() => setStep((value) => value - 1)}>Back</button>}
          {retry ? <SendChallengeButton connected={deviceConnected} disabled={busy} progress={progress} onSend={send} onRetry={() => void retrySync()} />
            : step < 3 ? <button type="button" className="challenge-primary" disabled={!validStep || busy} onClick={() => setStep((value) => value + 1)}>Continue</button>
              : <SendChallengeButton connected={deviceConnected} disabled={!validStep || busy} progress={progress} onSend={() => void send()} />}
        </footer>
      </section>
    </div>
  );
}