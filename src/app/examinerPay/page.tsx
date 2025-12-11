"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { AppShell } from '@/components/layout/AppShell';
import { InitialDataForm } from '@/components/examinerPay/InitialInfoForm';
import { SolicitudListScreen } from '@/components/examinerPay/SolicitudListScreen';
import { PreviewScreen } from '@/components/examinerPay/PreviewScreen';
import { SuccessModal } from '@/components/examinerPay/SuccessModal';
import { AddProductModal } from '@/components/examinerPay/AddProductModal';
import { Loader2 } from 'lucide-react';

export default function SolicitudPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentStep, isAddProductModalOpen, openAddProductModal } = useAppContext();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    // If the modal isn't open and the app context says it should be (e.g. from redirect), open it.
    if(isClient && !isAddProductModalOpen && currentStep === ExamStep.INITIAL_DATA) {
        openAddProductModal();
    }
  }, [isClient, currentStep, isAddProductModalOpen, openAddProductModal]);

  useEffect(() => {
    if (!isClient || authLoading) {
      return;
    }

    if (!user) {
      router.push('/login');
    }
  }, [user, authLoading, router, isClient]);

  useEffect(() => {
    if (!isClient) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentStep > ExamStep.INITIAL_DATA && currentStep < ExamStep.SUCCESS) {
        event.preventDefault();
        event.returnValue = ''; 
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isClient, currentStep]);

  if (!isClient || authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
        <p className="ml-4 text-lg text-white">Cargando aplicación...</p>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case ExamStep.PRODUCT_LIST:
        return <SolicitudListScreen />;
      case ExamStep.PREVIEW:
        return <PreviewScreen />;
      case ExamStep.SUCCESS:
        return <PreviewScreen />; 
      default:
        // Render nothing by default, rely on the modal to be the primary UI
        return <SolicitudListScreen />;
    }
  };

  return (
    <AppShell>
      <div className="py-2 md:py-5">
         {renderStepContent()}
      </div>
      <AddProductModal />
      {currentStep === ExamStep.SUCCESS && <SuccessModal />}
    </AppShell>
  );
}
