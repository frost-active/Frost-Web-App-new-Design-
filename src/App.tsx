import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import AuthScreen from './AuthScreen';
import { firebaseAuth } from './firebase';
import HomeScreen from './HomeScreen';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    const signOutListener = () => { void signOut(firebaseAuth); };
    window.addEventListener('frost-signout', signOutListener);
    return () => {
      unsubscribe();
      window.removeEventListener('frost-signout', signOutListener);
    };
  }, []);

  if (!authReady) return <div className="auth-loading"><span>FROST</span><i /></div>;
  if (!user) return <AuthScreen />;
  return <HomeScreen user={user} />;
}