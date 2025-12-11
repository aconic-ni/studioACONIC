
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseStatus, AforoCaseUpdate } from '@/types';
import { Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';

const observationSchema = z.object({
  comment: z.string().min(1, 'La observación es requerida para rechazar.'),
});

type ObservationFormData = z.infer<typeof observationSchema>;

interface ObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function ObservationModal({ isOpen, onClose, caseData }: ObservationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ObservationFormData>({
    resolver: zodResolver(observationSchema),
    defaultValues: { comment: '' },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        comment: caseData.observacionRevisor || ''
      });
    }
  }, [isOpen, caseData, form]);

  const canEdit = user?.roleTitle === 'agente aduanero' || user?.role === 'admin' || user?.role === 'supervisor';


  const handleStatusUpdate = async (newStatus: AforoCaseStatus, comment: string = '') => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }
    
    if (newStatus === 'Rechazado' && !comment.trim()) {
        form.setError('comment', { message: 'La observación es requerida para rechazar.' });
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    try {
        await updateDoc(caseDocRef, {
            revisorStatus: newStatus,
            observacionRevisor: comment,
            revisorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'status_change',
            oldValue: caseData.revisorStatus || 'Pendiente',
            newValue: newStatus,
            comment: comment,
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        toast({
            title: `Caso ${newStatus}`,
            description: `El estado del caso ha sido actualizado.`,
        });
        onClose();
    } catch (error) {
        console.error("Error updating case status:", error);
        toast({ title: 'Error', description: 'No se pudo actualizar el estado del caso.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleApprove = () => {
    const comment = form.getValues('comment');
    handleStatusUpdate('Aprobado', comment);
  };
  
  const handleReject = () => {
    const comment = form.getValues('comment');
    handleStatusUpdate('Rechazado', comment);
  };
  

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Observaciones del Revisor</DialogTitle>
          <DialogDescription>
            Revisión para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 py-4">
             <div className="space-y-2">
                 <p className="text-sm font-medium">Estado Actual</p>
                 <Badge variant={caseData.revisorStatus === 'Rechazado' ? 'destructive' : 'secondary'}>
                    {caseData.revisorStatus || 'Pendiente'}
                 </Badge>
             </div>

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observación</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      disabled={!canEdit || isSubmitting}
                      placeholder={canEdit ? 'Añada sus observaciones aquí...' : 'Sin observaciones.'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {canEdit ? (
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                 <Button type="button" variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Rechazar
                </Button>
                <Button type="button" variant="default" onClick={handleApprove} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Aprobar
                </Button>
              </DialogFooter>
            ) : (
                 <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
