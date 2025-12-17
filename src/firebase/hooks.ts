"use client"
import { useFirebaseClient } from './client-provider';

export const useFirebaseAuth = () => {
    const { auth } = useFirebaseClient();
    return auth;
}

export const useFirestore = () => {
    const { db } = useFirebaseClient();
    return db;
}
