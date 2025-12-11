
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate, ValueDoubtStatus } from '@/types';
import { Loader2 } from 'lucide-react';
import { DatePicker } from '../reports/DatePicker';
import { calculateDueDate } from '@/lib/date-utils';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';

const valueDoubtSchema = z.object({
  valueDoubtNotificationDate: z.date({
    required_error: "La fecha de notificación es requerida.",
  }),
  valueDoubtAmount: z.coerce.number().optional(),
  valueDoubtStatus: z.custom<ValueDoubtStatus>().optional(),
  valueDoubtExtensionRequested: z.boolean().optional(),
  valueDoubtLevanteRequested: z.boolean().optional(),
  valueDoubtAssignedToLegal: z.boolean().optional(),
});

type ValueDoubtFormData = z.infer<typeof valueDoubtSchema>;

interface ValueDoubtModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function ValueDoubtModal({ isOpen, onClose, caseData }: ValueDoubtModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculatedDueDate, setCalculatedDueDate] = useState<Date | null>(null);

  const form = useForm<ValueDoubtFormData>({
    resolver: zodResolver(valueDoubtSchema),
    defaultValues: {
      valueDoubtNotificationDate: caseData.valueDoubtNotificationDate?.toDate(),
      valueDoubtAmount: caseData.valueDoubtAmount ?? undefined,
      valueDoubtStatus: caseData.valueDoubtStatus || undefined,
      valueDoubtExtensionRequested: caseData.valueDoubtExtensionRequested || false,
      valueDoubtLevanteRequested: caseData.valueDoubtLevanteRequested || false,
      valueDoubtAssignedToLegal: caseData.valueDoubtAssignedToLegal || false,
    },
  });

  const watchNotificationDate = form.watch('valueDoubtNotificationDate');
  const watchExtensionRequested = form.watch('valueDoubtExtensionRequested');

  useEffect(() => {
    if (watchNotificationDate) {
      const daysToAdd = watchExtensionRequested ? 30 : 10; // 10 days base + 20 for extension
      const dueDate = calculateDueDate(watchNotificationDate, daysToAdd);
      setCalculatedDueDate(dueDate);
    } else {
      setCalculatedDueDate(null);
    }
  }, [watchNotificationDate, watchExtensionRequested]);
  
  const isInitialSave = !caseData.hasValueDoubt;

  const onSubmit = async (data: ValueDoubtFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const daysToAdd = data.valueDoubtExtensionRequested ? 30 : 10;
        const dueDate = calculateDueDate(data.valueDoubtNotificationDate, daysToAdd);
        if (!dueDate) {
            toast({ title: 'Error', description: 'No se pudo calcular la fecha de vencimiento.', variant: 'destructive' });
            setIsSubmitting(false); return;
        }

        const updatePayload: Partial<AforoCase> = {
            valueDoubtNotificationDate: Timestamp.fromDate(data.valueDoubtNotificationDate),
            valueDoubtAmount: data.valueDoubtAmount || null,
            valueDoubtDueDate: Timestamp.fromDate(dueDate),
            valueDoubtStatus: data.valueDoubtStatus || null,
            valueDoubtExtensionRequested: data.valueDoubtExtensionRequested || false,
            valueDoubtLevanteRequested: data.valueDoubtLevanteRequested || false,
            valueDoubtAssignedToLegal: data.valueDoubtAssignedToLegal || false,
        };
        
        let logComment = '';

        if (isInitialSave) {
            updatePayload.hasValueDoubt = true;
            updatePayload.incidentType = 'Duda de Valor';
            logComment = `Reporte inicial de Duda de Valor con monto ${data.valueDoubtAmount ? `$${data.valueDoubtAmount}`: 'pendiente'}`;
        } else {
            logComment = 'Actualización de estado de Duda de Valor.';
        }

        batch.update(caseDocRef, updatePayload);

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'value_doubt_report',
            oldValue: isInitialSave ? null : { status: caseData.valueDoubtStatus },
            newValue: updatePayload,
            comment: logComment,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
        
        await batch.commit();

        toast({
            title: `Duda de Valor ${isInitialSave ? 'Reportada' : 'Actualizada'}`,
            description: `El caso NE ${caseData.ne} ha sido actualizado.`,
        });
        onClose();

    } catch (error) {
        console.error("Error reporting/updating value doubt:", error);
        toast({ title: 'Error', description: 'No se pudo procesar la solicitud.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duda de Valor</DialogTitle>
          <DialogDescription>
            Gestión del proceso para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="valueDoubtNotificationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Notificación</FormLabel>
                    <FormControl><DatePicker date={field.value} onDateChange={field.onChange} /></FormControl>
                    <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valueDoubtAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto de la Preliquidación por Pagar (USD)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Label>Fecha de Vencimiento (calculada)</Label>
              <Input readOnly value={calculatedDueDate ? calculatedDueDate.toLocaleDateString('es-NI', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Seleccione fecha de notificación'} className="bg-muted/50 cursor-not-allowed"/>
            </div>

            {!isInitialSave && (
              <div className="pt-4 mt-4 border-t space-y-4">
                  <FormField
                    control={form.control}
                    name="valueDoubtStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado del Proceso</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar estado..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Proceso Administrativo">Proceso Administrativo</SelectItem>
                                <SelectItem value="Allanamiento">Allanamiento</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('valueDoubtStatus') === 'Proceso Administrativo' && (
                    <FormField
                      control={form.control}
                      name="valueDoubtExtensionRequested"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>¿Se solicitó ampliación de plazo?</FormLabel></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                      control={form.control}
                      name="valueDoubtLevanteRequested"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>¿Se solicitó levante?</FormLabel></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                      )}
                    />
                  <FormField
                      control={form.control}
                      name="valueDoubtAssignedToLegal"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>¿Caso asignado a Legal?</FormLabel></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                      )}
                    />
              </div>
            )}
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {isInitialSave ? 'Guardar Reporte' : 'Actualizar Proceso'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
