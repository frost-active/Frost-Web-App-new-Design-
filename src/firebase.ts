import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB6m6qy9NW9TIOHiiXWVj--D_rXCdnWP9U',
  authDomain: 'frost-aura-web-app---new.firebaseapp.com',
  projectId: 'frost-aura-web-app---new',
  storageBucket: 'frost-aura-web-app---new.firebasestorage.app',
  messagingSenderId: '288108536346',
  appId: '1:288108536346:web:b47dae56a091f7bcdda7a3',
  measurementId: 'G-LH4F4LE212',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const firebaseAnalytics = typeof window !== 'undefined' ? getAnalytics(firebaseApp) : undefined;