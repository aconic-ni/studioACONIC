
"use client";
import * as React from "react";
import { createContext, useContext, useEffect, useState } from 'react';
import { app } from '@/lib/firebase'; // Ensure this path is correct and app is exported
import type { FirebaseApp } from 'firebase/app';

interface FirebaseContextType {
  firebaseApp: FirebaseApp | null;
  isFirebaseInitialized: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | null>(null);
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);

  useEffect(() => {
    // The 'app' imported from '@/lib/firebase' is already initialized.
    // We just need to set it in the state.
    if (app) {
      setFirebaseApp(app);
      setIsFirebaseInitialized(true);
    }
  }, []);

  return (
    <FirebaseContext.Provider value={{ firebaseApp, isFirebaseInitialized }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebaseApp = (): FirebaseContextType => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseApp must be used within a FirebaseAppProvider');
  }
  return context;
};
