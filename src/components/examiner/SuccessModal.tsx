
"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { CheckCircle, RotateCcw, Save, Home, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { ExamDocument, Product } from '@/types';
import { downloadExcelFile } from '@/lib/fileExporter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useRouter } from 'next/navigation';


export function SuccessModal() {
  const { currentStep, setCurrentStep, resetApp, examData, products } = useAppContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isInstructionAlertOpen, setIsInstructionAlertOpen] = useState(false);

  const handleSaveToDatabase = async () => {
    if (!examData || !user || !user.email) {
      toast({
        title: "Error al guardar",
        description: "Faltan datos del examen o información del usuario.",
        variant: "destructive",
      });
      return;
    }
    if (!examData.ne) {
      toast({
        title: "Error al guardar",
        description: "El número NE (Seguimiento NX1) es requerido para guardar.",
        variant: "destructive",
      });
      return;
    }
  
    try {
      const examDocRef = doc(db, "examenesPrevios", examData.ne.toUpperCase());
  
      const productsForDb = products.map((p): Product => {
        const productCopy = { ...p };
        for (const key in productCopy) {
            if (productCopy[key as keyof Product] === undefined) {
                (productCopy as any)[key] = null;
            }
        }
        return productCopy;
      });
  
      const dataToSave: Partial<ExamDocument> = {
        ...examData,
        products: productsForDb,
        savedBy: user.email,
        status: 'complete',
        lock: 'on',
        lastUpdated: Timestamp.fromDate(new Date()),
        savedAt: Timestamp.fromDate(new Date()),
        completedAt: Timestamp.fromDate(new Date()),
      };
  
      await setDoc(examDocRef, dataToSave, { merge: true });
      toast({
        title: "Examen Finalizado y Guardado",
        description: `El examen NE: ${examData.ne} ha sido guardado en la base de datos.`,
      });

      // Trigger automatic Excel download
      downloadExcelFile({ ...examData, products });

      // Open the instruction alert
      setIsInstructionAlertOpen(true);

    } catch (error: any) {
      console.error("Error saving document to Firestore: ", error);
      toast({
        title: "Error al Guardar en BD",
        description: `No se pudo guardar el examen en la base de datos. ${error.message}`,
        variant: "destructive",
      });
    }
  };
  
  const handleGoHome = () => {
    resetApp();
    router.push('/');
  }

  if (currentStep !== ExamStep.SUCCESS) {
    return null;
  }
  
  const managerName = examData?.manager || 'Gestor';
  const examNE = examData?.ne || 'N/A';
  const whatsappLink = "https://wa.me/+50583956505";

  return (
    <>
      <Dialog open={currentStep === ExamStep.SUCCESS && !isInstructionAlertOpen} onOpenChange={() => { /* Controlled by AppContext */ }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <DialogTitle className="text-xl font-semibold text-foreground">¡Operación Exitosa!</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
             <div className="text-center text-muted-foreground space-y-3">
                <div>El examen previo ha sido registrado correctamente.</div>
                <div>
                  Se notificó a: <br />
                  <span className="font-medium">gerencia@aconic.com</span>,<br />
                  <span className="font-medium">asuntos.juridicos@aconic.com</span>,<br />
                  <span className="font-medium">coordinacion@aconic.com</span>.
                </div>
                {examData?.manager && <div>Gracias por tu desempeño, {examData.manager}.</div>}
                <div>
                  <Link
                    href={`https://aconisani-my.sharepoint.com/:f:/g/personal/asuntos_juridicos_aconic_com_ni/Emrpj4Ss8bhDifpuYc8U_bwBj9r29FGcXxzfxu4PSh2tEQ?e=FhIPTt`}
                    target="_blank"
                    className="text-primary underline hover:text-primary/80"
                  >
                    Añadir imágenes del predio aquí
                  </Link>
                </div>
             </div>
          </DialogDescription>
          <div className="mt-6 flex flex-col space-y-3 items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                onClick={handleSaveToDatabase}
                variant="default"
                className="btn-primary w-full"
                aria-label="Finalizar y Guardar en Base de Datos"
              >
                <Save className="h-5 w-5 mr-2" /> Finalizar y Guardar
              </Button>
              <Button onClick={() => setCurrentStep(ExamStep.PREVIEW)} variant="outline" className="w-full">
                 <RotateCcw className="mr-2 h-4 w-4" /> Revisar Examen
              </Button>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="btn-secondary w-full">
                    <Home className="mr-2 h-4 w-4" /> Volver al Inicio
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Está a punto de volver al inicio. Se borrará toda la información del examen actual que no haya sido guardada en la base de datos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGoHome}>Sí, volver al inicio</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isInstructionAlertOpen} onOpenChange={setIsInstructionAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Instrucción General 021</AlertDialogTitle>
                <AlertDialogDescription>
                    Estimado/a {managerName}, la plataforma ha descargado automáticamente el Excel del Examen Previo <span className="font-bold text-foreground">{examNE}</span>.
                    <br/><br/>
                    Como nuevo requisito de Gerencia, favor enviar el archivo a través de WhatsApp.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsInstructionAlertOpen(false)}>
                    Confirmar
                </AlertDialogAction>
                <Button asChild className="bg-green-500 hover:bg-green-600">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Enviar por WhatsApp
                    </a>
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
