
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

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const userRole = user.role || 'gestor';
      let roleToUse: UserRole;

      if (user.roleTitle === 'agente aduanero') {
        roleToUse = 'agente';
      } else if (userRole === 'invitado') {
        roleToUse = 'invitado';
      } else {
        roleToUse = userRole;
      }
      
      const config = roleConfig[roleToUse];
      if (config) {
        router.push(config.home);
      } else {
        // Fallback to a default page if role config is missing
        router.push('/examiner');
      }
    } else if (!loading && !user) {
      // If not loading and no user, ensure login modal is open
      setIsLoginModalOpen(true);
    }
  }, [user, loading, router]);
  
  const handleLoginSuccess = () => {
    // The redirection is now handled by the useEffect above
    setIsLoginModalOpen(false);
  };

  const handleModalClose = () => {
    // Keep the modal open if there's no user
    if (!user) {
        setIsLoginModalOpen(true);
    } else {
        setIsLoginModalOpen(false);
    }
  }

  // Show a loading spinner while checking auth state or if user is logged in and redirecting
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }

  // If not loading and no user, the modal will be shown.
  // We can render a fallback UI here, but the modal will overlay it.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center grid-bg text-white p-4 gap-y-8">
       <main className="flex flex-col md:flex-row items-center gap-x-4 gap-y-8">
        <Card className="w-80 h-96 bg-card text-card-foreground rounded-xl custom-shadow flex flex-col justify-center">
            <CardContent className="flex flex-col items-center justify-center text-center gap-6 p-8">
                <FileText className="h-20 w-20 text-primary" strokeWidth={1.5} />
                <div className="space-y-1">
                    <CardTitle className="text-3xl font-bold">CustomsEX-p</CardTitle>
                    <CardDescription className="text-sm">Sistema de Gestión de Operaciones</CardDescription>
                </div>
            </CardContent>
        </Card>
      </main>
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
