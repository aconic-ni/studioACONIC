"use client";
import type React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser, type Auth } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // Firebase auth instance and db
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import type { AppUser, UserRole } from '@/types';
import { useFirebaseApp } from './FirebaseAppContext';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  isProfileComplete: boolean;
  updateUserProfile: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const { isFirebaseInitialized } = useFirebaseApp();

  const checkUserProfile = useCallback(async (firebaseUser: FirebaseUser) => {
    if (firebaseUser.isAnonymous) {
      setUser(null);
      setIsProfileComplete(false);
      return;
    }

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      const userRole = userData.role || 'gestor'; // Default to 'gestor' if no role
      
      let visibilityGroupMembers: { uid: string; displayName: string; email: string; }[] = [];
      if (userData.visibilityGroup && userData.visibilityGroup.length > 0) {
          try {
            const usersQuery = query(collection(db, "users"), where(documentId(), 'in', userData.visibilityGroup));
            const userDocs = await getDocs(usersQuery);
            visibilityGroupMembers = userDocs.docs.map(d => ({
                uid: d.id,
                displayName: d.data().displayName || 'N/A',
                email: d.data().email || 'N/A'
            }));
          } catch (e) {
            console.error("Error fetching visibility group members:", e);
          }
      }

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: userData.displayName,
        role: userRole, 
        roleTitle: userData.roleTitle || null,
        hasReportsAccess: userData.hasReportsAccess || false,
        hasPaymentAccess: userData.hasPaymentAccess || false,
        visibilityGroup: visibilityGroupMembers,
        canReviewUserEmails: userData.canReviewUserEmails || [],
      });
      setIsProfileComplete(!!userData.displayName);

    } else {
      // New user, profile is incomplete, create doc with default role
      const defaultRole: UserRole = 'gestor';
      await setDoc(userDocRef, { 
        email: firebaseUser.email,
        role: defaultRole,
        createdAt: serverTimestamp(),
        hasReportsAccess: false,
        hasPaymentAccess: false,
      }, { merge: true });
      
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: null,
        role: defaultRole,
        roleTitle: null,
        hasReportsAccess: false,
        hasPaymentAccess: false,
      });

      setIsProfileComplete(false);
    }
  }, []);

  const updateUserProfile = async (name: string) => {
    if (!user) throw new Error("User not authenticated");
    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const userDataToSet: { displayName: string; email: string | null; createdAt?: any, role?: UserRole } = {
        displayName: name,
        email: user.email,
      };

      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists() || !docSnap.data().role) {
          userDataToSet.role = 'gestor'; // Default role
          userDataToSet.createdAt = serverTimestamp();
      }

      await setDoc(userDocRef, userDataToSet, { merge: true });
      
      setUser(prevUser => prevUser ? { ...prevUser, displayName: name, role: prevUser.role || 'gestor' } : null);
      setIsProfileComplete(true);
    } catch (error) {
      console.error("Error updating user profile:", error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!isFirebaseInitialized) {
      setLoading(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth as Auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        await checkUserProfile(firebaseUser);
      } else {
        setUser(null);
        setIsProfileComplete(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseInitialized, checkUserProfile]);

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth as Auth);
      setUser(null);
      setIsProfileComplete(false);
    } catch (error) {
      console.error("Error signing out: ", error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, logout, isProfileComplete, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};