"use client";

import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppProvider>
        <FirebaseErrorListener />
        {children}
      </AppProvider>
    </AuthProvider>
  );
}
