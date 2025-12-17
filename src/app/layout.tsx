
import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseAppProvider } from '@/context/FirebaseAppContext'; // Renamed to avoid conflict
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "EX'OS", // Updated title
  description: 'Sistema de Examenes Previos by Jordy Stvaer', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased`} suppressHydrationWarning={true}>
        <FirebaseAppProvider>
          <AppProvider>
            <AuthProvider>
              <FirebaseErrorListener />
              {children}
              <Toaster />
            </AuthProvider>
          </AppProvider>
        </FirebaseAppProvider>
      </body>
    </html>
  );
}
