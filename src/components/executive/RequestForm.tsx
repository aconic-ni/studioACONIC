
"use client";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const requestSchema = z.object({
  ne: z.string().min(1, "NE es requerido."),
  reference: z.string().optional(),
  location: z.string().min(1, "Ubicación es requerida."),
  consignee: z.string().min(1, "Consignatario es requerido."),
});

type RequestFormData = z.infer<typeof requestSchema>;

export function RequestForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extraCaseAlert, setExtraCaseAlert] = useState<{ isOpen: boolean; data: RequestFormData | null }>({ isOpen: false, data: null });

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      ne: '',
      reference: '',
      consignee: '',
      location: '',
    },
  });
  
  const backLink = user?.role === 'coordinadora' ? '/assignments' : '/executive';

  const createRequest = async (docId: string, data: RequestFormData) => {
    if (!user || !user.email) return;

    const requestDocRef = doc(db, "solicitudesExamen", docId);
    const requestData = {
        ...data,
        ne: data.ne.toUpperCase().trim(), // Store original NE for reference
        status: 'pendiente' as const,
        requestedBy: user.email!,
        requestedAt: Timestamp.fromDate(new Date()),
    };

    try {
        await setDoc(requestDocRef, requestData);
        toast({
            title: "Solicitud Enviada",
            description: `La solicitud para el examen NE: ${docId} ha sido creada.`,
        });
        router.push(backLink);
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: requestDocRef.path,
            operation: 'create',
            requestResourceData: requestData
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
    }
  };


  const handleExtraCaseCreation = async () => {
    if (!extraCaseAlert.data) return;
    setIsSubmitting(true);
    setExtraCaseAlert({ isOpen: false, data: null });

    const ne = extraCaseAlert.data.ne.toUpperCase().trim();
    const q = query(collection(db, "solicitudesExamen"), where("ne", "==", ne));

    try {
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
        const newDocId = `${ne}-EXT${count + 1}`;
        await createRequest(newDocId, extraCaseAlert.data);
    } catch(err) {
        toast({ title: "Error", description: "No se pudo contar los casos existentes.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  async function onSubmit(data: RequestFormData) {
    if (!user || !user.email) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const ne = data.ne.toUpperCase().trim();
    
    const examDocRef = doc(db, "examenesPrevios", ne);
    const requestDocRef = doc(db, "solicitudesExamen", ne);

    try {
        const [examDocSnap, requestDocSnap] = await Promise.all([
            getDoc(examDocRef),
            getDoc(requestDocRef)
        ]);

        if (examDocSnap.exists()) {
            setExtraCaseAlert({ isOpen: true, data });
            setIsSubmitting(false);
            return;
        }
        
        if (requestDocSnap.exists()) {
            toast({
                title: "Solicitud Duplicada",
                description: `Ya existe una solicitud pendiente para el NE: ${ne}.`,
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }

        // If no duplicates, create normally
        await createRequest(ne, data);

    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: `Verificación de duplicados para NE: ${ne}`,
            operation: 'get',
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            title: "Error al Verificar",
            description: "No se pudo comprobar si el registro ya existe.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <>
    <Card className="w-full max-w-3xl mx-auto custom-shadow">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Solicitar Nuevo Examen Previo</CardTitle>
        <CardDescription>Complete la información para generar una nueva solicitud.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="ne"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NE (Seguimiento NX1) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: NX1-12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referencia (Contenedor, Guía, BL...)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: MSKU1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="consignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignatario *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del consignatario" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación de la Mercancía *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Almacén Central, Bodega 5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between items-center pt-4">
               <Button type="button" variant="ghost" asChild>
                  <Link href={backLink}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                  </Link>
                </Button>
              <Button type="submit" className="btn-primary" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>

    <AlertDialog open={extraCaseAlert.isOpen} onOpenChange={(isOpen) => setExtraCaseAlert(prev => ({...prev, isOpen}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Examen Previo Existente</AlertDialogTitle>
                <AlertDialogDescription>
                    Ya existe un examen previo para el NE <span className="font-bold">{extraCaseAlert.data?.ne.toUpperCase()}</span>.
                    ¿Desea crear una Solicitud Extraordinaria para este NE? Se generará un nuevo ID.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setExtraCaseAlert({ isOpen: false, data: null })}>No, cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleExtraCaseCreation}>Sí, crear solicitud extraordinaria</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
