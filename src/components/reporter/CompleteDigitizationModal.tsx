

"use client";

import { useState } from 'react';
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
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate, DigitacionStatus } from '@/types';
import { Loader2, Save } from 'lucide-react';

const completeSchema = z.object({
  declaracionAduanera: z.string().min(1, 'El número de declaración es requerido.'),
});

type CompleteFormData = z.infer<typeof completeSchema>;

interface CompleteDigitizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function CompleteDigitizationModal({ isOpen, onClose, caseData }: CompleteDigitizationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CompleteFormData>({
    resolver: zodResolver(completeSchema),
    defaultValues: { declaracionAduanera: caseData.declaracionAduanera || '' },
  });

  const canEdit = user?.role === 'digitador' || user?.role === 'admin' || user?.role === 'coordinadora' || user?.roleTitle === 'supervisor';

  const onSubmit = async (data: CompleteFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }

    if (!canEdit) {
        toast({ title: 'Permiso Denegado', description: 'No tiene permisos para completar este trámite.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const newStatus: DigitacionStatus = 'Trámite Completo';

    try {
        await updateDoc(caseDocRef, {
            declaracionAduanera: data.declaracionAduanera,
            digitacionStatus: newStatus,
            digitacionStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'digitacionStatus',
            oldValue: caseData.digitacionStatus || 'Almacenado',
            newValue: newStatus,
            comment: `Trámite completado con declaración No. ${data.declaracionAduanera}`
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        toast({
            title: `Trámite Completo`,
            description: `El caso NE ${caseData.ne} ha sido marcado como completado.`,
        });
        onClose();

    } catch (error) {
        console.error("Error completing digitization:", error);
        toast({ title: 'Error', description: 'No se pudo completar el trámite.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completar Trámite de Digitación</DialogTitle>
          <DialogDescription>
            Ingrese el número de declaración aduanera para finalizar el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="declaracionAduanera"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Declaración Aduanera</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!canEdit || isSubmitting}
                      placeholder="Ingrese el número..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                {canEdit && (
                    <Button type="submit" variant="destructive" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Guardar y Completar
                    </Button>
                )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
