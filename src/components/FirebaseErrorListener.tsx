"use client"

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';

// This component listens for Firestore permission errors and throws them
// to be caught by the Next.js development error overlay.
export const FirebaseErrorListener = () => {
    useEffect(() => {
        const handleError = (error: FirestorePermissionError) => {
            // Throw the error so Next.js can display its beautiful error overlay
            // with the rich, contextual error information. This is for dev only.
            if (process.env.NODE_ENV === 'development') {
                throw error;
            }
        };

        errorEmitter.on('permission-error', handleError);

        return () => {
            errorEmitter.off('permission-error', handleError);
        };
    }, []);

    return null; // This component does not render anything
};
