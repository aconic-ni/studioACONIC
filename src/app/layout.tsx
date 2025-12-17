import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseAppProvider } from '@/context/FirebaseAppContext';
import { ClientProviders } from '@/context/ClientProviders';

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
  title: "EX'OS",
  description: 'Sistema de Examenes Previos by Jordy Stvaer',
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
          <ClientProviders>
            {children}
            <Toaster />
          </ClientProviders>
        </FirebaseAppProvider>
      </body>
    </html>
  );
}
