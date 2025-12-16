
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Worksheet } from '@/types';
import { Loader2, Send } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: Timestamp;
}

interface AforoCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  worksheet: Worksheet;
}

export function AforoCommentModal({ isOpen, onClose, worksheet }: AforoCommentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    const commentsRef = collection(db, `worksheets/${worksheet.id}/aforoComments`);
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(fetchedComments);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching comments:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, worksheet.id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !user?.displayName) return;
    setIsSubmitting(true);

    const commentsRef = collection(db, `worksheets/${worksheet.id}/aforoComments`);
    try {
      await addDoc(commentsRef, {
        text: newComment.trim(),
        author: user.displayName,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar el comentario.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'Justo ahora';
    return format(timestamp.toDate(), 'dd/MM/yy hh:mm a', { locale: es });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comentarios de Aforo</DialogTitle>
          <DialogDescription>Comentarios para la hoja de trabajo: {worksheet.ne}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72 my-4">
          <div className="space-y-4 pr-6">
            {isLoading && <div className="text-center"><Loader2 className="h-6 w-6 animate-spin"/></div>}
            {!isLoading && comments.length === 0 && <p className="text-center text-muted-foreground">No hay comentarios.</p>}
            {comments.map(comment => (
              <div key={comment.id} className="p-3 border rounded-lg bg-secondary/50">
                <p className="text-sm">{comment.text}</p>
                <p className="text-xs text-muted-foreground text-right mt-2">- {comment.author}, {formatDate(comment.createdAt)}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="space-y-2 pt-4 border-t">
          <Textarea
            placeholder="Añadir un nuevo comentario..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={isSubmitting}
          />
          <Button onClick={handleAddComment} disabled={isSubmitting || !newComment.trim()} className="w-full">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
            Enviar
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
