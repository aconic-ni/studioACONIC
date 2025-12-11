
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Announcement } from '@/types';
import { Loader2, Trash2, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppShell } from '@/components/layout/AppShell';
import Link from 'next/link';

const announcementSchema = z.object({
  title: z.string().min(3, 'El título es requerido.').max(100, 'El título no puede exceder los 100 caracteres.'),
  content: z.string().min(10, 'El contenido es requerido.').max(500, 'El contenido no puede exceder los 500 caracteres.'),
  linkUrl: z.string().url('Debe ser una URL válida (ej. https://...).').optional().or(z.literal('')),
  linkText: z.string().max(50, 'El texto no puede exceder los 50 caracteres.').optional(),
}).refine(data => !data.linkUrl || (data.linkUrl && data.linkText), {
  message: "Se requiere un texto para el enlace si se proporciona una URL.",
  path: ["linkText"],
});


type AnnouncementFormData = z.infer<typeof announcementSchema>;

export default function AnnouncementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', content: '', linkUrl: '', linkText: '' },
  });

  useEffect(() => {
    const q = query(collection(db, 'avisos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAnnouncements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(fetchedAnnouncements);
    });

    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (editingAnnouncement) {
        form.reset({
            title: editingAnnouncement.title,
            content: editingAnnouncement.content,
            linkUrl: editingAnnouncement.linkUrl || '',
            linkText: editingAnnouncement.linkText || '',
        });
    } else {
        form.reset({ title: '', content: '', linkUrl: '', linkText: '' });
    }
  }, [editingAnnouncement, form]);

  const onSubmit = async (data: AnnouncementFormData) => {
    if (!user || !user.displayName) {
        toast({ title: "Error", description: "Debe estar autenticado.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const dataToSave = {
        ...data,
        linkUrl: data.linkUrl || null,
        linkText: data.linkText || null,
    };

    try {
        if (editingAnnouncement) {
            const docRef = doc(db, 'avisos', editingAnnouncement.id);
            await updateDoc(docRef, { ...dataToSave, author: user.displayName });
            toast({ title: "Aviso Actualizado", description: "El aviso ha sido guardado." });
        } else {
            const collectionRef = collection(db, 'avisos');
            await addDoc(collectionRef, {
                ...dataToSave,
                author: user.displayName,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Aviso Publicado", description: "El nuevo aviso ha sido publicado." });
        }
        
        setEditingAnnouncement(null);
        form.reset();
    } catch (error) {
        console.error("Error saving announcement:", error);
        toast({ title: "Error", description: "No se pudo guardar el aviso.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'avisos', id));
        toast({ title: "Aviso Eliminado" });
        if (editingAnnouncement?.id === id) {
            setEditingAnnouncement(null);
        }
    } catch (error) {
        toast({ title: "Error", description: "No se pudo eliminar el aviso.", variant: "destructive" });
    }
  }

  return (
    <AppShell>
        <div className="py-2 md:py-5">
            <div className="mb-4">
                <Button asChild variant="outline">
                    <Link href="/admin/control">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Control de Registros
                    </Link>
                </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>{editingAnnouncement ? 'Editar Aviso' : 'Crear Nuevo Aviso'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="title" render={({ field }) => (
                                    <FormItem><FormLabel>Título</FormLabel><FormControl><Input {...field} disabled={isSubmitting}/></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="content" render={({ field }) => (
                                    <FormItem><FormLabel>Contenido</FormLabel><FormControl><Textarea {...field} rows={4} disabled={isSubmitting}/></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="linkUrl" render={({ field }) => (
                                    <FormItem><FormLabel>URL del Enlace (Opcional)</FormLabel><FormControl><Input {...field} placeholder="https://ejemplo.com" disabled={isSubmitting}/></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="linkText" render={({ field }) => (
                                    <FormItem><FormLabel>Texto para el Enlace (Opcional)</FormLabel><FormControl><Input {...field} placeholder="Ej: Ver más detalles aquí" disabled={isSubmitting}/></FormControl><FormMessage /></FormItem>
                                )}/>

                                <div className="flex gap-2 pt-2">
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                        {editingAnnouncement ? 'Guardar Cambios' : 'Publicar Aviso'}
                                    </Button>
                                    {editingAnnouncement && (
                                        <Button type="button" variant="ghost" onClick={() => setEditingAnnouncement(null)}>Cancelar Edición</Button>
                                    )}
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                         <CardTitle>Avisos Actuales</CardTitle>
                         <CardDescription>Lista de avisos publicados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-96">
                            <div className="space-y-3 pr-4">
                                {announcements.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">No hay avisos publicados.</p>
                                ) : announcements.map(ann => (
                                    <div key={ann.id} className="p-3 border rounded-md">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-sm">{ann.title}</p>
                                                <p className="text-xs text-muted-foreground">Por: {ann.author}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingAnnouncement(ann)}>Editar</Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(ann.id)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-sm mt-2">{ann.content}</p>
                                        {ann.linkUrl && ann.linkText && (
                                            <a href={ann.linkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-2 inline-block">
                                                {ann.linkText}
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    </AppShell>
  );
}
    