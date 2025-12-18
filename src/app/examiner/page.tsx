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
import { PaymentRequestFlow } from '@/components/examinerPay/InitialDataForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function ExaminerPage() {
  const { user, loading: authLoading, isProfileComplete } = useAuth();
  const { currentStep, isPaymentRequestFlowOpen, closePaymentRequestFlow } = useAppContext();
  const router = useRouter();
  const [isDisplayNameModalOpen, setIsDisplayNameModalOpen] = useState(false);

  useEffect(() => {
    // This check ensures we don't redirect away when the payment flow is meant to be open.
    if (isPaymentRequestFlowOpen) return;

    if (!authLoading && user) {
      const allowedRoles = ['gestor', 'admin', 'supervisor', 'coordinadora', 'ejecutivo'];
      if (user.role === 'calificador') {
        router.push('/databasePay');
      } else if (user.role && !allowedRoles.includes(user.role)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router, isPaymentRequestFlowOpen]);


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
  
  if (authLoading || (user && !isProfileComplete && user.role !== 'admin') || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando perfil...</p>
        <SetDisplayNameModal isOpen={isDisplayNameModalOpen} />
      </div>
    );
  }

  // Render the payment flow in a modal over the existing page content
  if (isPaymentRequestFlowOpen) {
    return (
      <AppShell>
         <div className="py-2 md:py-5">
           <ExaminerWelcome />
         </div>
        <Dialog open={isPaymentRequestFlowOpen} onOpenChange={closePaymentRequestFlow}>
            <DialogContent className="max-w-6xl w-full p-0 h-auto max-h-[95vh] flex flex-col">
                <PaymentRequestFlow isOpen={isPaymentRequestFlowOpen} onClose={closePaymentRequestFlow} />
            </DialogContent>
        </Dialog>
      </AppShell>
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
    </AppShell>
  );
}
