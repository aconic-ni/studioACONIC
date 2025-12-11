
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { Comment, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface BitacoraModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
}

export function BitacoraModal({ isOpen, onClose, examId }: BitacoraModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const canComment = user && (user.role === 'gestor' || user.role === 'aforador' || user.role === 'ejecutivo' || user.role === 'coordinadora');

  useEffect(() => {
    if (!isOpen || !examId) return;

    setIsLoading(true);
    const commentsRef = collection(db, `examenesPrevios/${examId}/comments`);
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedComments: Comment[] = [];
      querySnapshot.forEach((doc) => {
        fetchedComments.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setComments(fetchedComments);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching comments: ", error);
      toast({ title: 'Error', description: 'No se pudieron cargar los comentarios.', variant: 'destructive' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, examId, toast]);
  
  useEffect(() => {
    // Scroll to bottom when new comments are added
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [comments]);


  const handleAddComment = async () => {
    if (!newComment.trim() || !user || !user.displayName || !user.role) {
      toast({ title: "Error", description: "El comentario no puede estar vacío y debes estar autenticado.", variant: "destructive" });
      return;
    }
    if (!canComment) {
        toast({ title: "Acción no permitida", description: "No tienes permisos para comentar.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const commentsRef = collection(db, `examenesPrevios/${examId}/comments`);
      await addDoc(commentsRef, {
        text: newComment.trim(),
        authorId: user.uid,
        authorName: user.displayName,
        authorRole: user.role as UserRole,
        authorRoleTitle: user.roleTitle || null,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment: ", error);
      toast({ title: 'Error', description: 'No se pudo añadir el comentario.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRelativeTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Justo ahora';
    return formatDistanceToNow(timestamp.toDate(), { addSuffix: true, locale: es });
  };
  

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full p-0 flex flex-col h-[70vh] sm:h-[80vh]">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-xl">Bitácora del Examen</DialogTitle>
           <DialogDescription>Comentarios y notas sobre este examen previo.</DialogDescription>
          <button onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" aria-label="Cerrar">
            <X className="h-6 w-6" />
          </button>
        </DialogHeader>
        
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="p-4 space-y-4">
            {isLoading && (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {!isLoading && comments.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No hay comentarios en esta bitácora.
              </div>
            )}
            {!isLoading && comments.map((comment, index) => (
              <div key={comment.id || index} className={cn("flex items-start gap-3", comment.authorId === user?.uid && "justify-end")}>
                <div className={cn("rounded-lg p-3 max-w-[80%] w-fit", comment.authorId === user?.uid ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <p className="text-sm font-semibold">{comment.authorName} <span className="text-xs opacity-80 font-normal">({comment.authorRoleTitle || comment.authorRole})</span></p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{comment.text}</p>
                   <p className={cn("text-xs opacity-70 mt-2", comment.authorId === user?.uid ? "text-right" : "text-left")}>
                    {formatRelativeTime(comment.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {canComment && (
          <DialogFooter className="p-4 border-t bg-background">
            <div className="flex w-full items-center gap-2">
              <Textarea
                placeholder="Escribe un comentario..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                    }
                }}
                className="min-h-0 h-12 resize-none"
                rows={1}
                disabled={isSubmitting}
              />
              <Button onClick={handleAddComment} disabled={isSubmitting || !newComment.trim()} size="icon" className="shrink-0">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Enviar</span>
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
