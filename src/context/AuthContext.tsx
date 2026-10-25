import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role: 'student' | 'lecturer' | 'staff' | 'admin' | 'visitor';
  isAdmin: boolean;
  department?: string;
  studentId?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: (useRedirect?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshAuthToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Friendly error message converter for Google Sign-In and Firebase Auth
  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'The Google sign-in window was closed before completion. Please click "Continue with Google" to try again.';
      case 'auth/cancelled-popup-request':
        return 'Sign-in window already in progress. Please check your open windows or browser tabs.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in popup. Please enable popups or select "Use Full-Page Redirect".';
      case 'auth/operation-not-allowed':
        return 'Google Sign-In is not enabled yet in the Firebase Console. Please enable "Google" under Authentication > Sign-in method.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in Firebase Console. Please add your preview or hosting domain under Authentication > Settings > Authorized domains.';
      case 'auth/network-request-failed':
        return 'Network connection problem. Please verify your internet connection.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email address. Please sign in with your primary credential.';
      default:
        return err?.message || 'Authentication failed. Please check your connection and try again.';
    }
  };

  // Check for redirect result on app load (handles mobile / popup-blocked environments)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log('Google redirect sign-in completed for:', result.user.email);
        }
      })
      .catch((err) => {
        console.warn('Redirect sign-in notice:', err);
      });
  }, []);

  // Listen to auth state changes and synchronize user profile safely with Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          // Check server-assigned custom claims (the ONLY valid source of admin privileges)
          const tokenResult = await user.getIdTokenResult();
          const hasAdminClaim =
            tokenResult.claims.admin === true ||
            tokenResult.claims.role === 'admin';

          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            // Client-supplied document fields can NEVER override custom claims for admin rights
            const effectiveRole: UserProfile['role'] = hasAdminClaim
              ? 'admin'
              : data.role === 'admin'
              ? 'student'
              : data.role || 'student';

            const profile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName: data.displayName || user.displayName || 'UENR Member',
              photoURL: user.photoURL || data.photoURL || null,
              role: effectiveRole,
              isAdmin: hasAdminClaim,
              department: data.department || '',
              studentId: data.studentId || '',
              createdAt: data.createdAt,
              lastLoginAt: new Date().toISOString(),
            };

            // Safely update last login and latest Google avatar without touching favorites or custom metadata
            await setDoc(
              userDocRef,
              {
                email: user.email,
                displayName: profile.displayName,
                photoURL: profile.photoURL,
                lastLoginAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );

            setUserProfile(profile);
          } else {
            // First-time user profile creation
            const initialRole: UserProfile['role'] = hasAdminClaim ? 'admin' : 'student';
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'UENR Member',
              photoURL: user.photoURL || null,
              role: initialRole,
              isAdmin: hasAdminClaim,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            };

            await setDoc(
              userDocRef,
              {
                uid: newProfile.uid,
                email: newProfile.email,
                displayName: newProfile.displayName,
                photoURL: newProfile.photoURL,
                role: initialRole,
                createdAt: newProfile.createdAt,
                lastLoginAt: newProfile.lastLoginAt,
                updatedAt: newProfile.lastLoginAt,
              },
              { merge: true }
            );

            setUserProfile(newProfile);
          }
        } catch (error) {
          console.warn('Firestore user profile sync warning (offline or permissions):', error);
          const tokenResult = await user.getIdTokenResult().catch(() => null);
          const hasAdminClaim =
            tokenResult?.claims?.admin === true ||
            tokenResult?.claims?.role === 'admin';

          setUserProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'UENR Member',
            photoURL: user.photoURL || null,
            role: hasAdminClaim ? 'admin' : 'student',
            isAdmin: !!hasAdminClaim,
          });
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Primary Google Sign-In Method with automatic popup fallback to redirect
  const signInWithGoogle = async (useRedirect = false): Promise<void> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    try {
      if (useRedirect) {
        await signInWithRedirect(auth, provider);
        return;
      }

      try {
        await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        if (
          popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          console.warn('Popup restricted, falling back to signInWithRedirect:', popupErr.code);
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (err: any) {
      throw new Error(formatAuthError(err));
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const refreshAuthToken = async () => {
    if (auth.currentUser) {
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      const hasAdmin =
        tokenResult.claims.admin === true ||
        tokenResult.claims.role === 'admin';

      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              isAdmin: hasAdmin,
              role: hasAdmin ? 'admin' : prev.role === 'admin' ? 'student' : prev.role,
            }
          : null
      );
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin: !!userProfile?.isAdmin,
        loading,
        signInWithGoogle,
        logout,
        getIdToken,
        refreshAuthToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
