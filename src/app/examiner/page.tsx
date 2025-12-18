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
import { InitialDataForm as PaymentRequestFlow } from '@/components/examinerPay/InitialInfoForm';

export default function ExaminerPage() {
  const { user, loading: authLoading, isProfileComplete } = useAuth();
  const { currentStep, isPaymentRequestFlowOpen, closePaymentRequestFlow } = useAppContext();
  const router = useRouter();
  const [isDisplayNameModalOpen, setIsDisplayNameModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const allowedRoles = ['gestor', 'admin', 'supervisor', 'coordinadora'];
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
    if (!authLoading && user && !isProfileComplete && user.role !== 'admin') {
      setIsDisplayNameModalOpen(true);
    } else {
      setIsDisplayNameModalOpen(false);
    }
  }, [user, authLoading, isProfileComplete]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentStep > ExamStep.WELCOME && currentStep < ExamStep.SUCCESS) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentStep]);

  if (authLoading || (user && !isProfileComplete && user.role !== 'admin') || !user || (user.role && !['gestor', 'admin', 'supervisor', 'coordinadora', 'calificador'].includes(user.role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando perfil...</p>
        <SetDisplayNameModal isOpen={isDisplayNameModalOpen} />
      </div>
    );
  }

  if (!user) {
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
        return <> <PreviewScreen /> <SuccessModal /> </>;
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
      {currentStep === ExamStep.SUCCESS && <SuccessModal />}
      {isPaymentRequestFlowOpen && <PaymentRequestFlow isOpen={isPaymentRequestFlowOpen} onClose={closePaymentRequestFlow} />}
    </AppShell>
  );
}
