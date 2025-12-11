"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, writeBatch, collection, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { AforoCase, AforoCaseUpdate, Worksheet, AppUser } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { aduanas } from '@/lib/formData';
import { ConsigneeSelector } from '@/components/shared/ConsigneeSelector';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { FacturaModal } from '@/components/executive/corporate-report/FacturaModal';
import { PermitManagement } from '@/components/executive/corporate-report/PermitManagement';
import { DatePicker } from '@/components/reports/DatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Zod Schema Definition
export const corporateReportSchema = z.object({
  worksheetType: z.literal('corporate_report').default('corporate_report'),
  ne: z.string().min(1, "El campo NE es requerido."),
  reference: z.string().optional(),
  entryCustoms: z.string().min(1, "Aduana de ingreso es requerida."),
  dispatchCustoms: z.string().min(1, "Aduana de despacho es requerida."),
  consignee: z.string().min(1, "Consignatario es requerido."),
  proveedor: z.string().optional(),
  documents: z.array(z.object({
    id: z.string(),
    type: z.literal('FACTURA'),
    number: z.string(),
    noADMI: z.string(),
  })).optional(),
  fechaEnvioCliente: z.date().optional().nullable(),
  requiredPermits: z.array(z.any()).optional(),
  proveedorTransporte: z.string().optional(),
  declaracionNumero: z.string().optional(),
  fechaNacionalizacion: z.date().optional().nullable(),
  selectividad: z.enum(['verde', 'amarillo', 'rojo']).optional().nullable(),
  fechaDespacho: z.date().optional().nullable(),
  observations: z.string().optional(),
});

type CorporateReportFormData = z.infer<typeof corporateReportSchema>;

function CorporateReportForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFacturaModalOpen, setIsFacturaModalOpen] = useState(false);
  const [editingWorksheetId, setEditingWorksheetId] = useState<string | null>(null);

  const form = useForm<CorporateReportFormData>({
    resolver: zodResolver(corporateReportSchema),
    defaultValues: {
      worksheetType: 'corporate_report', ne: '', reference: '', entryCustoms: '', dispatchCustoms: '',
      consignee: '', proveedor: '', documents: [], fechaEnvioCliente: null, requiredPermits: [],
      proveedorTransporte: '', declaracionNumero: '', fechaNacionalizacion: null, selectividad: null,
      fechaDespacho: null, observations: '',
    },
  });

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setEditingWorksheetId(id);
      const fetchWorksheet = async () => {
        const wsDocRef = doc(db, 'worksheets', id);
        const wsSnap = await getDoc(wsDocRef);
        if (wsSnap.exists()) {
          const data = wsSnap.data();
          const formData: Partial<CorporateReportFormData> = {
            ...data,
            fechaEnvioCliente: data.fechaEnvioCliente?.toDate(),
            fechaNacionalizacion: data.fechaNacionalizacion?.toDate(),
            fechaDespacho: data.fechaDespacho?.toDate(),
          };
          form.reset(formData);
        } else {
          toast({ title: 'Error', description: 'No se encontró el reporte para editar.', variant: 'destructive'});
        }
      };
      fetchWorksheet();
    }
  }, [searchParams, form, toast]);


  const onSubmit = async (data: CorporateReportFormData) => {
    if (!user || !user.displayName || !user.email) {
      toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);

    if (editingWorksheetId) {
      const worksheetDocRef = doc(db, 'worksheets', editingWorksheetId);
      const dataToUpdate = {
        ...data,
        lastUpdatedAt: Timestamp.now(),
        fechaEnvioCliente: data.fechaEnvioCliente ? Timestamp.fromDate(data.fechaEnvioCliente) : null,
        fechaNacionalizacion: data.fechaNacionalizacion ? Timestamp.fromDate(data.fechaNacionalizacion) : null,
        fechaDespacho: data.fechaDespacho ? Timestamp.fromDate(data.fechaDespacho) : null,
      };
      
      try {
        await updateDoc(worksheetDocRef, dataToUpdate);
        toast({ title: 'Reporte Actualizado', description: `El reporte para el NE ${editingWorksheetId} ha sido guardado.` });
        router.push('/executive');
      } catch (err) {
        console.error("Error updating corporate report:", err);
        toast({ title: 'Error', description: 'No se pudo actualizar el reporte.', variant: 'destructive' });
      } finally {
        setIsSubmitting(false);
      }

    } else {
       const neTrimmed = data.ne.trim().toUpperCase();
      const worksheetDocRef = doc(db, 'worksheets', neTrimmed);
      const aforoCaseDocRef = doc(db, 'AforoCases', neTrimmed);

      try {
        const [worksheetSnap, aforoCaseSnap] = await Promise.all([getDoc(worksheetDocRef), getDoc(aforoCaseDocRef)]);
        if (worksheetSnap.exists() || aforoCaseSnap.exists()) {
          toast({ title: "Registro Duplicado", description: `Ya existe un registro con el NE ${neTrimmed}.`, variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        const batch = writeBatch(db);
        const creationTimestamp = Timestamp.now();

        const worksheetData = {
          ...data,
          id: neTrimmed, ne: neTrimmed, createdAt: creationTimestamp, createdBy: user.email,
          executive: user.displayName, lastUpdatedAt: creationTimestamp,
          fechaEnvioCliente: data.fechaEnvioCliente ? Timestamp.fromDate(data.fechaEnvioCliente) : null,
          fechaNacionalizacion: data.fechaNacionalizacion ? Timestamp.fromDate(data.fechaNacionalizacion) : null,
          fechaDespacho: data.fechaDespacho ? Timestamp.fromDate(data.fechaDespacho) : null,
        };
        batch.set(worksheetDocRef, worksheetData);

        const aforoCaseData: Partial<AforoCase> = {
          ne: neTrimmed, executive: user.displayName, consignee: data.consignee,
          declarationPattern: 'corporate_report', merchandise: data.observations,
          createdBy: user.uid, createdAt: creationTimestamp, aforadorStatus: 'En revisión',
          revisorStatus: 'Pendiente', preliquidationStatus: 'Pendiente', digitacionStatus: 'Pendiente de Digitación',
          incidentStatus: 'Pendiente', worksheetId: neTrimmed,
        };
        batch.set(aforoCaseDocRef, aforoCaseData);
        
        await batch.commit();
        toast({ title: "Registro Creado", description: `El reporte para el NE ${neTrimmed} ha sido guardado.` });
        router.push('/executive');
        form.reset();

      } catch (serverError: any) {
        console.error("Error creating record:", serverError);
        const permissionError = new FirestorePermissionError({
          path: `batch write to worksheets/${neTrimmed} and AforoCases/${neTrimmed}`,
          operation: 'create',
          requestResourceData: { worksheetData: data, aforoCaseData: { ne: neTrimmed } },
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto custom-shadow">
        <CardHeader>
          <CardTitle className="text-2xl">{editingWorksheetId ? 'Editar' : 'Nuevo'} Reporte Consignatario Empresarial</CardTitle>
          <CardDescription>{editingWorksheetId ? `Modificando reporte para el NE ${editingWorksheetId}` : 'Complete la información para generar el nuevo reporte.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
              {/* --- Fields --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="ne" render={({ field }) => (<FormItem><FormLabel>NE</FormLabel><FormControl><Input {...field} disabled={!!editingWorksheetId} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="reference" render={({ field }) => (<FormItem><FormLabel>Referencia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="consignee" render={({ field }) => (<FormItem><FormLabel>Consignatario</FormLabel><FormControl><ConsigneeSelector value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="proveedor" render={({ field }) => (<FormItem><FormLabel>Proveedor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="entryCustoms" render={({ field }) => (<FormItem><FormLabel>Aduana Ingreso</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{aduanas.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dispatchCustoms" render={({ field }) => (<FormItem><FormLabel>Aduana Despacho</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{aduanas.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              
              <Button type="button" onClick={() => setIsFacturaModalOpen(true)}>Administrar Facturas</Button>

              <PermitManagement control={form.control} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
                <FormField control={form.control} name="proveedorTransporte" render={({ field }) => (<FormItem><FormLabel>Proveedor de Transporte</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="declaracionNumero" render={({ field }) => (<FormItem><FormLabel>Declaración</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="fechaNacionalizacion" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Fecha de Nacionalización</FormLabel><FormControl><DatePicker date={field.value || undefined} onDateChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="selectividad" render={({ field }) => (<FormItem><FormLabel>Selectividad</FormLabel><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="verde">Verde</SelectItem><SelectItem value="amarillo">Amarillo</SelectItem><SelectItem value="rojo">Rojo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="fechaEnvioCliente" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Fecha Envío a Cliente</FormLabel><FormControl><DatePicker date={field.value || undefined} onDateChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="fechaDespacho" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Fecha Despacho</FormLabel><FormControl><DatePicker date={field.value || undefined} onDateChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <FormField control={form.control} name="observations" render={({ field }) => (<FormItem className="pt-4 border-t"><FormLabel>Observaciones</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>)} />

              <div className="flex justify-end gap-2 pt-6">
                <Button type="button" variant="outline" asChild><Link href="/executive"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Link></Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingWorksheetId ? 'Guardar Cambios' : 'Guardar Reporte'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <FacturaModal
        isOpen={isFacturaModalOpen}
        onClose={() => setIsFacturaModalOpen(false)}
        control={form.control}
      />
    </>
  );
}

export default function CorporateReportPage() {
    return (
        <AppShell>
            <div className="py-2 md:py-5">
                <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
                    <CorporateReportForm />
                </Suspense>
            </div>
        </AppShell>
    )
}
