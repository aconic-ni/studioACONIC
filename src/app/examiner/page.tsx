
"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { AppShell } from '@/components/layout/AppShell';
import { InitialInfoForm } from '@/components/examiner/InitialInfoForm';
import { ProductListScreen } from '@/components/examiner/ProductListScreen';
import { PreviewScreen } from '@/components/examiner/PreviewScreen';
import { SuccessModal } from '@/components/examiner/SuccessModal';
import { ExaminerWelcome } from '@/components/examiner/ExaminerWelcome';
import { Loader2 } from 'lucide-react';
import { SetDisplayNameModal } from '@/components/auth/SetDisplayNameModal';

export default function ExaminerPage() {
  const { user, loading: authLoading, isProfileComplete } = useAuth();
  const { currentStep } = useAppContext();
  const router = useRouter();
  const [isDisplayNameModalOpen, setIsDisplayNameModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const allowedRoles = ['gestor', 'admin'];
      if (user.role === 'calificador') {
        router.push('/databasePay');
      } else if (user.role && !allowedRoles.includes(user.role)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // an admin should not be forced to set a display name if they are just viewing
    if (!authLoading && user && !isProfileComplete && user.role !== 'admin') {
      setIsDisplayNameModalOpen(true);
    } else {
      setIsDisplayNameModalOpen(false);
    }
  }, [user, authLoading, isProfileComplete]);

  // Add a beforeunload listener to prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Show confirmation dialog only if an exam is in progress
      if (currentStep > ExamStep.WELCOME && currentStep < ExamStep.SUCCESS) {
        event.preventDefault();
        event.returnValue = ''; // For Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentStep]);


  if (authLoading || (user && !isProfileComplete && user.role !== 'admin') || !user || (user.role && !['gestor', 'admin', 'calificador'].includes(user.role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando perfil...</p>
        <SetDisplayNameModal isOpen={isDisplayNameModalOpen} />
      </div>
    );
  }

  if (!user) {
     // This typically won't be seen due to redirect, but good for robustness
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg">Redirigiendo a inicio de sesión...</p>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case ExamStep.WELCOME:
        return <ExaminerWelcome />;
      case ExamStep.INITIAL_INFO:
        return <InitialInfoForm />;
      case ExamStep.PRODUCT_LIST:
        return <ProductListScreen />;
      case ExamStep.PREVIEW:
        return <PreviewScreen />;
      case ExamStep.SUCCESS:
        // SuccessModal is a dialog, typically shown over other content.
        return <> <PreviewScreen /> <SuccessModal /> </>; // Show preview underneath success
      default:
        return <ExaminerWelcome />;
    }
  };

  return (
    <AppShell>
       <SetDisplayNameModal isOpen={isDisplayNameModalOpen} />
      <div className="py-2 md:py-5">
         {renderStepContent()}
      </div>
      {/* SuccessModal is rendered conditionally inside renderStepContent or always if it handles its own visibility based on currentStep */}
      {currentStep === ExamStep.SUCCESS && <SuccessModal />}
    </AppShell>
  );
}
