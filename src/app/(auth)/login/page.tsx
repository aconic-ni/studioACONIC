
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { roleConfig } from '@/lib/roles';
import type { UserRole } from '@/types';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
        router.push('/examiner'); // Fallback to a default page
      }
    }
  }, [user, loading, router]);

  const handleLoginSuccess = () => {
    // The redirection is now handled by the useEffect above
  };
  
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg">
       <LoginModal isOpen={true} onClose={() => router.push('/')} onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}
