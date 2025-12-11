
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, InitialDataContext } from '@/types';
import { StickyNote } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';


const paymentRequestSchema = z.object({
  ne: z.string().optional(),
  reference: z.string().optional(),
  recipient: z.string().min(1, "Destinatario es requerido."),
});

type PaymentRequestFormData = z.infer<typeof paymentRequestSchema>;

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase | null;
}

export function PaymentRequestModal({ isOpen, onClose, caseData }: PaymentRequestModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setInitialContextData, openAddProductModal, setIsMemorandumMode, initialContextData: appInitialData } = useAppContext();
  const router = useRouter();

  const form = useForm<PaymentRequestFormData>({
    resolver: zodResolver(paymentRequestSchema),
    defaultValues: { 
      ne: caseData?.ne || appInitialData?.ne || '',
      reference: '', 
      recipient: 'Contabilidad' 
    },
  });

  const handleRecipientClick = (recipient: string) => {
    form.setValue('recipient', recipient, { shouldValidate: true });
    setIsMemorandumMode(recipient.toLowerCase() === 'memorandum');
  };

  const onSubmit = async (data: PaymentRequestFormData) => {
    if (!user || !user.email || !user.displayName) {
      toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
      return;
    }

    const initialData: InitialDataContext = {
        ne: data.ne || `SOL-${format(new Date(), 'ddMMyy-HHmmss')}`,
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
    
    router.push('/examinerPay');
    onClose();
    
    // Open the AddProductModal after a short delay to allow navigation and context update
    setTimeout(() => {
        openAddProductModal();
    }, 100);
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
                name="ne"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Entrada (NE)</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isGeneralRequest} placeholder={isGeneralRequest ? 'ID único autogenerado' : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
