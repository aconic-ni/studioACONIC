
"use client";

import { useState } from 'react';
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
import { doc, updateDoc, addDoc, collection, Timestamp, writeBatch } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate } from '@/types';
import { Loader2 } from 'lucide-react';

const commentSchema = z.object({
  comment: z.string().min(1, 'El comentario no puede estar vacío.'),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface AforadorCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function AforadorCommentModal({ isOpen, onClose, caseData }: AforadorCommentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { comment: caseData.aforadorComment || '' },
  });

  const canEdit = user?.role === 'aforador' || user?.role === 'admin' || user?.role === 'coordinadora' || user?.role === 'supervisor';

  const onSubmit = async (data: CommentFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }

    if (!canEdit) {
        toast({ title: 'Permiso Denegado', description: 'No tiene permisos para añadir un comentario.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        batch.update(caseDocRef, {
            aforadorComment: data.comment,
            aforadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'aforadorComment',
            oldValue: caseData.aforadorComment || '',
            newValue: data.comment,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
        
        await batch.commit();

        toast({
            title: `Observación Guardada`,
            description: `La observación ha sido guardada en la bitácora del caso.`,
        });
        onClose();

    } catch (error) {
        console.error("Error updating aforador comment:", error);
        toast({ title: 'Error', description: 'No se pudo guardar la observación.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Observación del Aforador</DialogTitle>
          <DialogDescription>
            Añada o edite una observación para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>. Esta observación se usará si el estado es "Incompleto".
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                      placeholder={canEdit ? 'Añada la observación aquí...' : 'Sin observación.'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                {canEdit && (
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Guardar Observación
                    </Button>
                )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
