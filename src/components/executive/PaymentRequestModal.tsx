
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp, collection } from 'firebase/firestore';
import type { Worksheet, InitialDataContext } from '@/types';
import { Loader2, StickyNote } from 'lucide-react';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';


const paymentRequestSchema = z.object({
  reference: z.string().optional(),
  recipient: z.string().min(1, "Destinatario es requerido."),
});

type PaymentRequestFormData = z.infer<typeof paymentRequestSchema>;

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: Worksheet | null;
}

export function PaymentRequestModal({ isOpen, onClose, caseData }: PaymentRequestModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setInitialContextData, openPaymentRequestFlow, setIsMemorandumMode } = useAppContext();
  const router = useRouter();

  const form = useForm<PaymentRequestFormData>({
    resolver: zodResolver(paymentRequestSchema),
    defaultValues: { 
      reference: caseData?.worksheet?.reference || '', 
      recipient: 'Contabilidad' 
    },
  });

  const handleRecipientClick = (recipient: string) => {
    form.setValue('recipient', recipient, { shouldValidate: true });
  };

  const onSubmit = async (data: PaymentRequestFormData) => {
    if (!user || !user.email || !user.displayName) {
      toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
      return;
    }

    const ne = caseData?.ne || `SOL-${format(new Date(), 'ddMMyy-HHmmss')}`;

    const initialData: InitialDataContext = {
        ne,
        reference: data.reference,
        manager: user.displayName,
        date: new Date(),
        recipient: data.recipient,
        isMemorandum: data.recipient.toLowerCase() === 'memorandum',
        consignee: caseData?.consignee || '',
        declaracionAduanera: caseData?.declaracionAduanera || '',
        caseId: caseData?.id || ''
    };
    
    setInitialContextData(initialData);
    setIsMemorandumMode(initialData.isMemorandum);
    
    openPaymentRequestFlow(); 
    
    onClose(); 
  };

  if (!isOpen) return null;
  
  const isGeneralRequest = !caseData;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Solicitud de Pago</DialogTitle>
          <DialogDescription>
            {isGeneralRequest 
              ? `Creando una solicitud de pago general.` 
              : `Creando una solicitud para el NE: ${caseData.ne}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A:</FormLabel>
                    <FormControl>
                      <Input placeholder="Destinatario o Departamento" {...field} />
                    </FormControl>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleRecipientClick('Contabilidad')} className="text-xs">Contabilidad</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleRecipientClick('Harol Ampie - Contabilidad')} className="text-xs">Harol Ampie</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleRecipientClick('Jose Daniel Cerros - Contabilidad')} className="text-xs">Jose Daniel Cerros</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => handleRecipientClick('Memorandum')} className="text-xs"><StickyNote className="mr-2 h-4 w-4" />Memorandum</Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (Contenedor, Guía, BL...)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ingrese la referencia" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit">
                    Siguiente
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
