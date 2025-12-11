
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
import { doc, getDoc, setDoc, Timestamp, writeBatch, collection, query, where, getCountFromServer } from 'firebase/firestore';
import type { WorksheetWithCase } from '@/types';
import { Loader2, AlertTriangle } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useRouter } from 'next/navigation';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';


const quickRequestSchema = z.object({
  reference: z.string().optional(),
  location: z.string().min(1, "La ubicación es requerida."),
});

type QuickRequestFormData = z.infer<typeof quickRequestSchema>;

interface QuickRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseWithWorksheet: WorksheetWithCase;
}

export function QuickRequestModal({ isOpen, onClose, caseWithWorksheet }: QuickRequestModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseExists, setCaseExists] = useState(false);
  const [isExtraCase, setIsExtraCase] = useState(false);
  const [isLoadingCheck, setIsLoadingCheck] = useState(true);

  const form = useForm<QuickRequestFormData>({
    resolver: zodResolver(quickRequestSchema),
    defaultValues: { reference: '', location: '' },
  });

  useEffect(() => {
    const checkForExistingCase = async () => {
      if (!isOpen) return;
      setIsLoadingCheck(true);
      const ne = caseWithWorksheet.ne.toUpperCase().trim();
      const examDocRef = doc(db, "examenesPrevios", ne);
      const requestDocRef = doc(db, "solicitudesExamen", ne);
      
      try {
        const [examSnap, requestSnap] = await Promise.all([getDoc(examDocRef), getDoc(requestDocRef)]);
        const exists = examSnap.exists() || requestSnap.exists();
        setCaseExists(exists);
        // If case exists, automatically toggle the extra case switch on
        if (exists) {
          setIsExtraCase(true);
        } else {
          setIsExtraCase(false);
        }
      } catch (error) {
        console.error("Error checking for existing case:", error);
        setCaseExists(false); // Assume it doesn't exist on error
      } finally {
        setIsLoadingCheck(false);
      }
    };
    
    if (isOpen) {
      form.reset({
        reference: '',
        location: caseWithWorksheet.worksheet?.location || '',
      });
      checkForExistingCase();
    }
  }, [isOpen, caseWithWorksheet, form]);
  
  const backLink = user?.role === 'coordinadora' ? '/assignments' : '/executive';

  const createRequest = async (docId: string, data: QuickRequestFormData) => {
    if (!user || !user.email) return;

    const requestDocRef = doc(db, "solicitudesExamen", docId);
    const requestData = {
        ne: caseWithWorksheet.ne.toUpperCase().trim(), // Store original NE for reference
        id: docId, // Store the full ID in the document as well
        reference: data.reference || '',
        consignee: caseWithWorksheet.consignee,
        location: data.location,
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
        onClose();
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: requestDocRef.path,
            operation: 'create',
            requestResourceData: requestData
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
    }
  };


  async function onSubmit(data: QuickRequestFormData) {
    if (!user || !user.email) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }
    if (!caseWithWorksheet.worksheet) {
        toast({ title: 'Error', description: 'No se encontró la hoja de trabajo asociada.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const ne = caseWithWorksheet.ne.toUpperCase().trim();
    
    if (isExtraCase) {
        const q = query(collection(db, "solicitudesExamen"), where("ne", "==", ne));
        const examenesQuery = query(collection(db, "examenesPrevios"), where("ne", "==", ne));

        try {
            const [solicitudesSnapshot, examenesSnapshot] = await Promise.all([
                getCountFromServer(q),
                getCountFromServer(examenesQuery)
            ]);
            
            const solicitudesCount = solicitudesSnapshot.data().count;
            const examenesCount = examenesSnapshot.data().count;
            const totalCount = solicitudesCount + examenesCount;
            
            const newDocId = `${ne}-EXT${totalCount + 1}`;
            await createRequest(newDocId, data);
        } catch (err) {
            console.error("Error counting existing cases", err);
            toast({ title: "Error", description: "No se pudo contar los casos existentes para crear ID extraordinario.", variant: "destructive"});
        } finally {
            setIsSubmitting(false);
        }
    } else {
        await createRequest(ne, data);
        setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitud Rápida de Previo</DialogTitle>
          <DialogDescription>
            Creando una solicitud para el NE: <span className="font-bold text-foreground">{caseWithWorksheet.ne}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-1 text-muted-foreground">
            <p><strong>Consignatario:</strong> {caseWithWorksheet.consignee}</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ubicación de la Mercancía</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} placeholder="Especifique la ubicación" />
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
                    <Input {...field} disabled={isSubmitting} placeholder="Ingrese la nueva referencia" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isLoadingCheck ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                    <span className="text-sm text-muted-foreground">Verificando...</span>
                </div>
            ) : caseExists && (
                 <div className="p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
                    <div className="flex items-center gap-3">
                         <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400"/>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            Ya existe un caso para este NE.
                        </p>
                    </div>
                     <div className="flex items-center space-x-2 mt-3 pl-2">
                        <Switch
                            id="extra-case-mode"
                            checked={isExtraCase}
                            onCheckedChange={setIsExtraCase}
                        />
                        <Label htmlFor="extra-case-mode" className="text-sm font-medium">Crear como Caso Extraordinario</Label>
                    </div>
                 </div>
            )}
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || isLoadingCheck}>
                    {(isSubmitting || isLoadingCheck) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
