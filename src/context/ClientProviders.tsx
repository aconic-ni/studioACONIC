
"use client";

import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <AppProvider>
          <FirebaseErrorListener />
          {children}
        </AppProvider>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
