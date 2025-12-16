
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { roleConfig } from '@/lib/roles';
import type { UserRole } from '@/types';
import Image from 'next/image';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    // Only handle redirection for logged-in users.
    // The modal opening is now handled by the button's onClick.
    if (!loading && user) {
      let roleToUse: UserRole;

      if (user.role === 'supervisor') {
          roleToUse = 'supervisor';
      } else if (user.roleTitle === 'agente aduanero') {
          roleToUse = 'agente';
      } else {
          roleToUse = user.role || 'gestor';
      }
      
      const config = roleConfig[roleToUse];
      if (config) {
          router.push(config.home);
      } else {
          router.push('/examiner'); // Fallback
      }
    }
  }, [user, loading, router]);
  
  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    // The useEffect will handle redirection after user state is updated.
  };

  const handleModalClose = () => {
    setIsLoginModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }
  
  // If user is logged in, show loader while redirecting.
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
        <p className="ml-4 text-white">Redirigiendo...</p>
      </div>
    );
  }

  // Render the main page for non-logged-in users
  return (
    <div className="min-h-screen flex flex-col justify-between grid-bg text-white p-4">
       <main className="flex flex-col items-center justify-center text-center gap-6 p-8 flex-grow">
          <Image src="/imagenes/LOGOAPPwhite.svg" alt="App Logo" width={200} height={200} className="h-48 w-48 text-primary logo-pulse" />
          <div className="space-y-2">
              <h1 className="font-montserrat text-8xl text-white leading-none">
                <span className="font-bold">EX'</span>
                <span className="font-light">OS</span>
              </h1>
              <p className="text-sm text-gray-300 tracking-wider">
                  Examiner Operative System
              </p>
          </div>
           <Button 
                onClick={() => setIsLoginModalOpen(true)} 
                variant="secondary"
                className="mt-8 px-8 py-6 text-lg"
            >
                Iniciar Sesión
            </Button>
      </main>
      
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={handleModalClose}
        onLoginSuccess={handleLoginSuccess}
        targetSystem="examiner"
      />

       <footer className="text-center text-sm text-blue-300 py-4">
        Stvaer © 2025 for ACONIC
      </footer>
    </div>
  );
}
