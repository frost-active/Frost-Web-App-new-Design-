const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();

exports.listChallengeableUsers = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to load participants.');
  }

  const pageToken = request.data?.pageToken;
  if (pageToken !== undefined && typeof pageToken !== 'string') {
    throw new HttpsError('invalid-argument', 'The page token must be a string.');
  }

  try {
    const page = await getAuth().listUsers(1000, pageToken);
    const users = page.users
      .filter((user) => user.uid !== request.auth.uid && typeof user.email === 'string' && user.email.trim())
      .map((user) => {
        const email = user.email.trim();
        const name = user.displayName?.trim() || email.split('@')[0];
        return { uid: user.uid, name, email };
      })
      .filter((user) => user.name.length > 0);

    return { users, nextPageToken: page.pageToken ?? null };
  } catch (error) {
    console.error('Failed to list Firebase Authentication users:', error);
    if (error?.code === 'auth/insufficient-permission') {
      throw new HttpsError(
        'permission-denied',
        'The participant function service account needs permission to list Firebase Authentication users.'
      );
    }
    throw new HttpsError('internal', 'Unable to load participants. Please try again.');
  }
});