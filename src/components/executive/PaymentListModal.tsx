
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp, where } from 'firebase/firestore';
import type { AforoCase, SolicitudRecord, InitialDataContext } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Loader2, Package, Eye, ArrowLeft, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SolicitudDetailView from '@/components/shared/SolicitudDetailView';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

interface PaymentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

const getPaymentStatusBadge = (solicitud: SolicitudRecord) => {
    if (solicitud.paymentStatus === 'Pagado') {
        return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Pagado
            </Badge>
        );
    }
    if (solicitud.paymentStatus?.startsWith('Error:')) {
        return (
            <Badge variant="destructive">
                <AlertCircle className="mr-2 h-4 w-4" /> Error
            </Badge>
        );
    }
    return <Badge variant="outline">Pendiente</Badge>;
}

export function PaymentListModal({ isOpen, onClose, caseData }: PaymentListModalProps) {
  const [payments, setPayments] = useState<SolicitudRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<SolicitudRecord | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    setIsLoading(true);
    setPayments([]); // Reset payments on open

    const collectionsToQuery = ["SolicitudCheques", "Memorandum"];
    const unsubscribers = collectionsToQuery.map(collectionName => {
        const q = query(
            collection(db, collectionName), 
            where("examNe", "==", caseData.ne),
            orderBy('savedAt', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const fetchedPayments = snapshot.docs.map(doc => {
                const data = doc.data();
                const examDate = data.examDate instanceof Timestamp ? data.examDate.toDate() : undefined;
                const savedAt = data.savedAt instanceof Timestamp ? data.savedAt.toDate() : undefined;
                return { ...data, solicitudId: doc.id, examDate, savedAt } as SolicitudRecord;
            });

            setPayments(prev => {
                const existingIds = new Set(prev.map(p => p.solicitudId));
                const newPayments = fetchedPayments.filter(p => !existingIds.has(p.solicitudId));
                const combined = [...prev, ...newPayments];
                combined.sort((a,b) => (b.savedAt?.getTime() || 0) - (a.savedAt?.getTime() || 0));
                return combined;
            });
            setIsLoading(false);
        }, (error) => {
            console.error(`Error fetching payments from ${collectionName}:`, error);
            setIsLoading(false);
        });
    });

    return () => unsubscribers.forEach(unsub => unsub());

  }, [isOpen, caseData.ne]);
  
  const handleCloseDetailView = () => setSelectedPayment(null);

  if (!isOpen) return null;

  if (selectedPayment) {
    // Construct the initialData prop needed by SolicitudDetailView
    const initialDataForDetail: InitialDataContext = {
        ne: selectedPayment.examNe,
        reference: selectedPayment.examReference || undefined,
        manager: selectedPayment.examManager,
        date: selectedPayment.examDate || new Date(),
        recipient: selectedPayment.examRecipient,
        isMemorandum: selectedPayment.isMemorandum,
    };

    return (
        <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && handleCloseDetailView()}>
            <DialogContent className="max-w-4xl p-0 h-[90vh] flex flex-col">
                <ScrollArea className="flex-grow">
                    <div className="p-6">
                        <SolicitudDetailView 
                            solicitud={selectedPayment}
                            initialData={initialDataForDetail}
                            onBackToList={handleCloseDetailView}
                        >
                             <DialogClose asChild>
                                <Button variant="ghost" size="icon" className="absolute top-4 right-4">
                                    <X className="h-4 w-4" />
                                </Button>
                            </DialogClose>
                        </SolicitudDetailView>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solicitudes de Pago para el Caso</DialogTitle>
          <DialogDescription>
            Visualizando pagos para el NE: {caseData.ne}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : payments.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">No se encontraron solicitudes de pago para este caso.</div>
          ) : (
            <div className="space-y-3">
              {payments.map(payment => (
                <div key={payment.solicitudId} className="flex justify-between items-center p-3 border rounded-md hover:bg-muted/50">
                  <div>
                    <p className="font-semibold">{payment.solicitudId}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.examDate ? format(payment.examDate, "PPP", { locale: es }) : 'Fecha no disponible'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {getPaymentStatusBadge(payment)}
                    <Button variant="outline" size="sm" onClick={() => setSelectedPayment(payment)}>
                        <Eye className="mr-2 h-4 w-4" /> Ver Detalle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
