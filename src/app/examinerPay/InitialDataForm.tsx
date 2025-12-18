
"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { SolicitudTable } from './SolicitudTable';
import { PlusCircle, CheckCircle, ArrowLeft, ListCollapse } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { AddProductModal } from './AddProductModal';
import { PreviewScreen } from './PreviewScreen';
import { SuccessModal } from './SuccessModal';

interface PaymentRequestFlowProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InitialDataForm({ isOpen, onClose }: PaymentRequestFlowProps) {
  const { 
    initialContextData, 
    setCurrentStep, 
    openAddProductModal, 
    solicitudes,
    currentStep: currentPaymentStep, // Renamed to avoid conflict
  } = useAppContext();
  const { toast } = useToast();

  if (!isOpen) return null;

  if (!initialContextData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <p>No se encontraron datos iniciales para la solicitud.</p>
          <DialogFooter>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleFinish = () => {
     if (solicitudes.length === 0) {
        toast({
            title: "Atención",
            description: "Debe agregar al menos una solicitud antes de finalizar.",
            variant: "destructive",
        });
        return;
      }
    setCurrentStep(ExamStep.PREVIEW);
  }

  const renderContent = () => {
    switch (currentPaymentStep) {
        case ExamStep.SOLICITUD_LIST:
            return (
                <Card className="w-full max-w-5xl mx-auto shadow-none border-none">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 gap-4">
                            <CardTitle className="text-xl md:text-2xl font-semibold text-gray-800">SOLICITUDES</CardTitle>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button onClick={() => openAddProductModal()} className="btn-primary">
                                    <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nueva Solicitud
                                </Button>
                                <Button onClick={handleFinish} className="btn-secondary">
                                    <CheckCircle className="mr-2 h-5 w-5" /> Finalizar y Previsualizar
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6 p-4 bg-secondary/30 border border-border rounded-md shadow">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div><span className="font-semibold">A:</span> {initialContextData.recipient}</div>
                                <div><span className="font-semibold">De (Usuario):</span> {initialContextData.manager}</div>
                                <div><span className="font-semibold">Fecha:</span> {initialContextData.date ? format(new Date(initialContextData.date), "PPP", { locale: es }) : 'N/A'}</div>
                                <div><span className="font-semibold">NE:</span> {initialContextData.ne}</div>
                                <div><span className="font-semibold">Referencia:</span> {initialContextData.reference || 'N/A'}</div>
                            </div>
                        </div>
                        <SolicitudTable />
                    </CardContent>
                </Card>
            );
        case ExamStep.PREVIEW:
            return <PreviewScreen />;
        case ExamStep.SUCCESS:
            return <SuccessModal />;
        default:
             setCurrentStep(ExamStep.SOLICITUD_LIST);
             return null;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl w-full p-0 h-auto max-h-[95vh] flex flex-col">
            {renderContent()}
        </DialogContent>
        {/* AddProductModal is self-managing based on app context */}
        <AddProductModal />
    </Dialog>
  );
}
