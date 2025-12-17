"use client"
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { app } from '@/lib/firebase';

interface FirebaseClientContextType {
    auth: Auth | null;
    db: Firestore | null;
}

const FirebaseClientContext = createContext<FirebaseClientContextType | undefined>(undefined);

export const FirebaseClientProvider = ({ children }: { children: React.ReactNode }) => {
    const [auth, setAuth] = useState<Auth | null>(null);
    const [db, setDb] = useState<Firestore | null>(null);

    useEffect(() => {
        // Firebase services are only available on the client
        setAuth(getAuth(app));
        setDb(getFirestore(app));
    }, []);

    return (
        <FirebaseClientContext.Provider value={{ auth, db }}>
            {children}
        </FirebaseClientContext.Provider>
    );
};

export const useFirebaseClient = () => {
    const context = useContext(FirebaseClientContext);
    if (context === undefined) {
        throw new Error('useFirebaseClient must be used within a FirebaseClientProvider');
    }
    return context;
};
