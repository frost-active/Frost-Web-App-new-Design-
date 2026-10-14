import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../firebase';

export type ChallengeUser = { uid: string; name: string; email: string };
type ChallengeUsersPage = { users: ChallengeUser[]; nextPageToken?: string | null };

export async function getChallengeableUsers(currentUid: string): Promise<ChallengeUser[]> {
  const getUsersPage = httpsCallable<{ pageToken?: string }, ChallengeUsersPage>(firebaseFunctions, 'listChallengeableUsers');
  const users: ChallengeUser[] = [];
  let pageToken: string | undefined;

  do {
    const response = await getUsersPage(pageToken ? { pageToken } : {});
    users.push(...response.data.users.filter((user) => user.uid !== currentUid));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  users.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

  console.log(`[New Challenge] Fetched ${users.length} Firebase Authentication users:`, users);
  return users;
}