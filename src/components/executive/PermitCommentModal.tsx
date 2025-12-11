
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
import { doc, updateDoc, getDoc, arrayUnion, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { RequiredPermit, PermitComment, AforoCaseUpdate, Worksheet } from '@/types';
import { Loader2, Send } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea } from '../ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const commentSchema = z.object({
  text: z.string().min(1, 'El comentario no puede estar vacío.'),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface PermitCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  permit: RequiredPermit;
  worksheetId: string;
  onCommentsUpdate: (newComments: PermitComment[]) => void;
}

const formatDate = (timestamp: Timestamp) => {
    return format(timestamp.toDate(), 'dd/MM/yy hh:mm a', { locale: es });
}

export function PermitCommentModal({ isOpen, onClose, permit, worksheetId, onCommentsUpdate }: PermitCommentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState<PermitComment[]>([]);

  useEffect(() => {
    if (isOpen && permit.comments) {
      setComments([...permit.comments].reverse());
    } else {
      setComments([]);
    }
  }, [isOpen, permit.comments]);

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: '' },
  });
  
  const canComment = user?.role === 'ejecutivo' || user?.role === 'coordinadora' || user?.role === 'admin';

  const onSubmit = async (data: CommentFormData) => {
    if (!user || !user.displayName || !canComment) {
        toast({ title: 'Acción no permitida', description: 'No tiene permisos para añadir comentarios.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    
    const newComment: PermitComment = {
        id: uuidv4(),
        author: user.displayName,
        text: data.text,
        createdAt: Timestamp.now(),
    };

    const newCommentsArray = [...(permit.comments || []), newComment];
    
    const worksheetRef = doc(db, 'worksheets', worksheetId);
    
    try {
        const worksheetSnap = await getDoc(worksheetRef);
        if (!worksheetSnap.exists()) throw new Error("Worksheet not found");

        const worksheetData = worksheetSnap.data() as Worksheet;
        const updatedPermits = (worksheetData.requiredPermits || []).map(p => 
            p.id === permit.id ? { ...p, comments: newCommentsArray } : p
        );

        const batch = writeBatch(db);
        batch.update(worksheetRef, { requiredPermits: updatedPermits });

        // Also add log to AforoCase
        const caseDocRef = doc(db, 'AforoCases', worksheetId);
        const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'document_update',
            oldValue: `Permiso '${permit.name}'`,
            newValue: `Comentario añadido: "${data.text}"`,
            comment: `Comentario en permiso '${permit.name}'`
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
        
        await batch.commit();
        
        onCommentsUpdate(newCommentsArray);
        setComments(prev => [newComment, ...prev]);
        form.reset();
        toast({ title: 'Comentario añadido' });

    } catch (error) {
        console.error("Error adding permit comment:", error);
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
          <DialogTitle>Comentarios para Permiso</DialogTitle>
          <DialogDescription>
            Añada y vea notas para el permiso: <span className="font-bold text-foreground">{permit.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[40vh] my-4">
            <div className="space-y-4 pr-6">
            {comments.length > 0 ? (
                comments.map((comment) => (
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
                    No hay comentarios para este permiso.
                </p>
            )}
            </div>
        </ScrollArea>

        {canComment && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuevo Comentario</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      disabled={isSubmitting}
                      placeholder='Escriba su comentario aquí...'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    <Send className="mr-2 h-4 w-4" /> Enviar
                </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
