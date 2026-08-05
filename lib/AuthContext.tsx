import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithCredential,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { auth } from '@/lib/firebase';

const getExpoExtra = () =>
  (Constants as any)?.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
const extras = getExpoExtra();

const GOOGLE_WEB_CLIENT_ID =
  extras.GOOGLE_WEB_CLIENT_ID ?? process.env.GOOGLE_WEB_CLIENT_ID ?? '';


type AuthContextType = {
  user: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Configure Google Sign-In once after the component mounts so the native
  // module is guaranteed to be initialised before configure() is called.
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
  }, []);

  // Track Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (!idToken) {
          // idToken is null when:
          //   1. The webClientId in GoogleSignin.configure() is an Android client ID
          //      instead of the Web client ID from Firebase Auth settings, OR
          //   2. The app's signing SHA-1 is not registered in the Firebase project
          //      (common with Play Store builds — use Google Play's App Signing SHA-1,
          //      not your upload key SHA-1).
          console.error(
            '[Google Sign-In] idToken is null.\n' +
            'Check: (1) webClientId in AuthContext must be the Web client ID from ' +
            'Firebase Console → Authentication → Sign-in method → Google → Web SDK configuration.\n' +
            '(2) The App signing key SHA-1 from Google Play Console → Release → Setup → App signing ' +
            'must be registered in Firebase Console → Project Settings → Android app → SHA fingerprints.'
          );
          setError('Google sign-in failed. Please try again.');
          return;
        }
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      } else {
        // User cancelled — not an error
      }
    } catch (err: any) {
      console.error('[Google Sign-In] error:', err);
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User dismissed — no error message needed
            break;
          case statusCodes.IN_PROGRESS:
            setError('Sign-in already in progress.');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            setError('Google Play Services not available on this device.');
            break;
          default:
            setError('Google sign-in failed. Please try again.');
        }
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(friendlyError(err.code));
      throw err;
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ) => {
    setError(null);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(newUser, { displayName });
      }
    } catch (err: any) {
      setError(friendlyError(err.code));
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    await signOut(auth);
    // Also sign out from Google so the account picker shows next time
    try { await GoogleSignin.signOut(); } catch { /* ignore */ }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
