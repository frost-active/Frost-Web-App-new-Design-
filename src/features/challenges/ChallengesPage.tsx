import * as React from 'react';
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ConfigureBridge } from '../../components/configure/types';
import { useMyChallenges } from './hooks/useMyChallenges';
import NewChallengeModal from './components/NewChallengeModal';
import InviteCard from './components/InviteCard';
import { useChallengeInvites } from './hooks/useChallengeInvites';
import ChallengeCard from './components/ChallengeCard';
import './challenges.css';

type Props = {
  user: User;
  deviceConnected: boolean;
  deviceMac: string | null;
  bridge: ConfigureBridge;
};

export default function ChallengesPage({ user, deviceConnected, deviceMac, bridge }: Props) {
  const [newChallengeOpen, setNewChallengeOpen] = useState(false);
  const [focusedChallengeId, setFocusedChallengeId] = useState(() => new URLSearchParams(window.location.search).get('challengeId'));
  const { challenges, loading, error } = useMyChallenges(user.uid);
  const participantStates = useChallengeInvites(challenges, user.uid);
  const invites = participantStates.filter((invite) => invite.status === 'invited' || invite.status === 'expired' || invite.status === 'declined');
  const failedSyncs = participantStates.filter((participant) => participant.status === 'accepted' && participant.deviceSyncStatus === 'failed');
  const sections = [
    { title: 'Active', values: challenges.filter((item) => item.status === 'active') },
    { title: 'Upcoming', values: challenges.filter((item) => item.status === 'pending' && (item.creatorId === user.uid || item.acceptedIds.includes(user.uid))) },
    { title: 'Completed', values: challenges.filter((item) => item.status === 'completed' || item.status === 'cancelled') },
  ];

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
      {newChallengeOpen && <NewChallengeModal user={user} deviceConnected={deviceConnected} bridge={bridge} onClose={() => setNewChallengeOpen(false)} />}
      <header className="challenges-page-heading"><div><h1 id="challenges-title">Challenges</h1><p>Build a habit alongside people you know.</p></div>
        <button type="button" className="challenge-primary" onClick={() => setNewChallengeOpen(true)}>New Challenge</button>
      </header>
      {loading ? <p role="status">Loading your challenges…</p> : error ? <p role="alert">{error}</p> : <>
        <section aria-labelledby="challenge-section-invites"><h2 id="challenge-section-invites">Invites</h2>
          {invites.length ? invites.map((invite) => <InviteCard key={invite.challengeId} invite={invite} uid={user.uid} deviceConnected={deviceConnected} deviceMac={deviceMac} bridge={bridge} />) : <p className="challenge-empty">No invites.</p>}
        </section>
        {sections.map((section) => (
        <section key={section.title} aria-labelledby={`challenge-section-${section.title.toLowerCase()}`}>
          <h2 id={`challenge-section-${section.title.toLowerCase()}`}>{section.title}</h2>
          {section.values.length ? section.values.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} currentUid={user.uid} />) : <p className="challenge-empty">No {section.title.toLocaleLowerCase()} challenges.</p>}
          {(section.title === 'Upcoming' || section.title === 'Active') && failedSyncs.filter((participant) =>
            section.values.some((challenge) => challenge.id === participant.challengeId),
          ).map((participant) => <InviteCard key={`retry-${participant.challengeId}`} invite={participant} uid={user.uid} deviceConnected={deviceConnected} deviceMac={deviceMac} bridge={bridge} />)}
        </section>
      ))}</>}
    </div>
  );
}