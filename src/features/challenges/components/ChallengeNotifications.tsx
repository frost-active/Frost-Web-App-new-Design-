import * as React from 'react';
import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { ConfigureBridge } from '../../../components/configure/types';
import { firebaseDb } from '../../../firebase';
import { useChallengeNotifications } from '../hooks/useChallengeNotifications';
import { useMyChallenges } from '../hooks/useMyChallenges';
import { useChallengeInvites } from '../hooks/useChallengeInvites';
import { useChallengeDeviceEventId } from '../hooks/useChallengeDeviceEventId';
import { ChallengeDeviceSyncError, respondAndSyncChallenge } from '../services/challengeActions';
import { buildChallengeDeviceJson } from '../services/challengeDeviceSync';
import ChallengeJsonActions from './ChallengeJsonActions';

type Props = { user: User; deviceConnected: boolean; deviceMac: string | null; bridge: ConfigureBridge };

export default function ChallengeNotifications({ user, deviceConnected, deviceMac, bridge }: Props) {
  const { notifications, loading, error } = useChallengeNotifications(user.uid);
  const { challenges } = useMyChallenges(user.uid);
  const participantStates = useChallengeInvites(challenges, user.uid);
  const participantByChallenge = new Map(participantStates.map((participant) => [participant.challengeId, participant]));
  const pendingInviteIds = participantStates.filter((participant) => participant.status === 'invited').map((participant) => participant.challengeId).sort().join('|');
  const { deviceEventId: candidateDeviceEventId, loading: eventIdLoading } = useChallengeDeviceEventId(Boolean(pendingInviteIds), pendingInviteIds);
  const unread = notifications.filter((item) => !item.readAt).length;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [retryIds, setRetryIds] = useState<Set<string>>(new Set());
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  useEffect(() => { bridge.setNotificationCount(unread); }, [bridge, unread]);

  const markRead = async (notificationId: string) => {
    await updateDoc(doc(firebaseDb, 'users', user.uid, 'notifications', notificationId), { readAt: serverTimestamp() });
  };

  const respond = async (challengeId: string, notificationId: string, action: 'accept' | 'decline') => {
    setBusyId(notificationId);
    setMessages((current) => ({ ...current, [notificationId]: action === 'accept' ? 'Saving acceptance…' : 'Saving response…' }));
    try {
      await respondAndSyncChallenge({ challengeId, action, uid: user.uid, deviceConnected, deviceMac, deviceEventId: candidateDeviceEventId || undefined, bridge });
      await markRead(notificationId).catch(() => undefined);
      setRespondedIds((current) => new Set(current).add(notificationId));
      setRetryIds((current) => { const next = new Set(current); next.delete(notificationId); return next; });
      setMessages((current) => ({ ...current, [notificationId]: action === 'accept' ? 'Accepted and synced.' : 'Invitation declined.' }));
    } catch (cause) {
      if (action === 'accept' && cause instanceof ChallengeDeviceSyncError) {
        setRetryIds((current) => new Set(current).add(notificationId));
      }
      setMessages((current) => ({ ...current, [notificationId]: cause instanceof Error ? cause.message : 'Unable to respond.' }));
    } finally { setBusyId(null); }
  };

  return <div className="challenge-notification-list" aria-live="polite">
    <h3>Challenges</h3>
    {loading && <p role="status">Loading challenge notifications…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !notifications.length && <p>No challenge notifications.</p>}
    {notifications.map((item) => {
      const challenge = challenges.find((value) => value.id === item.challengeId);
      const participant = participantByChallenge.get(item.challengeId);
      const deviceEventId = participant?.deviceEventId || candidateDeviceEventId;
      const deviceJson = item.type === 'challenge_invite' && challenge && deviceEventId
        ? buildChallengeDeviceJson({
          habit: challenge.habit,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          deviceEventId,
        })
        : null;
      return <article key={item.id} className={item.readAt ? '' : 'is-unread'}>
      <strong>{item.title}</strong><p>{item.body}</p>
      {item.type === 'challenge_invite' && participant?.status === 'invited' && !respondedIds.has(item.id) && <div className="challenge-notification-actions">
        <button type="button" className="challenge-primary" disabled={busyId === item.id || !deviceConnected} onClick={() => void respond(item.challengeId, item.id, 'accept')}>Accept</button>
        <button type="button" disabled={busyId === item.id} onClick={() => void respond(item.challengeId, item.id, 'decline')}>Decline</button>
        {!deviceConnected && <span>Connect your Frost device to accept.</span>}
      </div>}
      {item.type === 'challenge_invite' && participant?.status === 'expired' && <p>Invitation expired before you responded.</p>}
      {item.type === 'challenge_invite' && participant?.status === 'declined' && <p>Invitation declined.</p>}
      {item.type === 'challenge_invite' && participant?.status === 'accepted' && <p>{participant.deviceSyncStatus === 'synced' ? 'Accepted and synced.' : 'Accepted; device sync is pending.'}</p>}
      {(retryIds.has(item.id) || participant?.deviceSyncStatus === 'failed') && <button type="button" disabled={busyId === item.id || !deviceConnected} onClick={() => void respond(item.challengeId, item.id, 'accept')}>Retry device sync</button>}
      {(participant?.status === 'invited' || participant?.status === 'accepted') && <ChallengeJsonActions
        deviceJson={deviceJson}
        pendingMessage={eventIdLoading ? 'Preparing the challenge device event ID…' : 'The challenge device event ID is not available yet.'}
        fileName={`frost-challenge-${item.challengeId}`}
      />}
      {item.type !== 'challenge_invite' && !item.readAt && <button type="button" onClick={() => void markRead(item.id).catch((cause: unknown) => setMessages((current) => ({ ...current, [item.id]: cause instanceof Error ? cause.message : 'Unable to mark as read.' })))}>Mark read</button>}
      {messages[item.id] && <p role="status">{messages[item.id]}</p>}
      <button type="button" className="challenge-open-link" onClick={() => window.dispatchEvent(new CustomEvent('frost-open-challenge', { detail: { challengeId: item.challengeId } }))}>Open in Challenges</button>
      </article>;
    })}
  </div>;
}