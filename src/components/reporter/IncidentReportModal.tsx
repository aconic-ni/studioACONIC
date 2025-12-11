"use client";
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate } from '@/types';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

const incidentSchema = z.object({
  declaracionAduanera: z.string().optional(),
  reciboDeCajaPagoInicial: z.string().optional(),
  pagoInicialRealizado: z.boolean().default(false),
  montoPagoInicial: z.coerce.number().optional(),
  noLiquidacion: z.string().optional(),
  motivoRectificacion: z.string().min(1, 'El motivo es requerido.'),
  observaciones: z.string().optional(),
}).refine(data => !data.pagoInicialRealizado || (data.pagoInicialRealizado && data.reciboDeCajaPagoInicial && data.reciboDeCajaPagoInicial.trim() !== ''), {
  message: "El recibo de caja es requerido si el pago inicial fue realizado.",
  path: ["reciboDeCajaPagoInicial"],
}).refine(data => !data.pagoInicialRealizado || (data.pagoInicialRealizado && data.montoPagoInicial !== undefined && data.montoPagoInicial > 0), {
    message: "El monto debe ser mayor que cero si el pago inicial fue realizado.",
    path: ["montoPagoInicial"],
});


type IncidentFormData = z.infer<typeof incidentSchema>;

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function IncidentReportModal({ isOpen, onClose, caseData }: IncidentReportModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
        declaracionAduanera: caseData.declaracionAduanera || '',
        reciboDeCajaPagoInicial: caseData.reciboDeCajaPagoInicial || '',
        pagoInicialRealizado: caseData.pagoInicialRealizado || false,
        montoPagoInicial: caseData.montoPagoInicial ?? 0,
        noLiquidacion: caseData.noLiquidacion || '',
        motivoRectificacion: caseData.motivoRectificacion || '',
        observaciones: caseData.observaciones || '',
    },
  });

  useEffect(() => {
    form.reset({
        declaracionAduanera: caseData.declaracionAduanera || '',
        reciboDeCajaPagoInicial: caseData.reciboDeCajaPagoInicial || '',
        pagoInicialRealizado: caseData.pagoInicialRealizado || false,
        montoPagoInicial: caseData.montoPagoInicial ?? 0,
        noLiquidacion: caseData.noLiquidacion || '',
        motivoRectificacion: caseData.motivoRectificacion || '',
        observaciones: caseData.observaciones || '',
    });
  }, [caseData, form]);

  const watchPagoInicial = form.watch('pagoInicialRealizado');


  const onSubmit = async (data: IncidentFormData) => {
    if (!user || !user.displayName) {
      toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    try {
      // Consolidate all updates into one object
      const updatePayload: Partial<AforoCase> = {
        ...data,
        incidentType: 'Rectificacion', // Set the incident type explicitly
        incidentReported: true,
        incidentReason: data.motivoRectificacion, // Main reason for the incident
        incidentStatus: 'Pendiente' as const,
        incidentReportedBy: user.displayName,
        incidentReportedAt: Timestamp.now(),
      };
      
      await updateDoc(caseDocRef, updatePayload);

      const updateLog: AforoCaseUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.displayName,
        field: 'incident_report',
        oldValue: caseData.incidentReason || null,
        newValue: 'reported',
        comment: `Incidencia reportada: ${data.motivoRectificacion}`,
      };
      await addDoc(updatesSubcollectionRef, updateLog);

      toast({
        title: 'Incidencia Reportada',
        description: 'La solicitud ha sido enviada al agente aduanero para su revisión.',
      });
      onClose();

    } catch (error) {
      console.error("Error reporting incident:", error);
      toast({ title: 'Error', description: 'No se pudo reportar la incidencia.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reportar Incidencia / Solicitud de Rectificación</DialogTitle>
          <DialogDescription>
            Complete la información para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="declaracionAduanera" render={({ field }) => (
                <FormItem><FormLabel>Declaración Aduanera</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="noLiquidacion" render={({ field }) => (
                <FormItem><FormLabel>No. de Liquidación</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="pagoInicialRealizado" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm col-span-1 md:col-span-2">
                    <div className="space-y-0.5"><FormLabel>¿Pago Inicial Realizado?</FormLabel></div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )}/>
              {watchPagoInicial && (
                <>
                    <FormField control={form.control} name="reciboDeCajaPagoInicial" render={({ field }) => (
                        <FormItem><FormLabel>Recibo de Caja Pago Inicial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="montoPagoInicial" render={({ field }) => (
                        <FormItem><FormLabel>Monto Pagado (USD)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </>
              )}
               <div className="col-span-1 md:col-span-2">
                <FormField control={form.control} name="motivoRectificacion" render={({ field }) => (
                    <FormItem><FormLabel>Motivo de la Rectificación</FormLabel><FormControl><Textarea {...field} rows={4}/></FormControl><FormMessage /></FormItem>
                )}/>
               </div>
               <div className="col-span-1 md:col-span-2">
                <FormField control={form.control} name="observaciones" render={({ field }) => (
                    <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} rows={3}/></FormControl><FormMessage /></FormItem>
                )}/>
               </div>
               <div className="col-span-1 md:col-span-2">
                 <FormItem>
                    <FormLabel>Observaciones Contabilidad (No editable)</FormLabel>
                    <FormControl>
                        <Textarea value={caseData.observacionesContabilidad || ''} readOnly rows={3} className="bg-muted/50 cursor-not-allowed"/>
                    </FormControl>
                 </FormItem>
               </div>
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar a Revisión
              </Button>
            </DialogFooter>
          </form>
        </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
