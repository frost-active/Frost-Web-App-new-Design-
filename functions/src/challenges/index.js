const { createHash } = require('node:crypto');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const {
  allocateCustomId,
  canAcceptChallenge,
  calculateStanding,
  chooseCustomId,
  computeEndDate,
  dateInTimezone,
  isChallengeableEvent,
  isISODate,
  lifecycleAction,
  meetsLead,
  minuteInTimezone,
  rankStandings,
  validDuration,
} = require('./domain');

const REGION = 'us-central1';
const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const db = getFirestore();

exports.getChallengeScheduleDate = onCall({ region: REGION }, async (request) => {
  requireUser(request);
  const timezone = typeof request.data?.timezone === 'string' && request.data.timezone.trim()
    ? request.data.timezone.trim() : DEFAULT_TIMEZONE;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { throw new HttpsError('invalid-argument', 'Choose a valid timezone.'); }
  const serverNow = new Date();
  const today = dateInTimezone(serverNow, timezone);
  return { today, earliestStartDate: today, currentMinuteOfDay: minuteInTimezone(serverNow, timezone) };
});

exports.getChallengeDeviceEventId = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const { macId } = await getBoundDevice(uid);
  const [configSnapshot, challengeHabits] = await Promise.all([
    db.doc(`users/${uid}/devices/${macId}/configs/current`).get(),
    db.collection(`users/${uid}/challengeHabits`).get(),
  ]);
  const config = challengeConfig(configSnapshot);
  return {
    deviceEventId: allocateCustomId(config.reminders.custom.events, challengeHabits.docs.map((document) => document.id)),
  };
});

function requireUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to use Challenges.');
  return request.auth.uid;
}

function cleanString(value, label, maxLength = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new HttpsError('invalid-argument', `${label} is required.`);
  }
  return value.trim();
}

async function getBoundDevice(uid) {
  const bindings = await db.collection('deviceBindings').where('boundUid', '==', uid).limit(1).get();
  if (bindings.empty) throw new HttpsError('failed-precondition', 'Bind a Frost device before using Challenges.');
  const binding = bindings.docs[0].data();
  const macAddress = binding.macAddress;
  if (typeof macAddress !== 'string' || !macAddress.trim()) {
    throw new HttpsError('failed-precondition', 'Your Frost device binding is incomplete.');
  }
  return { macAddress, macId: macAddress.replace(/:/g, '-'), binding };
}

function emptyChallengeConfig() {
  return {
    _meta: { schema_ver: 6, device: 'FROST' },
    reminders: { custom: { enabled: true, require_ack: true, display_ms: 60000, events: [] } },
    audio: {},
  };
}

function challengeConfig(snapshot) {
  const stored = snapshot.exists ? snapshot.data()?.config : null;
  const config = stored && typeof stored === 'object' ? structuredClone(stored) : emptyChallengeConfig();
  config.reminders = config.reminders && typeof config.reminders === 'object' ? config.reminders : {};
  config.reminders.custom = config.reminders.custom && typeof config.reminders.custom === 'object'
    ? config.reminders.custom : { enabled: true, require_ack: true, display_ms: 60000, events: [] };
  config.reminders.custom.events = Array.isArray(config.reminders.custom.events) ? config.reminders.custom.events : [];
  return config;
}

function challengeHabitSnapshot(input, habitId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpsError('invalid-argument', 'Configure a custom challenge habit.');
  }
  const label = cleanString(input.label, 'Habit name', 20);
  if (!isChallengeableEvent({ id: 'challenge_draft', label }, null)) {
    throw new HttpsError('invalid-argument', 'Choose a custom habit name, not a predefined Frost habit.');
  }
  const times = Array.isArray(input.times) ? input.times : [];
  if (!times.length || times.some((time) => !time || typeof time !== 'object'
    || !Number.isInteger(time.h) || !Number.isInteger(time.m)
    || time.h < 0 || time.h > 23 || time.m < 0 || time.m > 59)) {
    throw new HttpsError('invalid-argument', 'Add at least one valid cue time.');
  }
  if (times.length > 12) throw new HttpsError('invalid-argument', 'A challenge habit can have at most 12 cue times.');
  const validDays = new Set(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const days = Array.isArray(input.days) ? input.days : [];
  if (days.some((day) => !validDays.has(day)) || new Set(days).size !== days.length) {
    throw new HttpsError('invalid-argument', 'Choose valid active days.');
  }
  const displayMs = input.display_ms;
  if (!Number.isInteger(displayMs) || displayMs < 60000 || displayMs > 3600000) {
    throw new HttpsError('invalid-argument', 'Cue duration must be between 1 and 60 minutes.');
  }
  return {
    habitId,
    label,
    times: times.map(({ h, m }) => ({ h, m })),
    days: [...days],
    display_ms: displayMs,
    text_x: 120,
    text_y: 100,
    text_size: 1,
    text_color: 65535,
    text_align: 1,
    text_width: 180,
  };
}

function notificationId(type, challengeId, uid) {
  return `${type}_${challengeId}_${uid}`;
}

function notificationData(type, challengeId, title, body) {
  return { type, challengeId, title, body, createdAt: FieldValue.serverTimestamp() };
}

async function loadInvitedUsers(inviteeIds, creatorUid) {
  if (!Array.isArray(inviteeIds) || inviteeIds.length < 1 || inviteeIds.length > 10) {
    throw new HttpsError('invalid-argument', 'Choose between 1 and 10 invitees.');
  }
  const uniqueIds = [...new Set(inviteeIds)];
  if (uniqueIds.length !== inviteeIds.length || uniqueIds.includes(creatorUid)) {
    throw new HttpsError('invalid-argument', 'Invitees must be unique and cannot include you.');
  }
  return Promise.all(uniqueIds.map(async (uid) => {
    let user;
    try { user = await getAuth().getUser(uid); }
    catch { throw new HttpsError('not-found', 'One selected participant no longer exists.'); }
    if (!user.email) throw new HttpsError('failed-precondition', 'Every invitee needs an email address.');
    const { binding } = await getBoundDevice(uid);
    if (typeof binding.boundEmail !== 'string' || binding.boundEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new HttpsError('failed-precondition', `${user.displayName || user.email} must bind a Frost device to this email first.`);
    }
    return { uid, email: user.email, displayName: user.displayName || user.email.split('@')[0], photoURL: user.photoURL || null };
  }));
}

exports.createChallenge = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const data = request.data || {};
  const idempotencyKey = cleanString(data.idempotencyKey, 'Idempotency key', 100);
  const challengeId = createHash('sha256').update(`${uid}:${idempotencyKey}`).digest('hex').slice(0, 32);
  const challengeRef = db.doc(`challenges/${challengeId}`);
  const existingChallenge = await challengeRef.get();
  if (existingChallenge.exists) {
    const participant = await challengeRef.collection('participants').doc(uid).get();
    return { challengeId, endDate: existingChallenge.data().endDate, deviceEventId: participant.data()?.deviceEventId || null };
  }
  const startDate = cleanString(data.startDate, 'Start date', 10);
  const durationDays = Number(data.durationDays);
  let timezone = typeof data.timezone === 'string' ? data.timezone.trim() : '';
  if (!timezone) timezone = DEFAULT_TIMEZONE;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { throw new HttpsError('invalid-argument', 'Choose a valid timezone.'); }
  if (!isISODate(startDate) || !validDuration(durationDays)) {
    throw new HttpsError('invalid-argument', 'Choose a valid start date and duration.');
  }
  const serverNow = new Date();
  const serverToday = dateInTimezone(serverNow, timezone);
  if (!meetsLead(startDate, serverToday)) {
    throw new HttpsError('failed-precondition', 'Challenge start date cannot be in the past.');
  }
  const habitDraft = challengeHabitSnapshot(data.habit, 'draft');
  if (startDate === serverToday && habitDraft.times.some(({ h, m }) => h * 60 + m <= minuteInTimezone(serverNow, timezone))) {
    throw new HttpsError('failed-precondition', `For a challenge starting today, choose cue times later than the current time in ${timezone}.`);
  }
  const endDate = computeEndDate(startDate, durationDays, habitDraft.days);
  const invitedUsers = await loadInvitedUsers(data.inviteeIds, uid);
  const creator = await getAuth().getUser(uid);
  const { macId, macAddress } = await getBoundDevice(uid);
  const configRef = db.doc(`users/${uid}/devices/${macId}/configs/current`);
  const creatorParticipantRef = challengeRef.collection('participants').doc(uid);
  let deviceEventId = '';
  const participantIds = [uid, ...invitedUsers.map((user) => user.uid)];
  const challenge = {
    creatorId: uid,
    creatorName: creator.displayName || creator.email || 'Frost user',
    habit: null,
    sourceHabitId: null,
    startDate,
    endDate,
    durationDays,
    timezone,
    status: 'pending',
    participantIds,
    acceptedIds: [uid],
    idempotencyKey,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(challengeRef);
    if (existing.exists) {
      const participant = await transaction.get(creatorParticipantRef);
      deviceEventId = participant.data()?.deviceEventId || '';
      return;
    }
    const [latestConfig, existingChallengeHabits] = await Promise.all([
      transaction.get(configRef),
      transaction.get(db.collection(`users/${uid}/challengeHabits`)),
    ]);
    const currentConfig = challengeConfig(latestConfig);
    const habitEvents = currentConfig.reminders.custom.events;
    deviceEventId = chooseCustomId(habitEvents, existingChallengeHabits.docs.map((document) => document.id), data.deviceEventId);
    const habit = { ...habitDraft, habitId: deviceEventId };
    challenge.habit = habit;
    const linkedRef = db.doc(`users/${uid}/challengeHabits/${deviceEventId}`);
    const nextConfig = appendChallengeHabit(currentConfig, challengeDeviceEvent({ deviceEventId }, { habit, startDate, endDate }), challengeId);
    transaction.create(challengeRef, challenge);
    transaction.create(creatorParticipantRef, {
      uid, email: creator.email || '', displayName: creator.displayName || creator.email || 'Frost user', photoURL: creator.photoURL || null,
      role: 'creator', status: 'accepted', habitId: deviceEventId, deviceEventId, deviceMacId: macId,
      deviceSyncStatus: 'pending', invitedAt: FieldValue.serverTimestamp(), respondedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(linkedRef, { challengeId, habitId: deviceEventId, deviceEventId, status: 'pending', role: 'creator' });
    transaction.set(configRef, { macAddress, config: nextConfig }, { merge: true });
    invitedUsers.forEach((user) => {
      transaction.create(challengeRef.collection('participants').doc(user.uid), {
        ...user, role: 'invitee', status: 'invited', habitId: '', deviceSyncStatus: 'pending', invitedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.doc(`users/${user.uid}/notifications/${notificationId('challenge_invite', challengeId, user.uid)}`),
        notificationData('challenge_invite', challengeId, `${challenge.creatorName} invited you`, `${challenge.creatorName} challenged you to ${habit.label}.`));
      transaction.create(db.doc(`mail/challenge_${challengeId}_${user.uid}`), {
        to: user.email,
        message: inviteEmail(challenge, challengeId),
      });
    });
  });
  return { challengeId, endDate, deviceEventId };
});

function inviteEmail(challenge, challengeId) {
  const name = escapeHtml(challenge.creatorName);
  const habit = escapeHtml(challenge.habit.label);
  const link = `https://habit.frostactive.com/challenges?challengeId=${encodeURIComponent(challengeId)}`;
  const lines = [
    `1. Open habit.frostactive.com and connect your Frost device.`,
    `2. Open the bell icon or the Challenges tab.`,
    `3. Accept before ${challenge.startDate}. Your device syncs automatically.`,
    `4. Track everyone's progress on the Leaderboard.`,
  ];
  const text = `${challenge.creatorName} challenged you to ${challenge.habit.label} for ${challenge.durationDays} days (${challenge.startDate} to ${challenge.endDate}).\n\n${lines.join('\n')}\n\n${link}`;
  const html = `<p>${name} challenged you to <strong>${habit}</strong> for ${challenge.durationDays} days (${challenge.startDate} to ${challenge.endDate}).</p><ol>${lines.map((line) => `<li>${escapeHtml(line.replace(/^\d+\. /, ''))}</li>`).join('')}</ol><p><a href="${link}">Open your challenge</a></p>`;
  return { subject: `${challenge.creatorName} challenged you: ${challenge.habit.label} for ${challenge.durationDays} days`, text, html };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function challengeDeviceEvent(habit, challenge) {
  return {
    id: habit.deviceEventId,
    label: challenge.habit.label,
    enabled: true,
    start_date: challenge.startDate,
    end_date: challenge.endDate,
    display_ms: challenge.habit.display_ms,
    days: challenge.habit.days,
    times: challenge.habit.times,
    text_x: challenge.habit.text_x,
    text_y: challenge.habit.text_y,
    text_size: challenge.habit.text_size,
    text_color: challenge.habit.text_color,
    text_align: challenge.habit.text_align,
    text_width: challenge.habit.text_width,
  };
}

function appendChallengeHabit(config, event, challengeId) {
  const next = structuredClone(config);
  next.reminders = next.reminders && typeof next.reminders === 'object' ? next.reminders : {};
  next.reminders.custom = { ...(next.reminders.custom || {}), enabled: true, require_ack: true, display_ms: 60000 };
  next.reminders.custom.events = [...(next.reminders.custom.events || []), event];
  next.ui_meta = { ...(next.ui_meta || {}), v: 1 };
  next.ui_meta.habits = [...new Set([...(next.ui_meta.habits || []), `custom:${event.id}`])];
  next.ui_meta.custom = [...(next.ui_meta.custom || []), {
    id: event.id, type: 'recurring', date: null, challengeId, challengeRole: 'device', challengeStatus: 'pending',
    startDate: event.start_date, endDate: event.end_date,
  }];
  return next;
}

function withChallengeStatus(config, challengeId, status) {
  const next = structuredClone(config);
  if (!Array.isArray(next.ui_meta?.custom)) return next;
  next.ui_meta.custom = next.ui_meta.custom.map((item) => item?.challengeId === challengeId
    ? { ...item, challengeStatus: status }
    : item);
  return next;
}

async function readParticipantConfigUpdates(transaction, participants, challengeId, status) {
  const targets = participants.filter((participant) => participant.deviceMacId).map((participant) => ({
    participant,
    reference: db.doc(`users/${participant.uid}/devices/${participant.deviceMacId}/configs/current`),
  }));
  const snapshots = await Promise.all(targets.map(({ reference }) => transaction.get(reference)));
  return targets.flatMap(({ reference }, index) => snapshots[index].exists
    ? [{ reference, config: withChallengeStatus(snapshots[index].data().config, challengeId, status) }]
    : []);
}

function writeParticipantChallengeStatus(transaction, participants, challengeId, status, creatorId, sourceHabitId) {
  participants.forEach((participant) => {
    if (participant.deviceEventId) {
      transaction.set(db.doc(`users/${participant.uid}/challengeHabits/${participant.deviceEventId}`), { status }, { merge: true });
    }
    if (participant.uid === creatorId && sourceHabitId) {
      transaction.set(db.doc(`users/${participant.uid}/challengeSources/${sourceHabitId}`), { status }, { merge: true });
    }
  });
}

function challengeSourceHabitId(challenge) {
  return Object.hasOwn(challenge, 'sourceHabitId') ? challenge.sourceHabitId : challenge.habit?.habitId;
}

exports.respondToChallenge = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const challengeId = cleanString(request.data?.challengeId, 'Challenge', 100);
  const action = request.data?.action;
  if (action !== 'accept' && action !== 'decline') throw new HttpsError('invalid-argument', 'Choose Accept or Decline.');
  const challengeRef = db.doc(`challenges/${challengeId}`);
  const participantRef = challengeRef.collection('participants').doc(uid);
  const participantSnapshot = await participantRef.get();
  if (!participantSnapshot.exists) throw new HttpsError('permission-denied', 'You are not invited to this challenge.');
  if (participantSnapshot.data().status !== 'invited') {
    const expectedStatus = action === 'accept' ? 'accepted' : 'declined';
    if (participantSnapshot.data().status === expectedStatus) return { status: participantSnapshot.data().status, deviceEventId: participantSnapshot.data().deviceEventId || null };
    throw new HttpsError('failed-precondition', 'This invitation has already been answered.');
  }
  const challengeSnapshot = await challengeRef.get();
  if (!challengeSnapshot.exists) throw new HttpsError('not-found', 'Challenge not found.');
  const challenge = challengeSnapshot.data();
  if (challenge.status !== 'pending') throw new HttpsError('failed-precondition', 'This challenge is no longer accepting responses.');
  const timezone = challenge.timezone || DEFAULT_TIMEZONE;
  const serverNow = new Date();
  if (!canAcceptChallenge(challenge, dateInTimezone(serverNow, timezone), minuteInTimezone(serverNow, timezone))) {
    throw new HttpsError('failed-precondition', 'The challenge can no longer be accepted because its first cue has passed.');
  }
  const user = await getAuth().getUser(uid);
  let deviceEventId = null;
  let configRef = null;
  let deviceMacId = null;
  let deviceMacAddress = null;
  if (action === 'accept') {
    const { macId, macAddress } = await getBoundDevice(uid);
    deviceMacId = macId;
    deviceMacAddress = macAddress;
    configRef = db.doc(`users/${uid}/devices/${macId}/configs/current`);
  }
  const creatorNotificationRef = db.doc(`users/${challenge.creatorId}/notifications/${notificationId('challenge_accepted', challengeId, uid)}`);
  await db.runTransaction(async (transaction) => {
    const [currentChallenge, currentParticipant] = await Promise.all([transaction.get(challengeRef), transaction.get(participantRef)]);
    if (!currentChallenge.exists || currentChallenge.data().status !== 'pending') throw new HttpsError('failed-precondition', 'This challenge is no longer accepting responses.');
    const current = currentParticipant.data();
    if (current.status !== 'invited') throw new HttpsError('failed-precondition', 'This invitation has already been answered.');
    const currentData = currentChallenge.data();
    const responseNow = new Date();
    const responseTimezone = currentData.timezone || DEFAULT_TIMEZONE;
    if (!canAcceptChallenge(currentData, dateInTimezone(responseNow, responseTimezone), minuteInTimezone(responseNow, responseTimezone))) {
      throw new HttpsError('failed-precondition', 'The challenge can no longer be accepted because its first cue has passed.');
    }
    const currentConfigSnapshot = action === 'accept' ? await transaction.get(configRef) : null;
    const existingChallengeHabits = action === 'accept'
      ? await transaction.get(db.collection(`users/${uid}/challengeHabits`))
      : null;
    let currentConfig = null;
    if (action === 'accept') {
      currentConfig = challengeConfig(currentConfigSnapshot);
      const events = currentConfig.reminders.custom.events;
      deviceEventId = chooseCustomId(events, existingChallengeHabits.docs.map((document) => document.id), request.data?.deviceEventId);
    }
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    transaction.update(participantRef, {
      status: nextStatus, respondedAt: FieldValue.serverTimestamp(),
      ...(action === 'accept' ? { habitId: deviceEventId, deviceEventId, deviceMacId, deviceSyncStatus: 'pending' } : {}),
    });
    if (action === 'accept') {
      const nextConfig = appendChallengeHabit(currentConfig, challengeDeviceEvent({ deviceEventId }, currentChallenge.data()), challengeId);
      const linkedRef = db.doc(`users/${uid}/challengeHabits/${deviceEventId}`);
      const acceptedIds = [...new Set([...(currentChallenge.data().acceptedIds || []), uid])];
      transaction.update(challengeRef, { acceptedIds });
      transaction.set(configRef, { macAddress: deviceMacAddress, config: nextConfig }, { merge: true });
      transaction.create(linkedRef, { challengeId, habitId: deviceEventId, status: 'pending', role: 'invitee' });
    }
    transaction.create(creatorNotificationRef, notificationData('challenge_accepted', challengeId,
      action === 'accept' ? `${user.displayName || user.email} accepted` : `${user.displayName || user.email} declined`,
      `${user.displayName || user.email} ${action === 'accept' ? 'accepted' : 'declined'} your ${challenge.habit.label} challenge.`));
  });
  return { status: action === 'accept' ? 'accepted' : 'declined', deviceEventId };
});

exports.reportDeviceSync = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const challengeId = cleanString(request.data?.challengeId, 'Challenge', 100);
  const status = request.data?.status;
  if (status !== 'synced' && status !== 'failed') throw new HttpsError('invalid-argument', 'Device sync status must be synced or failed.');
  const participantRef = db.doc(`challenges/${challengeId}/participants/${uid}`);
  const snapshot = await participantRef.get();
  if (!snapshot.exists) throw new HttpsError('permission-denied', 'You are not a participant in this challenge.');
  const participant = snapshot.data();
  if (request.data?.deviceEventId && request.data.deviceEventId !== participant.deviceEventId) {
    throw new HttpsError('invalid-argument', 'The device event does not match this participant.');
  }
  await participantRef.update({
    deviceSyncStatus: status,
    ...(status === 'synced' ? { deviceSyncedAt: FieldValue.serverTimestamp() } : {}),
  });
  return { status };
});

async function standingsForTransaction(transaction, challengeRef, challenge, participantDocs, today) {
  const reads = await Promise.all(participantDocs.map((participant) => transaction.get(
    challengeRef.collection('checkins').where('uid', '==', participant.uid),
  )));
  const rows = participantDocs.map((participant, index) => {
    const checkins = reads[index].docs.map((doc) => doc.data());
    return calculateStanding(participant, checkins, challenge.startDate, challenge.endDate, today);
  });
  return rankStandings(rows);
}

exports.challengeLifecycle = onSchedule({ schedule: 'every 15 minutes', region: REGION, timeZone: 'UTC' }, async () => {
  const pending = await db.collection('challenges').where('status', '==', 'pending').get();
  for (const snapshot of pending.docs) {
    const challenge = snapshot.data();
    const serverNow = new Date();
    const timezone = challenge.timezone || DEFAULT_TIMEZONE;
    const today = dateInTimezone(serverNow, timezone);
    const currentMinuteOfDay = minuteInTimezone(serverNow, timezone);
    if (today < challenge.startDate) continue;
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(snapshot.ref);
      if (!fresh.exists || fresh.data().status !== 'pending') return;
      const data = fresh.data();
      const participantsQuery = await transaction.get(snapshot.ref.collection('participants'));
      const participants = participantsQuery.docs.map((doc) => ({ ref: doc.ref, ...doc.data() }));
      const accepted = participants.filter((participant) => participant.status === 'accepted');
      const invitees = participants.filter((participant) => participant.status === 'invited');
      const action = lifecycleAction(data, today, accepted.length, currentMinuteOfDay);
      if (action === 'cancel') {
        const configUpdates = await readParticipantConfigUpdates(transaction, accepted, snapshot.id, 'cancelled');
        invitees.forEach((participant) => transaction.update(participant.ref, { status: 'expired' }));
        configUpdates.forEach(({ reference, config }) => transaction.update(reference, { config }));
        transaction.update(snapshot.ref, { status: 'cancelled', endedAt: FieldValue.serverTimestamp() });
        writeParticipantChallengeStatus(transaction, accepted, snapshot.id, 'cancelled', data.creatorId, challengeSourceHabitId(data));
        const notice = db.doc(`users/${data.creatorId}/notifications/${notificationId('challenge_cancelled', snapshot.id, data.creatorId)}`);
        transaction.set(notice, notificationData('challenge_cancelled', snapshot.id, 'Challenge cancelled', 'No invitees accepted before the start date.'));
        return;
      }
      if (action !== 'activate') return;
      const configUpdates = await readParticipantConfigUpdates(transaction, accepted, snapshot.id, 'active');
      const rows = await standingsForTransaction(transaction, snapshot.ref, data, accepted, today);
      invitees.forEach((participant) => transaction.update(participant.ref, { status: 'expired' }));
      transaction.update(snapshot.ref, { status: 'active', startedAt: FieldValue.serverTimestamp() });
      rows.forEach((row) => transaction.set(snapshot.ref.collection('standings').doc(row.uid), { ...row, updatedAt: FieldValue.serverTimestamp() }));
      configUpdates.forEach(({ reference, config }) => transaction.update(reference, { config }));
      writeParticipantChallengeStatus(transaction, accepted, snapshot.id, 'active', data.creatorId, challengeSourceHabitId(data));
      accepted.forEach((participant) => {
        const notice = db.doc(`users/${participant.uid}/notifications/${notificationId('challenge_started', snapshot.id, participant.uid)}`);
        transaction.set(notice, notificationData('challenge_started', snapshot.id, 'Challenge started', `${data.habit.label} starts today.`));
      });
    });
  }

  const active = await db.collection('challenges').where('status', '==', 'active').get();
  for (const snapshot of active.docs) {
    const challenge = snapshot.data();
    const today = dateInTimezone(new Date(), challenge.timezone || DEFAULT_TIMEZONE);
    if (today <= challenge.endDate) continue;
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(snapshot.ref);
      if (!fresh.exists || fresh.data().status !== 'active') return;
      const data = fresh.data();
      if (lifecycleAction(data, today, data.acceptedIds?.length || 0) !== 'complete') return;
      const participantQuery = await transaction.get(snapshot.ref.collection('participants'));
      const participants = participantQuery.docs.filter((doc) => doc.data().status === 'accepted').map((doc) => doc.data());
      const configUpdates = await readParticipantConfigUpdates(transaction, participants, snapshot.id, 'completed');
      const rows = await standingsForTransaction(transaction, snapshot.ref, data, participants, data.endDate);
      rows.forEach((row) => transaction.set(snapshot.ref.collection('standings').doc(row.uid), { ...row, updatedAt: FieldValue.serverTimestamp() }));
      configUpdates.forEach(({ reference, config }) => transaction.update(reference, { config }));
      writeParticipantChallengeStatus(transaction, participants, snapshot.id, 'completed', data.creatorId, challengeSourceHabitId(data));
      const finalRanking = rows.map(({ uid, rank, daysCompleted, longestStreak }) => ({ uid, rank, daysCompleted, longestStreak }));
      transaction.update(snapshot.ref, {
        status: 'completed', endedAt: FieldValue.serverTimestamp(), winnerId: rows[0]?.uid ?? null, finalRanking,
      });
      participants.forEach((participant) => {
        const notice = db.doc(`users/${participant.uid}/notifications/${notificationId('challenge_ended', snapshot.id, participant.uid)}`);
        transaction.set(notice, notificationData('challenge_ended', snapshot.id, 'Challenge ended', `Final ranking for ${data.habit.label} is ready.`));
      });
    });
  }
});

exports.onHabitCompletion = onDocumentWritten({ document: 'devices/{mac}/statistics/{date}', region: REGION }, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data();
  const day = event.params.date;
  if (!isISODate(day) || !Array.isArray(data.custEntries)) return;
  const binding = await db.doc(`deviceBindings/${event.params.mac}`).get();
  if (!binding.exists || typeof binding.data().boundUid !== 'string') return;
  const uid = binding.data().boundUid;
  const [configSnapshot, mappings] = await Promise.all([
    db.doc(`users/${uid}/devices/${event.params.mac}/configs/current`).get(),
    db.collection(`users/${uid}/challengeHabits`).get(),
  ]);
  if (!configSnapshot.exists) return;
  const config = configSnapshot.data().config;
  const expiredDeviceEventIds = new Set((config?.ui_meta?.custom || [])
    .filter((item) => item?.challengeRole === 'device' && ['completed', 'cancelled'].includes(item.challengeStatus))
    .map((item) => item.id));
  const events = (config?.reminders?.custom?.events || []).filter((item) => !expiredDeviceEventIds.has(item.id));
  const beforeData = event.data?.before?.exists ? event.data.before.data() : {};
  const beforeEntries = Array.isArray(beforeData.custEntries) ? beforeData.custEntries : [];
  const participants = mappings.docs.map((doc) => doc.data());
  for (const mapping of participants) {
    const eventIndex = events.findIndex((item) => item?.id === mapping.deviceEventId || item?.id === mapping.habitId);
    if (eventIndex < 0 || Number(data.custEntries[eventIndex]?.ack || 0) <= Number(beforeEntries[eventIndex]?.ack || 0)) continue;
    const challenges = await db.collection('challenges').where('participantIds', 'array-contains', uid).where('status', '==', 'active').get();
    for (const challengeDoc of challenges.docs) {
      const challenge = challengeDoc.data();
      if (day < challenge.startDate || day > challenge.endDate) continue;
      const participantRef = challengeDoc.ref.collection('participants').doc(uid);
      const participantSnapshot = await participantRef.get();
      if (!participantSnapshot.exists || participantSnapshot.data().status !== 'accepted') continue;
      const checkinRef = challengeDoc.ref.collection('checkins').doc(`${uid}_${day}`);
      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(checkinRef);
        if (!existing.exists) transaction.create(checkinRef, { uid, day, completedAt: Date.now() });
      });
      await recomputeParticipantStandings(challengeDoc.ref, challenge, dateInTimezone(new Date(), challenge.timezone || DEFAULT_TIMEZONE));
    }
  }
});

async function recomputeParticipantStandings(challengeRef, challenge, today) {
  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(challengeRef);
    if (!fresh.exists || fresh.data().status !== 'active') return;
    const participantQuery = await transaction.get(challengeRef.collection('participants'));
    const participants = participantQuery.docs.filter((doc) => doc.data().status === 'accepted').map((doc) => doc.data());
    const rows = await standingsForTransaction(transaction, challengeRef, challenge, participants, today);
    rows.forEach((row) => transaction.set(challengeRef.collection('standings').doc(row.uid), { ...row, updatedAt: FieldValue.serverTimestamp() }));
  });
}

exports.listChallengeableUsers = onCall({ region: REGION }, async (request) => {
  const uid = requireUser(request);
  const email = typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || email.length > 254) return { users: [], nextPageToken: null };
  let user;
  try { user = await getAuth().getUserByEmail(email); }
  catch (error) {
    if (error?.code === 'auth/user-not-found') return { users: [], nextPageToken: null };
    throw new HttpsError('internal', 'Unable to search participants. Please try again.');
  }
  if (user.uid === uid || !user.email) return { users: [], nextPageToken: null };
  const bindings = await db.collection('deviceBindings').where('boundUid', '==', user.uid).limit(1).get();
  if (bindings.empty || bindings.docs[0].data().boundEmail?.toLowerCase() !== user.email.toLowerCase()) {
    return { users: [], nextPageToken: null };
  }
  return {
    users: [{ uid: user.uid, name: user.displayName || user.email.split('@')[0], email: user.email, photoURL: user.photoURL || null }],
    nextPageToken: null,
  };
});