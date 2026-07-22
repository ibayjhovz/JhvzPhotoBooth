import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

// Enable Firestore offline persistence for cross-device caching & synchronization
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db)
    .then(() => {
      console.log('[FIRESTORE] Multi-tab offline persistence enabled successfully!');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[FIRESTORE] Multi-tab persistence failed-precondition (multiple tabs open).');
      } else if (err.code === 'unimplemented') {
        // Fallback to single-tab persistence
        enableIndexedDbPersistence(db)
          .then(() => {
            console.log('[FIRESTORE] Single-tab offline persistence enabled successfully!');
          })
          .catch((singleErr) => {
            console.error('[FIRESTORE] Single-tab offline persistence failed:', singleErr);
          });
      } else {
        console.error('[FIRESTORE] Error enabling offline persistence:', err);
      }
    });
}

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    const code = error?.code || '';
    const msg = error?.message || '';
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/invalid-actionCode' ||
      msg.includes('action is invalid') ||
      msg.includes('operation-not-allowed')
    ) {
      const customErr: any = new Error(
        'Google Sign-In is not enabled in Firebase Console for project jhvzphotobooth.'
      );
      customErr.code = 'auth/operation-not-allowed';
      throw customErr;
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
