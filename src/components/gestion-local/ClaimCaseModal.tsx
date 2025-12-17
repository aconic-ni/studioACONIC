
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch, collection, Timestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import type { AppUser, AforoCase, Worksheet, AforoCaseUpdate } from '@/types';
import { Loader2 } from 'lucide-react';
import { ConsigneeSelector } from '../shared/ConsigneeSelector';

const claimSchema = z.object({
  ne: z.string().min(1, "El NE es requerido."),
  consignee: z.string().min(1, "El Consignatario es requerido."),
  reference: z.string().optional(),
  merchandise: z.string().min(1, "La Mercancía es requerida."),
  executive: z.string().min(1, "Debe asignar un Ejecutivo."),
  aforador: z.string().min(1, "Debe asignar un Aforador."),
});

type ClaimFormData = z.infer<typeof claimSchema>;

interface ClaimCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseClaimed: () => void;
}

export function ClaimCaseModal({ isOpen, onClose, onCaseClaimed }: ClaimCaseModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      ne: '', consignee: '', reference: '', merchandise: '', executive: '', aforador: ''
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      const roles = ['ejecutivo', 'coordinadora', 'aforador', 'supervisor'];
      const usersQuery = query(collection(db, 'users'), where('role', 'in', roles));
      const snapshot = await getDocs(usersQuery);
      const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser));
      setAssignableUsers(users);
    };

    fetchUsers();
  }, [isOpen]);

  const executives = assignableUsers.filter(u => u.role === 'ejecutivo' || u.role === 'coordinadora');
  const aforadores = assignableUsers.filter(u => u.role === 'aforador' || u.role === 'supervisor');

  const onSubmit = async (data: ClaimFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const neTrimmed = data.ne.trim().toUpperCase();
    const worksheetDocRef = doc(db, 'worksheets', neTrimmed);
    const aforoCaseDocRef = doc(db, 'AforoCases', neTrimmed);
    
    try {
        const worksheetSnap = await getDoc(worksheetDocRef);

        if (worksheetSnap.exists()) {
            const existingData = worksheetSnap.data() as Worksheet;
            if (existingData.worksheetType !== 'hoja_de_trabajo') {
                // The case exists but is not a worksheet, so we convert it.
                const batch = writeBatch(db);
                batch.update(worksheetDocRef, { worksheetType: 'hoja_de_trabajo' });

                const updatesSubcollectionRef = collection(aforoCaseDocRef, 'actualizaciones');
                const updateLog: AforoCaseUpdate = {
                    updatedAt: Timestamp.now(),
                    updatedBy: user.displayName,
                    field: 'worksheetType',
                    oldValue: existingData.worksheetType,
                    newValue: 'hoja_de_trabajo',
                    comment: `Caso reclamado y convertido a Hoja de Trabajo por ${user.displayName}.`
                };
                batch.set(doc(updatesSubcollectionRef), updateLog);
                
                await batch.commit();

                toast({ title: "Caso Reclamado y Convertido", description: `El registro ${neTrimmed} ahora es una Hoja de Trabajo.` });
                onCaseClaimed();
                onClose();
            } else {
                // It already exists as a worksheet.
                toast({ title: "Registro Duplicado", description: `Ya existe una Hoja de Trabajo con el NE ${neTrimmed}.`, variant: "destructive" });
            }
        } else {
            // It does not exist, so we create it.
            const batch = writeBatch(db);
            const creationTimestamp = Timestamp.now();
            const createdByInfo = { by: user.displayName, at: creationTimestamp };
    
            const worksheetData: Partial<Worksheet> = {
                id: neTrimmed, ne: neTrimmed, worksheetType: 'hoja_de_trabajo', executive: data.executive,
                consignee: data.consignee, reference: data.reference, description: data.merchandise,
                aforador: data.aforador, createdAt: creationTimestamp, createdBy: user.email!, lastUpdatedAt: creationTimestamp,
            };
            batch.set(worksheetDocRef, worksheetData);
    
            const aforoCaseData: Partial<AforoCase> = {
                ne: neTrimmed, executive: data.executive, consignee: data.consignee, merchandise: data.merchandise,
                createdBy: user.uid, createdAt: creationTimestamp, aforador: data.aforador, assignmentDate: creationTimestamp,
                aforadorStatus: 'Pendiente ', aforadorStatusLastUpdate: createdByInfo, revisorStatus: 'Pendiente',
                revisorStatusLastUpdate: createdByInfo, preliquidationStatus: 'Pendiente', preliquidationStatusLastUpdate: createdByInfo,
                digitacionStatus: 'Pendiente', digitacionStatusLastUpdate: createdByInfo, incidentStatus: 'Pendiente',
                incidentStatusLastUpdate: createdByInfo, worksheetId: neTrimmed, entregadoAforoAt: creationTimestamp,
            };
            batch.set(aforoCaseDocRef, aforoCaseData);
    
            await batch.commit();
            toast({ title: "Caso Reclamado Exitosamente", description: `El registro para el NE ${neTrimmed} ha sido creado y asignado.` });
            onCaseClaimed();
            onClose();
            form.reset();
        }

    } catch (error) {
        console.error("Error claiming case:", error);
        toast({ title: "Error", description: "No se pudo crear o actualizar el registro.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reclamar Caso Antiguo</DialogTitle>
          <DialogDescription>
            Cree una hoja de trabajo y un caso de aforo para un NE que no fue registrado en el sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="ne" render={({ field }) => (<FormItem><FormLabel>NE</FormLabel><FormControl><Input {...field} placeholder="Número de Entrada" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="consignee" render={({ field }) => (<FormItem><FormLabel>Consignatario</FormLabel><FormControl><ConsigneeSelector value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="reference" render={({ field }) => (<FormItem><FormLabel>Referencia</FormLabel><FormControl><Input {...field} placeholder="Contenedor, Guía, BL..." /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="merchandise" render={({ field }) => (<FormItem><FormLabel>Mercancía</FormLabel><FormControl><Textarea {...field} placeholder="Breve descripción de la mercancía" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="executive" render={({ field }) => (
              <FormItem><FormLabel>Asignar Ejecutivo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{executives.map(e => <SelectItem key={e.uid} value={e.displayName || ''}>{e.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="aforador" render={({ field }) => (
              <FormItem><FormLabel>Asignar Aforador</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{aforadores.map(a => <SelectItem key={a.uid} value={a.displayName || ''}>{a.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Guardar y Reclamar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
