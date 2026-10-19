import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const challengePath = 'challenges/challenge-1';
let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-frost-challenges',
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, challengePath), { participantIds: ['alice'] });
    await setDoc(doc(database, `${challengePath}/participants/alice`), { uid: 'alice', status: 'accepted' });
    await setDoc(doc(database, `${challengePath}/checkins/alice_2026-10-15`), { uid: 'alice', day: '2026-10-15' });
    await setDoc(doc(database, `${challengePath}/standings/alice`), { uid: 'alice', rank: 1 });
    await setDoc(doc(database, 'users/alice/notifications/invite-1'), { type: 'challenge_invite', readAt: null, title: 'Invite' });
  });
});

after(async () => { await environment.cleanup(); });

test('only challenge participants can read challenge and subcollection documents', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  const mallory = environment.authenticatedContext('mallory').firestore();

  await assertSucceeds(getDoc(doc(alice, challengePath)));
  await assertSucceeds(getDoc(doc(alice, `${challengePath}/participants/alice`)));
  await assertSucceeds(getDoc(doc(alice, `${challengePath}/checkins/alice_2026-10-15`)));
  await assertSucceeds(getDoc(doc(alice, `${challengePath}/standings/alice`)));
  await assertFails(getDoc(doc(mallory, challengePath)));
  await assertFails(getDoc(doc(mallory, `${challengePath}/participants/alice`)));
  await assertFails(getDoc(doc(mallory, `${challengePath}/checkins/alice_2026-10-15`)));
  await assertFails(getDoc(doc(mallory, `${challengePath}/standings/alice`)));
});

test('clients cannot write challenges or protected subcollections', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(alice, 'challenges/new'), { participantIds: ['alice'] }));
  await assertFails(updateDoc(doc(alice, challengePath), { status: 'completed' }));
  await assertFails(setDoc(doc(alice, `${challengePath}/participants/bob`), { status: 'accepted' }));
  await assertFails(setDoc(doc(alice, `${challengePath}/checkins/alice_2026-10-16`), { uid: 'alice' }));
  await assertFails(setDoc(doc(alice, `${challengePath}/standings/alice`), { rank: 2 }));
});

test('users may update only readAt on their own notifications', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  const mallory = environment.authenticatedContext('mallory').firestore();
  await assertSucceeds(updateDoc(doc(alice, 'users/alice/notifications/invite-1'), { readAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(alice, 'users/alice/notifications/invite-1'), { title: 'Changed' }));
  await assertFails(getDoc(doc(mallory, 'users/alice/notifications/invite-1')));
});