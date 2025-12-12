
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
import { doc, updateDoc, writeBatch, collection, Timestamp, getDoc } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate, Worksheet } from '@/types';
import { Loader2, Bell } from 'lucide-react';
import { DatePicker } from '../reports/DatePicker';
import { calculateDueDate } from '@/lib/date-utils';
import { Label } from '../ui/label';

const resaSchema = z.object({
  resaNumber: z.string().min(1, 'El número de RESA es requerido.'),
  resaNotificationDate: z.date({
    required_error: "La fecha de notificación es requerida.",
  }),
});

type ResaFormData = z.infer<typeof resaSchema>;

interface ResaNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function ResaNotificationModal({ isOpen, onClose, caseData }: ResaNotificationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculatedDueDate, setCalculatedDueDate] = useState<Date | null>(null);

  const form = useForm<ResaFormData>({
    resolver: zodResolver(resaSchema),
    defaultValues: {
      resaNumber: '',
      resaNotificationDate: undefined,
    },
  });

  useEffect(() => {
    const fetchAndSetData = async () => {
      let wsData: Worksheet | null = null;
      if (caseData.worksheetId) {
        const wsSnap = await getDoc(doc(db, 'worksheets', caseData.worksheetId));
        if (wsSnap.exists()) {
          wsData = wsSnap.data() as Worksheet;
        }
      }

      // Prioritize AforoCase data, then Worksheet data, then default.
      form.reset({
        resaNumber: caseData.resaNumber || wsData?.resa || '',
        resaNotificationDate: caseData.resaNotificationDate?.toDate() || wsData?.resaNotificationDate?.toDate() || undefined,
      });
    };

    if (isOpen) {
      fetchAndSetData();
    }
  }, [isOpen, caseData, form]);

  const watchNotificationDate = form.watch('resaNotificationDate');

  useEffect(() => {
    if (watchNotificationDate) {
      const daysToAdd = 20; // Default RESA duration
      const dueDate = calculateDueDate(watchNotificationDate, daysToAdd);
      setCalculatedDueDate(dueDate);
    } else {
      setCalculatedDueDate(null);
    }
  }, [watchNotificationDate]);
  

  const onSubmit = async (data: ResaFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }

    if (!calculatedDueDate) {
        toast({ title: 'Error', description: 'No se pudo calcular la fecha de vencimiento.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const updatePayload: Partial<AforoCase> = {
            resaNumber: data.resaNumber,
            resaNotificationDate: Timestamp.fromDate(data.resaNotificationDate),
            resaDueDate: Timestamp.fromDate(calculatedDueDate),
        };
        
        // Also update the worksheet if it exists
        if (caseData.worksheetId) {
            const worksheetDocRef = doc(db, 'worksheets', caseData.worksheetId);
            batch.update(worksheetDocRef, updatePayload);
        }

        batch.update(caseDocRef, updatePayload);

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'resa_notification',
            oldValue: { number: caseData.resaNumber || null, date: caseData.resaNotificationDate || null },
            newValue: { number: data.resaNumber, date: data.resaNotificationDate },
            comment: `RESA ${data.resaNumber} notificada. Vence el ${calculatedDueDate.toLocaleDateString()}.`
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
        
        await batch.commit();

        toast({
            title: `RESA Notificada`,
            description: `El caso NE ${caseData.ne} ha sido actualizado con la información de la RESA.`,
        });
        onClose();

    } catch (error) {
        console.error("Error updating RESA notification:", error);
        toast({ title: 'Error', description: 'No se pudo procesar la notificación.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notificar RESA</DialogTitle>
          <DialogDescription>
            Ingrese los detalles de la RESA para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="resaNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de RESA</FormLabel>
                  <FormControl><Input {...field} placeholder="Ingrese el número..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="resaNotificationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Notificación</FormLabel>
                    <FormControl><DatePicker date={field.value} onDateChange={field.onChange} /></FormControl>
                    <FormMessage />
                </FormItem>
              )}
            />
             <div>
              <Label>Fecha de Vencimiento (calculada)</Label>
              <Input readOnly value={calculatedDueDate ? calculatedDueDate.toLocaleDateString('es-NI', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Seleccione fecha de notificación'} className="bg-muted/50 cursor-not-allowed"/>
            </div>
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Guardar Notificación
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
