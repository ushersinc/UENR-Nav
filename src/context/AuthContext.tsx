import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'student' | 'lecturer' | 'staff' | 'admin' | 'visitor';
  isAdmin: boolean;
  department?: string;
  studentId?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (
    email: string,
    pass: string,
    displayName: string,
    role?: UserProfile['role'],
    department?: string,
    studentId?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshAuthToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse Firebase Auth errors into friendly student messages
  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password. Please verify your credentials.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid university or personal email address.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful attempts. Access temporarily locked; please try again shortly.';
      default:
        return err?.message || 'Authentication error occurred. Please check your network.';
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          // Check token custom claims (for server-assigned admin privileges)
          const tokenResult = await user.getIdTokenResult(true);
          const isEmailVerified = user.emailVerified === true;
          const isInstitutionalAdmin =
            isEmailVerified &&
            (user.email?.toLowerCase() === 'admin@uenr.edu.gh' ||
             user.email?.toLowerCase() === 'ushersincoperated@gmail.com');

          const hasAdminClaim =
            tokenResult.claims.admin === true ||
            tokenResult.claims.role === 'admin' ||
            isInstitutionalAdmin;

          // Fetch user document from Firestore
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            // CRITICAL: A Firestore document 'role' field can NEVER grant or spoof admin privileges
            const effectiveRole: UserProfile['role'] = hasAdminClaim
              ? 'admin'
              : data.role === 'admin'
              ? 'student'
              : data.role || 'student';

            setUserProfile({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || data.displayName || 'UENR Student',
              role: effectiveRole,
              isAdmin: hasAdminClaim,
              department: data.department || '',
              studentId: data.studentId || '',
            });
          } else {
            // New user document stub
            const initialRole: UserProfile['role'] = hasAdminClaim ? 'admin' : 'student';
            const profileData: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'UENR Member',
              role: initialRole,
              isAdmin: hasAdminClaim,
            };
            await setDoc(
              userDocRef,
              {
                ...profileData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );

            setUserProfile(profileData);
          }
        } catch (error) {
          console.warn('Error fetching user profile from Firestore:', error);
          const isInstitutionalAdmin =
            user.emailVerified === true &&
            (user.email?.toLowerCase() === 'admin@uenr.edu.gh' ||
             user.email?.toLowerCase() === 'ushersincoperated@gmail.com');

          setUserProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'UENR Student',
            role: isInstitutionalAdmin ? 'admin' : 'student',
            isAdmin: isInstitutionalAdmin,
          });
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      throw new Error(formatAuthError(err));
    }
  };

  const register = async (
    email: string,
    pass: string,
    displayName: string,
    role: UserProfile['role'] = 'student',
    department: string = '',
    studentId: string = ''
  ) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      await updateProfile(res.user, { displayName: displayName.trim() });

      // Create profile document in Firestore
      const userDocRef = doc(db, 'users', res.user.uid);
      await setDoc(userDocRef, {
        uid: res.user.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: role === 'admin' ? 'student' : role, // Prevent self-declaring admin
        department: department.trim(),
        studentId: studentId.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      throw new Error(formatAuthError(err));
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      throw new Error(formatAuthError(err));
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const refreshAuthToken = async () => {
    if (auth.currentUser) {
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      const isEmailVerified = auth.currentUser.emailVerified === true;
      const isInstitutionalAdmin =
        isEmailVerified &&
        (auth.currentUser.email?.toLowerCase() === 'admin@uenr.edu.gh' ||
         auth.currentUser.email?.toLowerCase() === 'ushersincoperated@gmail.com');

      const hasAdmin =
        tokenResult.claims.admin === true ||
        tokenResult.claims.role === 'admin' ||
        isInstitutionalAdmin;

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
        login,
        register,
        logout,
        resetPassword,
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
