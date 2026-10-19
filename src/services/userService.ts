import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../firebase';

export type ChallengeUser = { uid: string; name: string; email: string; photoURL: string | null };

export async function getChallengeableUsers(currentUid: string, emailQuery = ''): Promise<ChallengeUser[]> {
  const email = emailQuery.trim();
  if (!email || !email.includes('@')) return [];
  const search = httpsCallable<{ email: string }, { users: ChallengeUser[] }>(firebaseFunctions, 'listChallengeableUsers');
  const response = await search({ email });
  return response.data.users.filter((user) => user.uid !== currentUid);
}