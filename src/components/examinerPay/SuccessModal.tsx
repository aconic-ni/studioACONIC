"use client";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { CheckCircle, FilePlus, RotateCcw, Save, Mail, Database, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp as FirestoreTimestamp } from "firebase/firestore";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { SolicitudRecord } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

export function SuccessModal() {
  const { currentStep, setCurrentStep, resetApp, initialContextData, solicitudes, isMemorandumMode } = useAppContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSaveToDatabase = async () => {
    if (!initialContextData || !user || !user.email || !solicitudes || solicitudes.length === 0) {
      toast({
        title: "Error al guardar",
        description: "Faltan datos iniciales, información del usuario o no hay solicitudes para guardar.",
        variant: "destructive",
      });
      return;
    }

    if (!initialContextData.ne) {
      toast({
        title: "Error al guardar",
        description: "El número NE es requerido para guardar.",
        variant: "destructive",
      });
      return;
    }
    if (!(initialContextData.date instanceof Date) || isNaN(initialContextData.date.getTime())) {
        toast({
            title: "Error en Fecha de Solicitud",
            description: "La fecha de la solicitud no es válida.",
            variant: "destructive",
        });
        return;
    }

    let allSavedSuccessfully = true;
    const targetCollection = isMemorandumMode ? "Memorandum" : "SolicitudCheques";

    try {
      for (const solicitud of solicitudes) {
        if (!solicitud.id) {
          console.error("Solicitud sin ID encontrada, omitiendo:", solicitud);
          allSavedSuccessfully = false;
          continue;
        }

        const montoAsNumber = typeof solicitud.monto === 'number' ? solicitud.monto : null;
        if (solicitud.monto !== undefined && montoAsNumber === null) {
            console.warn(`Monto for solicitud ${solicitud.id} was not a valid number, saving as null.`);
        }

        const dataToSave: Omit<SolicitudRecord, 'examDate' | 'savedAt' | 'paymentStatusLastUpdatedAt' | 'recepcionDCLastUpdatedAt' | 'emailMinutaLastUpdatedAt' | 'rhStatusLastUpdatedAt' | 'rhPaymentDate' | 'rhPaymentStartDate' | 'rhPaymentEndDate' > & { examDate: FirestoreTimestamp, savedAt: FirestoreTimestamp, paymentStatusLastUpdatedAt?: FirestoreTimestamp | null, recepcionDCLastUpdatedAt?: FirestoreTimestamp | null, emailMinutaLastUpdatedAt?: FirestoreTimestamp | null, rhStatusLastUpdatedAt?: FirestoreTimestamp | null, rhPaymentDate?: FirestoreTimestamp | null, rhPaymentStartDate?: FirestoreTimestamp | null, rhPaymentEndDate?: FirestoreTimestamp | null } = {
          examNe: initialContextData.ne,
          examReference: initialContextData.reference || null,
          examManager: initialContextData.manager,
          examDate: FirestoreTimestamp.fromDate(initialContextData.date),
          examRecipient: initialContextData.recipient,

          solicitudId: solicitud.id,
          monto: montoAsNumber,
          montoMoneda: solicitud.montoMoneda || null,
          cantidadEnLetras: solicitud.cantidadEnLetras || null,
          consignatario: solicitud.consignatario || null,
          declaracionNumero: solicitud.declaracionNumero || null,
          unidadRecaudadora: solicitud.unidadRecaudadora || null,
          codigo1: solicitud.codigo1 || null,
          codigo2: solicitud.codigo2 || null,
          banco: solicitud.banco || null,
          bancoOtros: solicitud.bancoOtros || null,
          numeroCuenta: solicitud.numeroCuenta || null,
          monedaCuenta: solicitud.monedaCuenta || null,
          monedaCuentaOtros: solicitud.monedaCuentaOtros || null,
          elaborarChequeA: solicitud.elaborarChequeA || null,
          elaborarTransferenciaA: solicitud.elaborarTransferenciaA || null,

          impuestosPagadosCliente: solicitud.impuestosPagadosCliente ?? false,
          impuestosPagadosRC: solicitud.impuestosPagadosRC || null,
          impuestosPagadosTB: solicitud.impuestosPagadosTB || null,
          impuestosPagadosCheque: solicitud.impuestosPagadosCheque || null,
          impuestosPendientesCliente: solicitud.impuestosPendientesCliente ?? false,
          soporte: solicitud.soporte ?? false,
          documentosAdjuntos: solicitud.documentosAdjuntos ?? false,
          constanciasNoRetencion: solicitud.constanciasNoRetencion ?? false,
          constanciasNoRetencion1: solicitud.constanciasNoRetencion1 ?? false,
          constanciasNoRetencion2: solicitud.constanciasNoRetencion2 ?? false,

          pagoServicios: solicitud.pagoServicios ?? false,
          tipoServicio: solicitud.tipoServicio || null,
          otrosTipoServicio: solicitud.otrosTipoServicio || null,
          facturaServicio: solicitud.facturaServicio || null,
          institucionServicio: solicitud.institucionServicio || null,

          correo: solicitud.correo || null,
          observation: solicitud.observation || null,

          isMemorandum: isMemorandumMode,
          memorandumCollaborators: solicitud.memorandumCollaborators || [],

          savedAt: FirestoreTimestamp.fromDate(new Date()),
          savedBy: user.email,

          paymentStatus: null,
          paymentStatusLastUpdatedBy: null,
          paymentStatusLastUpdatedAt: null,

          recepcionDCStatus: false,
          recepcionDCLastUpdatedBy: null,
          recepcionDCLastUpdatedAt: null,

          emailMinutaStatus: false,
          emailMinutaLastUpdatedBy: null,
          emailMinutaLastUpdatedAt: null,

          rhPaymentStatus: 'caso_no_iniciado',
          rhPaymentOtherDetails: null,
          rhPaymentDate: null,
          rhPaymentStartDate: null,
          rhPaymentEndDate: null,
          rhStatusLastUpdatedAt: null,
          rhStatusLastUpdatedBy: null,

          commentsCount: 0,
        };

        const solicitudDocRef = doc(db, targetCollection, solicitud.id);
        await setDoc(solicitudDocRef, dataToSave);
      }

      if (allSavedSuccessfully) {
        toast({
          title: "Solicitudes Guardadas",
          description: `Todas las solicitudes (${solicitudes.length}) han sido guardadas en la colección: ${targetCollection}.`,
        });
      } else {
        toast({
          title: "Guardado Parcial",
          description: "Algunas solicitudes no pudieron ser guardadas (ej. faltaba ID). Revise la consola.",
          variant: "default"
        });
      }

    } catch (error: any) {
      console.error(`Error saving solicituds to Firestore collection ${targetCollection}: `, error);
      allSavedSuccessfully = false;
      toast({
        title: "Error al Guardar",
        description: `No se pudieron guardar una o más solicitudes. Error: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const enviarCorreo = () => {
    if (!initialContextData || !solicitudes || solicitudes.length === 0) {
      toast({
        title: "Error",
        description: "No hay datos de solicitud para enviar por correo.",
        variant: "destructive",
      });
      return;
    }

    const destinatario = "grupocontabilidad@aconic.com.ni, harol.ampie@aconic.com.ni, seguimiento@aconic.com.ni";
    const asunto = `${isMemorandumMode ? 'Memorandum' : 'Solicitud de Cheque'} - NE: ${initialContextData.ne || 'N/A'}`;

    const fechaSolicitud = initialContextData.date ? format(new Date(initialContextData.date), "PPP", { locale: es }) : 'Fecha no especificada';
    const userName = initialContextData.manager || 'Usuario no especificado';
    const solicitudIDs = solicitudes.map(s => s.id).join(', ') || 'ninguna solicitud';
    const ne = initialContextData.ne || 'N/A';
    const referencia = initialContextData.reference || 'N/A';

    let cuerpo = `Buen día Contabilidad;\n${fechaSolicitud}\n\n`;
    cuerpo += `Por este medio, yo ${userName}, he generado ID de ${isMemorandumMode ? 'Memorandum' : 'Solicitud'} No. (${solicitudIDs}) debidamente guardadas en CustomsFA-L, Sistema de Gestión de Pagos de ACONIC, solicito su apoyo validando la operación en su integración de sistema local, se entrega ${isMemorandumMode ? 'Memorandum' : 'Solicitud de Cheque'} física firmada.\n\n`;
    cuerpo += `NE: ${ne}\n`;
    cuerpo += `Referencia: ${referencia}\n\n`;
    cuerpo += `Sin más a que hacer referencia.\n\n`;
    cuerpo += `Atentamente,`;

    const mailtoLink = `mailto:${destinatario}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = mailtoLink;
  };

  const handleGoToDatabase = () => {
    if (user && user.hasPaymentAccess) {
      router.push('/databasePay');
    } else {
      toast({
        title: "Acceso Denegado",
        description: "Usuario no autorizado para acceder a la base de datos.",
        variant: "destructive",
      });
    }
  };

  if (currentStep !== ExamStep.SUCCESS) {
    return null;
  }

  return (
    <Dialog
        open={currentStep === ExamStep.SUCCESS}
        onOpenChange={(open) => {
            if (!open) {
                setCurrentStep(ExamStep.PREVIEW);
            }
        }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center relative">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <DialogTitle className="text-xl font-semibold text-foreground">¡Operación Exitosa!</DialogTitle>
           <DialogClose
            asChild
            className="absolute right-0 top-0 p-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            aria-label="Cerrar"
          >
            <Button variant="ghost" size="icon" className="h-auto w-auto p-0">
             <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogDescription asChild>
           <div className="text-center text-muted-foreground space-y-3">
              <div>La solicitud de cheque ha sido registrada correctamente. Guardar es la prioridad, dar click a diskette rojo.</div>
              {initialContextData?.manager && <div>Gracias por tu desempeño, {initialContextData.manager}.</div>}
           </div>
        </DialogDescription>

        <div className="mt-6 flex flex-col space-y-3 items-center">
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:gap-3 sm:justify-center items-center w-full">
            <Button
              onClick={handleSaveToDatabase}
              variant="destructive"
              size="icon"
              aria-label="Guardar en Base de Datos"
            >
              <Save className="h-5 w-5 text-destructive-foreground" />
            </Button>
            <Button onClick={() => setCurrentStep(ExamStep.PREVIEW)} variant="outline" size="default" className="w-full sm:w-auto">
               <RotateCcw className="mr-2 h-4 w-4" /> Revisar Solicitud
            </Button>
            <Button onClick={() => resetApp()} className="btn-primary w-full sm:w-auto" size="default">
              <FilePlus className="mr-2 h-4 w-4" /> Empezar Nuevo
            </Button>
          </div>
          <Button
            onClick={enviarCorreo}
            variant="default"
            size="default"
            className="w-full btn-secondary mt-3"
          >
            <Mail className="mr-2 h-4 w-4" /> Enviar Correo
          </Button>
          <Button
            onClick={handleGoToDatabase}
            variant="default"
            size="default"
            className="w-full bg-purple-600 text-white hover:bg-purple-700"
          >
            <Database className="mr-2 h-4 w-4" /> Ir a base de datos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
