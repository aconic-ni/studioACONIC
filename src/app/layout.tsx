
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed from Geist to Inter
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseAppProvider } from '@/context/FirebaseAppContext'; // Renamed to avoid conflict
import { use } from 'react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

const inter = Inter({ // Changed from Geist to Inter
  variable: '--font-inter', // Changed variable name
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ACONIC Examiner', // Updated title
  description: 'Sistema de Examenes Previos by Jordy Stvaer', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning={true}> {/* Use Inter variable */}
        <FirebaseAppProvider>
          <AuthProvider>
            <AppProvider>
              <FirebaseErrorListener />
              {children}
              <Toaster />
            </AppProvider>
          </AuthProvider>
        </FirebaseAppProvider>
      </body>
    </html>
  );
}
