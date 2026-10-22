import * as React from 'react';
import { useState } from 'react';
import type { ConfigureBridge } from '../../../components/configure/types';
import type { ChallengeInvite } from '../hooks/useChallengeInvites';
import { buildChallengeDeviceJson } from '../services/challengeDeviceSync';
import { formatChallengeActiveDays, formatChallengeCueTimes, formatChallengeDate } from '../services/challengePresentation';
import { ChallengeDeviceSyncError, respondAndSyncChallenge } from '../services/challengeActions';
import { useChallengeDeviceEventId } from '../hooks/useChallengeDeviceEventId';
import DeviceGate from './DeviceGate';
import ChallengeJsonActions from './ChallengeJsonActions';
import ChallengeDial from './ChallengeDial';

type Props = { invite: ChallengeInvite; uid: string; deviceConnected: boolean; deviceMac: string | null; bridge: ConfigureBridge; onRespond?: (action: 'accept' | 'decline') => Promise<void> };

export default function InviteCard({ invite, uid, deviceConnected, deviceMac, bridge, onRespond }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const { deviceEventId: candidateDeviceEventId } = useChallengeDeviceEventId(invite.status === 'invited' && !onRespond, invite.challengeId);
  const deviceEventId = invite.deviceEventId || candidateDeviceEventId;
  const deviceJson = deviceEventId ? buildChallengeDeviceJson({
    habit: invite.habit,
    startDate: invite.startDate,
    endDate: invite.endDate,
    deviceEventId,
  }) : null;

  const respond = async (action: 'accept' | 'decline') => {
    setBusy(true); setError(null); setMessage(action === 'accept' ? 'Saving acceptance…' : 'Saving response…');
    try {
      if (onRespond) await onRespond(action);
      else await respondAndSyncChallenge({ challengeId: invite.challengeId, action, uid, deviceConnected, deviceMac, deviceEventId: candidateDeviceEventId || undefined, bridge });
      setRetry(false);
      setMessage(action === 'accept' ? 'Accepted and synced to your device.' : 'Invitation declined.');
    } catch (cause) {
      const description = cause instanceof Error ? cause.message : 'Unable to respond to this invitation.';
      setError(description);
      setRetry(action === 'accept' && cause instanceof ChallengeDeviceSyncError);
      setMessage(null);
    } finally { setBusy(false); }
  };

  return <article className="challenge-invite-card">
    <div className="challenge-invite-layout">
      <div className="challenge-invite-dial">
        <ChallengeDial name={invite.habitLabel} habitLabel={invite.habitLabel} cueTimes={invite.habit.times}
          cueDurationMs={invite.habit.display_ms} startDate={invite.startDate} timezone={invite.timezone || 'Asia/Kolkata'}
          activeDays={invite.habit.days} durationDays={invite.durationDays} />
      </div>
      <div className="challenge-invite-details"><strong>{invite.name || invite.habitLabel}</strong>
        <p>{invite.creatorName} · {formatChallengeDate(invite.startDate)} to {formatChallengeDate(invite.endDate)}</p>
        <p className="challenge-invite-habit">Habit · {invite.habitLabel}</p>
        <p className="challenge-invite-duration">{invite.durationDays} scheduled days</p>
        <p className="challenge-active-days">Active days · {formatChallengeActiveDays(invite.habit.days)}</p>
        <p className="challenge-cue-times">Cue times · {formatChallengeCueTimes(invite.habit.times)}</p>
      </div>
    </div>
    {invite.status === 'invited' ? <>
      <DeviceGate connected={deviceConnected} />
      <div className="challenge-invite-actions">
        <button type="button" className="challenge-primary" disabled={busy || !deviceConnected} onClick={() => void respond('accept')}>{busy ? 'Please wait…' : 'Accept'}</button>
        <button type="button" disabled={busy} onClick={() => void respond('decline')}>Decline</button>
      </div>
    </> : invite.status === 'accepted' && invite.deviceSyncStatus !== 'synced' ? <>
      <p>{invite.deviceSyncStatus === 'failed' ? 'Device sync failed.' : 'Accepted; device sync is pending.'}</p>
      {(retry || invite.deviceSyncStatus === 'failed') && <button type="button" disabled={busy || !deviceConnected} onClick={() => void respond('accept')}>Retry device sync</button>}
    </> : <p>{invite.status === 'expired' ? 'Invitation expired before you responded.' : invite.status === 'declined' ? 'Invitation declined.' : 'Accepted and synced.'}</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {retry && <button type="button" disabled={busy || !deviceConnected} onClick={() => void respond('accept')}>Retry device sync</button>}
    {(invite.status === 'invited' || invite.status === 'accepted') && <ChallengeJsonActions
      deviceJson={deviceJson}
      pendingMessage="Preparing the challenge device event ID…"
      fileName={`frost-challenge-${invite.challengeId}`}
    />}
  </article>;
}