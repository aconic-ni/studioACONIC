
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2 } from 'lucide-react';
import { RequestForm } from '@/components/executive/RequestForm';

export default function RequestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const allowedRoles = ['ejecutivo', 'coordinadora', 'admin'];

  useEffect(() => {
    if (!authLoading && (!user || !user.role || !allowedRoles.includes(user.role))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !user.role || !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <RequestForm />
      </div>
    </AppShell>
  );
}
