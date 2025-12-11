"use client";
import { LegalRequestForm } from '@/components/legal/LegalRequestForm';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function LegalRequestPageContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
        }
    }, [user, authLoading, router]);
    
    if (authLoading || !user) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        );
    }

    return (
        <AppShell>
            <div className="py-2 md:py-5">
                <LegalRequestForm />
            </div>
        </AppShell>
    );
}

export default function LegalRequestPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <LegalRequestPageContent />
        </Suspense>
    );
}
