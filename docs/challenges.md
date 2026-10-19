# Challenges

## User flow

The Challenges page is a top-level dashboard view at `/challenges`. Its New Challenge stepper configures a challenge-only custom habit (name, cue times, cue duration, and active days), then takes a start date and duration, searches an exact email address, and accepts up to ten eligible friends. Music and audio options are not part of challenge setup. The callable validates the habit draft, timezone, start lead, invitees, bound-device email, and idempotency key before atomically writing the challenge, participant records, notifications, email queue documents, and device-config event. A prior Configure-tab habit or schedule sync is not required.

The sender and invitee each need a bound device and an active BLE connection for their respective Send or Accept action. The server first writes the participant/config state; the browser then sends the challenge-only schema-ver-6 custom JSON through the existing BLE writer and reports the result. Challenge-managed events remain in the saved device config for syncing and completion tracking but are filtered out of the Configure tab's editable habit list. A failed device write does not roll back the challenge; the UI exposes a retry action.

## Firestore model

- `challenges/{challengeId}` stores creator identity, the habit snapshot, inclusive start/end dates, timezone, lifecycle state, participant IDs, accepted IDs, and final ranking.
- `challenges/{challengeId}/participants/{uid}` stores invitation state, linked device event ID, and sync status.
- `challenges/{challengeId}/checkins/{uid_YYYY-MM-DD}` stores one deterministic in-window daily check-in.
- `challenges/{challengeId}/standings/{uid}` stores recomputed ranking and streak values.
- `users/{uid}/notifications/{notificationId}` stores bell items. Clients may only update `readAt`.
- `users/{uid}/challengeHabits/{deviceEventId}` is a server-owned mapping for each challenge event. `challengeSources` records may exist for older challenges created from a Configure-tab habit.
- The device schedule remains at `users/{uid}/devices/{mac}/configs/current`; challenge metadata is stored in `ui_meta.custom`. Challenge-managed events are hidden from Configure editing and completed device events are omitted from subsequent device syncs.

Clients can read challenge documents/subcollections only when listed in `participantIds`; all challenge, participant, check-in, and standings writes are Cloud Function-only. `firestore.indexes.json` contains participant/status and participant/start-date composite indexes.

## Dates and lifecycle

Dates use `YYYY-MM-DD` in the challenge creator's IANA timezone, defaulting to `Asia/Kolkata`. `getChallengeScheduleDate` returns the server's current date and minute in that timezone; users must explicitly choose today or a future date from the calendar. Streak length counts active scheduled days, so the inclusive end date is the date of the final selected weekday (an empty weekday list means every day). For a challenge starting today, every cue must still be in the future. Invitees may accept on the start date until the first scheduled cue; lifecycle activation and invite expiry wait until that cue. The callable repeats these checks using its own server clock.

`challengeLifecycle` runs every 15 minutes. It activates due pending challenges, expires unanswered invitees, cancels a challenge when only the creator accepted, and completes active challenges after the inclusive end date. Each transition rechecks status in a Firestore transaction so repeated runs do not repeat state transitions or deterministic notifications. Scheduled Functions require the Firebase Blaze plan.

## Email setup

No mail provider was configured in the existing repository. `createChallenge` writes standard Trigger Email extension documents to `mail/{documentId}` with `to` and `message.subject/text/html`. Install and configure the Firebase Trigger Email extension for the same project, point it at the `mail` collection, and configure its SMTP/provider credentials outside this repository. The extension must be deployed before invites can be delivered; bell notifications do not depend on email delivery.

## Functions and deployment

The Functions code uses the existing Node 22, CommonJS, Firebase Functions v2 setup in `functions/`, region `us-central1`. Deploy rules, indexes, and functions with the project's normal Firebase deployment process. Verify the Auth service account can look up users and the Functions service account can read/write challenge, device config, binding, notification, and mail documents.

The browser uses Firebase Auth `displayName`, `email`, and `photoURL`; there is no separate profile document. Invite search is exact-email lookup and returns a match only when that account's `deviceBindings` record has the same bound email.

## Device completion limitation

The current BLE statistics protocol stores aggregate custom-event acknowledgement entries in order, not event-ID keyed completions. `onHabitCompletion` correlates an acknowledgement increase with the current custom-event order and the saved `deviceEventId`, then writes the deterministic challenge check-in. This does not provide cryptographic proof that a physical device produced the Firestore statistics write: the existing client sync path writes those aggregate statistics documents. Strong anti-cheat guarantees require a device-signed completion event or a server-verifiable device protocol and a migration of the current statistics write path.

## Local checks

```sh
npm test
npm run build
npm run test:rules
npm --prefix functions test
```

`npm run test:rules` starts the Firestore Emulator on port 8092 and verifies participant reads, server-only protected writes, and notification `readAt` restrictions. `npm run lint` checks the new feature and touched modules; Functions also expose `npm --prefix functions run lint`.