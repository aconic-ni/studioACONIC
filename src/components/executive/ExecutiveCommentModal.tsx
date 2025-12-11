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
import { doc, updateDoc, arrayUnion, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate, ExecutiveComment } from '@/types';
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea } from '../ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const commentSchema = z.object({
  comment: z.string().min(1, 'El comentario no puede estar vacío.'),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface ExecutiveCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

const formatDate = (timestamp: Timestamp) => {
    return format(timestamp.toDate(), 'dd/MM/yy hh:mm a', { locale: es });
}


export function ExecutiveCommentModal({ isOpen, onClose, caseData }: ExecutiveCommentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState<ExecutiveComment[]>([]);

  useEffect(() => {
    if (isOpen && caseData.executiveComments) {
      // Sort comments with newest first for display
      setComments([...caseData.executiveComments].reverse());
    }
  }, [isOpen, caseData.executiveComments]);

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { comment: '' },
  });
  
  const canComment = user?.role === 'ejecutivo' || user?.role === 'coordinadora' || user?.role === 'admin';


  const onSubmit = async (data: CommentFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }

    if (!canComment) {
        toast({ title: 'Permiso Denegado', description: 'No tiene permisos para añadir un comentario.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    const newComment: ExecutiveComment = {
        id: uuidv4(),
        author: user.displayName,
        text: data.comment,
        createdAt: Timestamp.now(),
    };

    try {
        // Optimistic UI update
        setComments(prev => [newComment, ...prev]);

        // Firestore update
        batch.update(caseDocRef, {
            executiveComments: arrayUnion(newComment)
        });

        // Add a log entry to the audit trail
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'executiveComments',
            oldValue: 'N/A',
            newValue: data.comment,
            comment: `Comentario ejecutivo añadido: "${data.comment}"`
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
        
        await batch.commit();

        toast({
            title: `Comentario Añadido`,
            description: `Se ha guardado un nuevo comentario en el caso NE ${caseData.ne}.`,
        });
        form.reset();

    } catch (error) {
        console.error("Error adding executive comment:", error);
        // Revert optimistic update on error
        setComments(prev => prev.filter(c => c.id !== newComment.id));
        toast({ title: 'Error', description: 'No se pudo guardar el comentario.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comentarios del Caso</DialogTitle>
          <DialogDescription>
            Historial de comentarios y notas para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[40vh] my-4">
            <div className="space-y-4 pr-6">
            {comments.length > 0 ? (
                comments.map((comment: ExecutiveComment) => (
                    <div key={comment.id} className="p-3 border rounded-lg bg-secondary/50">
                        <p className="text-sm text-foreground">{comment.text}</p>
                        <div className="text-xs text-muted-foreground mt-2 text-right">
                            <span>- {comment.author}</span>
                            <span className="ml-2">({formatDate(comment.createdAt)})</span>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                    No hay comentarios para este caso.
                </p>
            )}
            </div>
        </ScrollArea>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t">
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuevo Comentario</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      disabled={!canComment || isSubmitting}
                      placeholder={canComment ? 'Escriba su comentario aquí...' : 'No tiene permisos para comentar.'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
                {canComment && (
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Guardar Comentario
                    </Button>
                )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
