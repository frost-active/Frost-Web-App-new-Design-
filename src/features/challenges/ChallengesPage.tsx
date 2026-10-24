import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ConfigureBridge } from '../../components/configure/types';
import type { ChallengeUser } from '../../services/userService';
import { createChallenge, getChallengeScheduleDate, reportDeviceSync } from './services/challengeApi';
import { getChallengeScheduleError } from './services/challengeRules';
import { buildChallengeDeviceJsonForChallenges } from './services/challengeDeviceSync';
import type { ChallengeDraftSubmission } from './types';
import { useMyChallenges } from './hooks/useMyChallenges';
import NewChallengeModal from './components/NewChallengeModal';
import InviteCard from './components/InviteCard';
import { useChallengeInvites } from './hooks/useChallengeInvites';
import ChallengeCard from './components/ChallengeCard';
import ChallengeDial from './components/ChallengeDial';
import ChallengeDraftRail, { type ChallengeDraftEntry } from './components/ChallengeDraftRail';
import './challenges.css';

type Props = {
  user: User;
  deviceConnected: boolean;
  deviceMac: string | null;
  bridge: ConfigureBridge;
};

export default function ChallengesPage({ user, deviceConnected, deviceMac, bridge }: Props) {
  const [focusedChallengeId, setFocusedChallengeId] = useState(() => new URLSearchParams(window.location.search).get('challengeId'));
  const nextDraftNumber = useRef(0);
  const [drafts, setDrafts] = useState<ChallengeDraftEntry[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [draftSubmissions, setDraftSubmissions] = useState<Record<string, ChallengeDraftSubmission>>({});
  const [friendEmail, setFriendEmail] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<ChallengeUser[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchLocked, setBatchLocked] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [batchAssignedEventIds, setBatchAssignedEventIds] = useState<Record<string, string>>({});
  const batchBusyRef = useRef(false);
  const batchAttemptedRef = useRef(false);
  const batchCreatedRef = useRef(new Map<string, { challengeId: string; endDate: string; deviceEventId: string | null }>());
  const batchIdempotencyKeysRef = useRef(new Map<string, string>());
  const { challenges, loading, error } = useMyChallenges(user.uid);
  const participantStates = useChallengeInvites(challenges, user.uid);
  const invites = participantStates.filter((invite) => invite.status === 'invited' || invite.status === 'expired' || invite.status === 'declined');
  const failedSyncs = participantStates.filter((participant) => participant.status === 'accepted' && participant.deviceSyncStatus === 'failed');
  const sections = [
    { title: 'Active', values: challenges.filter((item) => item.status === 'active') },
    { title: 'Upcoming', values: challenges.filter((item) => item.status === 'pending' && (item.creatorId === user.uid || item.acceptedIds.includes(user.uid))) },
    { title: 'Completed', values: challenges.filter((item) => item.status === 'completed' || item.status === 'cancelled') },
  ];
  const addDraft = () => {
    if (batchBusyRef.current || batchLocked) return;
    setBatchNotice(null);
    setBatchError(null);
    setBatchProgress(null);
    const number = ++nextDraftNumber.current;
    const nextCue = new Date();
    nextCue.setHours(nextCue.getHours() + 1, 0, 0, 0);
    const draft = {
      id: `challenge-draft-${number}`,
      name: `Challenge ${number}`,
      cueTimes: [{ h: nextCue.getHours(), m: 0 }],
      cueDurationMs: 60_000,
    };
    setDrafts((current) => [...current, draft]);
    setSelectedDraftId(draft.id);
  };
  const removeDraft = useCallback((id: string) => {
    const index = drafts.findIndex((draft) => draft.id === id);
    const next = drafts.filter((draft) => draft.id !== id);
    setDrafts(next);
    if (selectedDraftId === id) setSelectedDraftId(next[Math.min(index, next.length - 1)]?.id || null);
    setDraftSubmissions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    batchCreatedRef.current.delete(id);
    batchIdempotencyKeysRef.current.delete(id);
  }, [drafts, selectedDraftId]);
  const updateDraftSubmission = useCallback((submission: ChallengeDraftSubmission) => {
    setDraftSubmissions((current) => ({ ...current, [submission.draftId]: submission }));
  }, []);
  const selectDraft = useCallback((id: string) => {
    if (!batchBusyRef.current && !batchLocked) setSelectedDraftId(id);
  }, [batchLocked]);
  const updateDraftName = useCallback((id: string, name: string) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, name } : draft));
  }, []);
  const updateDraftRing = useCallback((id: string, cueTimes: ChallengeDraftEntry['cueTimes'], cueDurationMs: number) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== id || (draft.cueTimes === cueTimes && draft.cueDurationMs === cueDurationMs)) return draft;
      return { ...draft, cueTimes, cueDurationMs };
    }));
  }, []);

  const batchSubmissions = drafts.flatMap((draft) => {
    const submission = draftSubmissions[draft.id];
    return submission ? [{ ...submission, invitees: selectedFriends.map(({ uid, name }) => ({ uid, name })) }] : [];
  });
  const batchReady = drafts.length > 0 && drafts.every((draft) => draftSubmissions[draft.id]?.ready);
  const batchIncludesCreator = drafts.some((draft) => draftSubmissions[draft.id]?.includeCreator ?? true);
  const batchDeviceJson = (() => {
    if (!batchReady) return null;
    const participatingDrafts = batchSubmissions.filter((submission) => submission.includeCreator);
    if (!participatingDrafts.length || participatingDrafts.some((submission) => !submission.deviceEventId)) return null;
    const candidateIds = participatingDrafts.map((submission) =>
      batchAssignedEventIds[submission.draftId] || submission.deviceEventId!,
    );
    const maxCandidate = Math.max(0, ...candidateIds.map((id) => Number(id.match(/^custom_(\d+)$/)?.[1] || 0)));
    const used = new Set<string>();
    let nextCustomId = maxCandidate + 1;
    const plannedIds = candidateIds.map((candidateId) => {
      if (!used.has(candidateId)) {
        used.add(candidateId);
        return candidateId;
      }
      let nextId = `custom_${String(nextCustomId).padStart(3, '0')}`;
      while (used.has(nextId)) {
        nextCustomId += 1;
        nextId = `custom_${String(nextCustomId).padStart(3, '0')}`;
      }
      used.add(nextId);
      nextCustomId += 1;
      return nextId;
    });
    return buildChallengeDeviceJsonForChallenges(participatingDrafts.map((submission, index) => ({
        habit: {
          ...submission.habit,
          habitId: plannedIds[index],
          text_x: 120,
          text_y: 100,
          text_size: 1,
          text_color: 65535,
          text_align: 1,
          text_width: 180,
        },
        startDate: submission.startDate,
        endDate: submission.endDate,
        deviceEventId: plannedIds[index],
      })));
  })();

  const sendAllChallenges = async () => {
    if (batchBusyRef.current || !batchReady) return;
    const submissions = drafts.map((draft) => draftSubmissions[draft.id]);
    if (submissions.some((submission) => !submission?.ready)) {
      setBatchError('Complete every challenge draft through Review and send before sending the batch.');
      return;
    }
    if (submissions.some((submission) => submission.includeCreator) && !deviceConnected) {
      setBatchError('Connect your Frost device before sending challenges that include you.');
      return;
    }

    batchBusyRef.current = true;
    setBatchBusy(true);
    setBatchError(null);
    setBatchNotice(null);
    setBatchProgress('Preparing all challenges…');
    try {
      for (const [index, submission] of submissions.entries()) {
        const item = submission!;
        if (batchCreatedRef.current.has(item.draftId)) continue;

        const serverSchedule = await getChallengeScheduleDate(item.timezone);
        const scheduleError = getChallengeScheduleError(item.startDate, serverSchedule.today, item.habit.times, serverSchedule.currentMinuteOfDay);
        if (scheduleError) throw new Error(`${item.name || 'Challenge'}: ${scheduleError}`);

        let idempotencyKey = batchIdempotencyKeysRef.current.get(item.draftId);
        if (!idempotencyKey) {
          idempotencyKey = crypto.randomUUID();
          batchIdempotencyKeysRef.current.set(item.draftId, idempotencyKey);
        }
        setBatchLocked(true);
        batchAttemptedRef.current = true;
        setBatchProgress(`Sending challenge ${index + 1} of ${submissions.length}…`);
        const created = await createChallenge({
          name: item.name,
          habit: item.habit,
          includeCreator: item.includeCreator,
          deviceEventId: item.includeCreator ? item.deviceEventId || undefined : undefined,
          startDate: item.startDate,
          durationDays: item.durationDays,
          timezone: item.timezone,
          inviteeIds: item.invitees.map((invitee) => invitee.uid),
          idempotencyKey,
        });
        batchCreatedRef.current.set(item.draftId, created);
        if (created.deviceEventId) {
          setBatchAssignedEventIds((current) => ({ ...current, [item.draftId]: created.deviceEventId! }));
        }
      }

      const creatorSubmissions = submissions.map((submission) => submission!)
        .filter((submission) => submission.includeCreator);
      if (creatorSubmissions.length) {
        const deviceInputs = creatorSubmissions.map((submission) => {
          const created = batchCreatedRef.current.get(submission.draftId);
          if (!created?.deviceEventId) throw new Error(`“${submission.name}” was saved without a device event ID. Contact support before retrying.`);
          return {
            challengeId: created.challengeId,
            deviceEventId: created.deviceEventId,
            habit: {
              ...submission.habit,
              habitId: created.deviceEventId,
              text_x: 120,
              text_y: 100,
              text_size: 1,
              text_color: 65535,
              text_align: 1,
              text_width: 180,
            },
            startDate: submission.startDate,
            endDate: created.endDate,
          };
        });
        const deviceJson = buildChallengeDeviceJsonForChallenges(deviceInputs);
        setBatchProgress(`Syncing ${deviceInputs.length} challenge ${deviceInputs.length === 1 ? 'event' : 'events'} to your device…`);
        try {
          await bridge.syncChallengeDevice(deviceJson);
        } catch (cause) {
          const syncError = cause instanceof Error ? cause.message : 'The device could not sync the challenge events.';
          const reports = await Promise.allSettled(deviceInputs.map((item) =>
            reportDeviceSync({ challengeId: item.challengeId, status: 'failed', deviceEventId: item.deviceEventId }),
          ));
          const reportFailures = reports.filter((result) => result.status === 'rejected').length;
          throw new Error(reportFailures
            ? `${syncError} Device-sync status could not be saved for ${reportFailures} challenge${reportFailures === 1 ? '' : 's'}.`
            : syncError, { cause });
        }
        const reports = await Promise.allSettled(deviceInputs.map((item) =>
          reportDeviceSync({ challengeId: item.challengeId, status: 'synced', deviceEventId: item.deviceEventId }),
        ));
        const reportFailures = reports.filter((result) => result.status === 'rejected').length;
        if (reportFailures) {
          throw new Error(`The device received all challenge events, but sync status could not be saved for ${reportFailures} challenge${reportFailures === 1 ? '' : 's'}. Retry to update the status.`);
        }
      }

      const count = submissions.length;
      const eventCount = creatorSubmissions.length;
      setBatchNotice(eventCount
        ? `Sent ${count} ${count === 1 ? 'challenge' : 'challenges'} and synced ${eventCount} ${eventCount === 1 ? 'device event' : 'device events'}.`
        : `Sent ${count} ${count === 1 ? 'challenge' : 'challenges'} and invited your friends.`);
      setDrafts([]);
      setSelectedDraftId(null);
      setDraftSubmissions({});
      setSelectedFriends([]);
      setFriendEmail('');
      setBatchAssignedEventIds({});
      setBatchLocked(false);
      setBatchProgress(null);
      batchCreatedRef.current.clear();
      batchIdempotencyKeysRef.current.clear();
      batchAttemptedRef.current = false;
    } catch (cause) {
      setBatchError(cause instanceof Error ? cause.message : 'Unable to send all challenges.');
      setBatchProgress(null);
      setBatchLocked(batchAttemptedRef.current);
    } finally {
      batchBusyRef.current = false;
      setBatchBusy(false);
    }
  };

  useEffect(() => {
    const focusFromEvent = (event: Event) => {
      const challengeId = (event as CustomEvent<{ challengeId?: string }>).detail?.challengeId;
      if (challengeId) setFocusedChallengeId(challengeId);
    };
    window.addEventListener('frost-challenge-focus', focusFromEvent);
    return () => window.removeEventListener('frost-challenge-focus', focusFromEvent);
  }, []);

  useEffect(() => {
    if (!focusedChallengeId || !challenges.some((challenge) => challenge.id === focusedChallengeId)) return;
    document.getElementById(`challenge-${focusedChallengeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [challenges, focusedChallengeId]);

  return (
    <div className="challenges-page" aria-labelledby="challenges-title">
      <header className="challenges-page-heading"><div><h1 id="challenges-title">Challenges</h1><p>Build a habit alongside people you know.</p></div></header>
      <section className="challenge-draft-area" aria-label="Challenge drafts">
        {batchNotice && drafts.length === 0 && <p className="challenge-batch-notice" role="status">{batchNotice}</p>}
        {drafts.length === 0 ? (
          <div className="challenge-empty-workspace">
            <div className="challenge-empty-dial cfg-dialcard">
              <ChallengeDial name="" habitLabel="" cueTimes={[]} startDate="" timezone="UTC" activeDays={[]} durationDays={0} emptyState />
            </div>
            <ChallengeDraftRail drafts={drafts} selectedId={selectedDraftId} headingId="your-challenges-title-empty"
                onSelect={selectDraft} onAdd={addDraft} onRemove={removeDraft} disabled={batchLocked || batchBusy} />
          </div>
        ) : drafts.map((draft) => (
          <NewChallengeModal key={draft.id} user={user} deviceConnected={deviceConnected}
            draftId={draft.id} initialName={draft.name} active={draft.id === selectedDraftId} drafts={drafts}
              batchSubmissions={batchSubmissions} batchReady={batchReady} batchIncludesCreator={batchIncludesCreator}
              batchDeviceJson={batchDeviceJson} batchBusy={batchBusy} batchLocked={batchLocked}
              batchProgress={batchProgress} batchError={batchError} onSelectDraft={selectDraft}
              friendEmail={friendEmail} selectedFriends={selectedFriends} onFriendEmailChange={setFriendEmail}
              onSelectedFriendsChange={setSelectedFriends}
              onAddDraft={addDraft} onRemoveDraft={removeDraft} onDraftStateChange={updateDraftSubmission}
              onSendAll={() => void sendAllChallenges()} onNameChange={updateDraftName} onDraftRingChange={updateDraftRing} />
        ))}
      </section>
      {loading ? <p role="status">Loading your challenges…</p> : error ? <p role="alert">{error}</p> : <>
        <section aria-labelledby="challenge-section-invites"><h2 id="challenge-section-invites">Invites</h2>
          {invites.length ? invites.map((invite) => <InviteCard key={invite.challengeId} invite={invite} uid={user.uid} deviceConnected={deviceConnected} deviceMac={deviceMac} bridge={bridge} />) : <p className="challenge-empty">No invites.</p>}
        </section>
        <section aria-labelledby="your-saved-challenges-title" className="your-challenges">
          <h2 id="your-saved-challenges-title">Saved challenges</h2>
          <div className="your-challenges-sections">
        {sections.map((section) => (
        <div key={section.title} className="challenge-status-section" aria-labelledby={`challenge-section-${section.title.toLowerCase()}`}>
          <h3 id={`challenge-section-${section.title.toLowerCase()}`}>{section.title}</h3>
          {section.values.length ? section.values.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} currentUid={user.uid} />) : <p className="challenge-empty">No {section.title.toLocaleLowerCase()} challenges.</p>}
          {(section.title === 'Upcoming' || section.title === 'Active') && failedSyncs.filter((participant) =>
            section.values.some((challenge) => challenge.id === participant.challengeId),
          ).map((participant) => <InviteCard key={`retry-${participant.challengeId}`} invite={participant} uid={user.uid} deviceConnected={deviceConnected} deviceMac={deviceMac} bridge={bridge} />)}
        </div>
        ))}
          </div>
        </section>
      </>}
    </div>
  );
}