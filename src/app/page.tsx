
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { roleConfig } from '@/lib/roles';
import type { UserRole } from '@/types';
import Image from 'next/image';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is logged in, redirect based on role
        const userRole = user.role || 'gestor';
        let roleToUse: UserRole;

        if (user.roleTitle === 'agente aduanero') {
            roleToUse = 'agente';
        } else {
            roleToUse = userRole;
        }
        
        const config = roleConfig[roleToUse];
        if (config) {
            router.push(config.home);
        } else {
            router.push('/examiner'); // Fallback
        }
      } else {
        // No user, open the login modal
        setIsLoginModalOpen(true);
      }
    }
  }, [user, loading, router]);
  
  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    // Redirection is handled by the useEffect
  };

  const handleModalClose = () => {
    // If the modal is closed without logging in, we keep it closed.
    // The useEffect will reopen it if the user is still not logged in.
    setIsLoginModalOpen(false);
  };

  // While loading, show a full-screen spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }

  // Always render the main page content. The modal will appear on top.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center grid-bg text-white p-4 gap-y-8">
       <main className="flex flex-col md:flex-row items-center gap-x-4 gap-y-8">
        <Card className="w-80 h-96 bg-card text-card-foreground rounded-xl custom-shadow flex flex-col justify-center">
            <CardContent className="flex flex-col items-center justify-center text-center gap-6 p-8">
                <Image src="/imagenes/LOGOAPP.svg" alt="App Logo" width={80} height={80} className="h-20 w-20 text-primary" />
                <div className="space-y-1">
                    <CardTitle className="font-montserrat text-4xl">
                        <span className="font-semibold">EX'</span>
                        <span className="font-light">OS</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground pt-1">
                        Examiner Operative System
                    </CardDescription>
                </div>
            </CardContent>
        </Card>
      </main>
      
      {/* The LoginModal is now controlled by the state and will overlay the main content */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={handleModalClose}
        onLoginSuccess={handleLoginSuccess}
        targetSystem="examiner"
      />

       <footer className="text-center text-sm text-blue-300 mt-auto md:mt-0">
        Stvaer © 2025 for ACONIC
      </footer>
    </div>
  );
}
