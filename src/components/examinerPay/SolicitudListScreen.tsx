"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { SolicitudTable } from './SolicitudTable';
import { PlusCircle, CheckCircle, ArrowLeft, ListCollapse } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import SolicitudDetailView from '@/components/shared/SolicitudDetailView'; 
import { useRouter } from 'next/navigation';

export function SolicitudListScreen() {
  const { 
    initialContextData, 
    setCurrentStep, 
    openAddProductModal, 
    solicitudes,
    solicitudToViewInline,
    setSolicitudToViewInline
  } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();

  if (!initialContextData) {
    return (
      <div className="text-center py-10">
        <p className="text-white">Error: Datos iniciales de la solicitud no encontrados.</p>
        <Button onClick={() => router.push('/')} className="mt-4">
          Volver al inicio
        </Button>
      </div>
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
  
  if (solicitudToViewInline && initialContextData) {
    return (
      <SolicitudDetailView 
        solicitud={solicitudToViewInline} 
        initialData={initialContextData} 
        onBackToList={() => setSolicitudToViewInline(null)}
      />
    );
  }


  return (
      <Card className="w-full custom-shadow">
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
}
