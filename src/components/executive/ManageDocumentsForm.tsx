
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, Timestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate, Worksheet, WorksheetDocument, RequiredPermit, DocumentStatus, AppUser } from '@/types';
import { Loader2, PlusCircle, Trash2, FileText, Calendar, Receipt, RotateCcw, MessageSquare, Info, Scale, Settings, ArrowLeft, Edit, Truck, Anchor, Plane } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../reports/DatePicker';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { PermitCommentModal } from './PermitCommentModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { permitOptions } from '@/lib/formData';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { PermitDetailsModal } from './worksheet/PermitDetailsModal';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useSearchParams } from 'next/navigation';


const documentSchema = z.object({
  id: z.string(),
  type: z.string(),
  number: z.string(),
  isCopy: z.boolean(),
  status: z.custom<DocumentStatus>(),
});

const permitSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.custom<DocumentStatus>(),
  tramiteDate: z.custom<Timestamp>().nullable().optional(),
  estimatedDeliveryDate: z.custom<Timestamp>().nullable().optional(),
  facturaNumber: z.string().optional(),
  assignedExecutive: z.string().optional(),
  comments: z.array(z.any()).optional(),
  // Unified
  tipoTramite: z.string().optional(),
  // INE
  item: z.string().optional(),
  marcaEquipo: z.string().optional(),
  modeloEquipo: z.string().optional(),
  equipoType: z.enum(['Refrigerador', 'Aire Acondicionado']).optional(),
});


const manageDocsSchema = z.object({
  facturaNumber: z.string().optional(),
  documents: z.array(documentSchema),
  requiredPermits: z.array(permitSchema),
  transportDocumentType: z.enum(['guia_aerea', 'bl', 'carta_porte']).optional().nullable(),
  transportCompany: z.string().optional(),
  transportDocumentNumber: z.string().optional(),
});
type ManageDocsFormData = z.infer<typeof manageDocsSchema>;

export function ManageDocumentsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const caseId = searchParams.get('id');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalWorksheet, setOriginalWorksheet] = useState<Worksheet | null>(null);
  const [groupMembers, setGroupMembers] = useState<AppUser[]>([]);
  const [selectedPermitForComment, setSelectedPermitForComment] = useState<{permit: RequiredPermit, index: number} | null>(null);
  const [editingPermit, setEditingPermit] = useState<{ permit: Partial<RequiredPermit>, index: number } | null>(null);
  const [pendingPermitData, setPendingPermitData] = useState<Partial<RequiredPermit> | null>(null);


  const form = useForm<ManageDocsFormData>({
    resolver: zodResolver(manageDocsSchema),
    defaultValues: { facturaNumber: '', documents: [], requiredPermits: [], transportDocumentType: null, transportCompany: '', transportDocumentNumber: '' },
  });

  const { fields: docFields, append: appendDoc, remove: rhfRemoveDoc, update: updateDocField } = useFieldArray({
    control: form.control, name: "documents",
  });
  const { fields: permitFields, append: appendPermit, remove: removePermit, update: updatePermitField } = useFieldArray({
    control: form.control, name: "requiredPermits",
  });

  const watchPermitFields = form.watch("requiredPermits");
  
  const [facturaPopoverOpen, setFacturaPopoverOpen] = useState(false);
  const [facturaNumberInput, setFacturaNumberInput] = useState('');
  const [facturaIsOriginal, setFacturaIsOriginal] = useState(false);

  const [docType, setDocType] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [isOriginal, setIsOriginal] = useState(false);

  const [permitName, setPermitName] = useState('');
  const [otherPermitName, setOtherPermitName] = useState('');
  const [permitStatus, setPermitStatus] = useState<DocumentStatus>('Pendiente');
  const [selectedFacturaForPermit, setSelectedFacturaForPermit] = useState('');


  const watchedFacturaNumber = form.watch('facturaNumber');
  const enteredFacturas = watchedFacturaNumber ? watchedFacturaNumber.split(';').map(f => f.trim()).filter(f => f) : [];


  useEffect(() => {
    const fetchWorksheetAndGroup = async () => {
        if (!user || !caseId) return;
        
        const wsDoc = await getDoc(doc(db, 'worksheets', caseId));
        if (wsDoc.exists()) {
            const wsData = {id: wsDoc.id, ...wsDoc.data()} as Worksheet;
            setOriginalWorksheet(wsData);
            const permitsWithDates = (wsData.requiredPermits || []).map(p => ({
                ...p,
                tramiteDate: p.tramiteDate,
                estimatedDeliveryDate: p.estimatedDeliveryDate
            }));
            form.reset({
                facturaNumber: wsData.facturaNumber || '',
                documents: wsData.documents || [],
                requiredPermits: permitsWithDates,
                transportDocumentType: wsData.transportDocumentType || null,
                transportCompany: wsData.transportCompany || '',
                transportDocumentNumber: wsData.transportDocumentNumber || '',
            });
            setFacturaNumberInput(wsData.facturaNumber || '');
        } else {
          toast({ title: 'Error', description: 'No se encontró la Hoja de Trabajo para este caso.', variant: 'destructive'});
        }
        
        const execRoles = ['admin', 'supervisor', 'coordinadora', 'ejecutivo'];
        const isManagement = execRoles.includes(user.role || '');
        if (isManagement) {
            const execQuery = query(collection(db, 'users'), where('role', 'in', ['ejecutivo', 'coordinadora']));
            const querySnapshot = await getDocs(execQuery);
            const members = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
            setGroupMembers(members);
        }
    };

    fetchWorksheetAndGroup();
  }, [caseId, form, user, toast]);

  const handleAutoSave = async (data: ManageDocsFormData, changeLog: { field: string, oldValue: any, newValue: any, comment: string }) => {
    if (!user || !user.displayName || !originalWorksheet) return;

    setIsSubmitting(true);
    const batch = writeBatch(db);
    
    const worksheetDocRef = doc(db, 'worksheets', originalWorksheet.id);
    const caseDocRef = doc(db, 'AforoCases', originalWorksheet.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    const sanitizedPermits = data.requiredPermits.map(permit => ({
        ...permit,
        tramiteDate: permit.tramiteDate === undefined ? null : permit.tramiteDate,
        estimatedDeliveryDate: permit.estimatedDeliveryDate === undefined ? null : permit.estimatedDeliveryDate,
    }));

    const sanitizedData = {
        ...data,
        requiredPermits: sanitizedPermits,
    };

    batch.update(worksheetDocRef, sanitizedData);
    if(changeLog.field === 'facturaNumber'){
      batch.update(caseDocRef, { facturaNumber: data.facturaNumber });
    }

    const updateLog: AforoCaseUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.displayName,
        field: changeLog.field,
        oldValue: changeLog.oldValue,
        newValue: changeLog.newValue,
        comment: changeLog.comment
    };
    batch.set(doc(updatesSubcollectionRef), updateLog);
    
    try {
      await batch.commit();
      toast({ title: "Cambio Guardado", description: "La información ha sido actualizada."});
      // Refresh local state to match DB
      const wsDoc = await getDoc(worksheetDocRef);
      if (wsDoc.exists()) {
          setOriginalWorksheet({id: wsDoc.id, ...wsDoc.data()} as Worksheet);
      }
    } catch (error) {
      console.error("Error auto-saving:", error);
      toast({ title: "Error", description: "No se pudo guardar el cambio.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  const addDocument = () => {
    if (docType.trim() && docNumber.trim()) {
      const newDoc = { id: uuidv4(), type: docType, number: docNumber, isCopy: !isOriginal, status: 'Entregado' as DocumentStatus };
      const newDocsArray = [...docFields, newDoc];
      const updatedData = { ...form.getValues(), documents: newDocsArray };
      handleAutoSave(updatedData, {
        field: 'documents',
        oldValue: docFields,
        newValue: newDocsArray,
        comment: `Documento añadido: ${docType} - ${docNumber}`
      });
      appendDoc(newDoc);
      setDocType(''); setDocNumber(''); setIsOriginal(false);
    } else {
      toast({ title: "Datos incompletos", variant: "destructive" });
    }
  };
  
  const handleAddFactura = () => {
    if (facturaNumberInput.trim()) {
        const newFacturaNumber = facturaNumberInput.trim();
        const newFacturasArray = [...enteredFacturas, newFacturaNumber];
        form.setValue('facturaNumber', newFacturasArray.join('; '));

        const newDoc = { id: uuidv4(), type: 'FACTURA', number: newFacturaNumber, isCopy: !facturaIsOriginal, status: 'Entregado' as DocumentStatus };
        const newDocsArray = [...docFields, newDoc];
        const updatedData = { ...form.getValues(), documents: newDocsArray, facturaNumber: newFacturasArray.join('; ') };
        
        handleAutoSave(updatedData, {
            field: 'facturaNumber',
            oldValue: originalWorksheet?.facturaNumber,
            newValue: updatedData.facturaNumber,
            comment: `Factura añadida: ${newFacturaNumber}`
        });

        appendDoc(newDoc);
        setFacturaPopoverOpen(false);
        setFacturaNumberInput('');
    } else {
        toast({ title: "Número de factura requerido", variant: "destructive" });
    }
  }
  
  const removeDoc = (index: number) => {
    const docToRemove = docFields[index];
    const newDocsArray = docFields.filter((_, i) => i !== index);
    
    let updatedFacturaNumber = form.getValues('facturaNumber');
    if (docToRemove.type === 'FACTURA') {
        const facturasArray = (updatedFacturaNumber || '').split(';').map(f => f.trim());
        const newFacturasArray = facturasArray.filter(f => f !== docToRemove.number);
        updatedFacturaNumber = newFacturasArray.join('; ');
        form.setValue('facturaNumber', updatedFacturaNumber);
    }
    
    const updatedData = { ...form.getValues(), documents: newDocsArray, facturaNumber: updatedFacturaNumber };
    handleAutoSave(updatedData, {
        field: 'documents',
        oldValue: docFields,
        newValue: newDocsArray,
        comment: `Documento eliminado: ${docToRemove.type} - ${docToRemove.number}`
    });
    rhfRemoveDoc(index);
  };

  const addPermit = () => {
    const finalPermitName = permitName === 'OTROS' ? otherPermitName.trim() : permitName.trim();
    if (!finalPermitName) {
      toast({ title: "Nombre requerido", description: "Por favor, ingrese el nombre del permiso.", variant: "destructive" });
      return;
    }
  
    let facturaParaPermiso = selectedFacturaForPermit;
    if (!facturaParaPermiso && enteredFacturas.length === 1) {
        facturaParaPermiso = enteredFacturas[0];
    }
  
    const permitBaseData: Partial<RequiredPermit> = { 
      id: uuidv4(), 
      name: finalPermitName, 
      status: permitStatus, 
      facturaNumber: facturaParaPermiso,
      assignedExecutive: user?.displayName || '',
      comments: []
    };
    
    const specialPermitTypes = ["Dictamen Tecnico INE", "IPSA", "MINSA", "TELCOR"];
    if (specialPermitTypes.includes(finalPermitName)) {
        setPendingPermitData(permitBaseData);
        setEditingPermit({ permit: permitBaseData, index: -1 });
    } else {
        const fullPermitData = { ...permitBaseData, tipoTramite: 'Autorización' } as RequiredPermit;
        const newPermitsArray = [...permitFields, fullPermitData];
        const updatedData = { ...form.getValues(), requiredPermits: newPermitsArray };
        handleAutoSave(updatedData, {
            field: 'requiredPermits',
            oldValue: permitFields,
            newValue: newPermitsArray,
            comment: `Permiso añadido: ${finalPermitName}`
        });
        appendPermit(fullPermitData);
        resetPermitInputs();
    }
  };

  const handleSavePermitDetails = (index: number, updatedDetails: Partial<RequiredPermit>) => {
    const permitToUpdate = index > -1 ? { ...permitFields[index], ...updatedDetails } : { ...pendingPermitData, ...updatedDetails };
    const newPermitsArray = [...permitFields];
    if (index > -1) {
        newPermitsArray[index] = permitToUpdate as RequiredPermit;
    } else {
        newPermitsArray.push(permitToUpdate as RequiredPermit);
    }
    
    const updatedData = { ...form.getValues(), requiredPermits: newPermitsArray };
     handleAutoSave(updatedData, {
        field: 'requiredPermits',
        oldValue: permitFields,
        newValue: newPermitsArray,
        comment: `Permiso ${index > -1 ? 'actualizado' : 'añadido'} con detalles: ${permitToUpdate.name}`
    });

    if (index > -1) {
        updatePermitField(index, permitToUpdate as RequiredPermit);
    } else {
        appendPermit(permitToUpdate as RequiredPermit);
    }
    
    setEditingPermit(null);
    setPendingPermitData(null);
    resetPermitInputs();
    toast({ title: "Permiso Guardado", description: `La información para ${permitToUpdate.name} ha sido guardada.` });
  };
  
  const handleRemovePermit = (index: number) => {
    const permitToRemove = permitFields[index];
    const newPermitsArray = permitFields.filter((_, i) => i !== index);
    const updatedData = { ...form.getValues(), requiredPermits: newPermitsArray };
    
    handleAutoSave(updatedData, {
        field: 'requiredPermits',
        oldValue: permitFields,
        newValue: newPermitsArray,
        comment: `Permiso eliminado: ${permitToRemove.name}`
    });
    
    removePermit(index);
  };

  const resetPermitInputs = () => {
    setPermitName('');
    setOtherPermitName('');
    setPermitStatus('Pendiente');
    setSelectedFacturaForPermit('');
  };
  
   const handlePermitFieldUpdate = (index: number, field: keyof RequiredPermit, value: any) => {
    const currentPermits = form.getValues('requiredPermits');
    const oldPermit = currentPermits[index];
    const oldValue = oldPermit[field];
    
    if (JSON.stringify(oldValue) === JSON.stringify(value)) return;

    const newPermitsArray = [...currentPermits];
    newPermitsArray[index] = { ...newPermitsArray[index], [field]: value };
    
    const updatedData = { ...form.getValues(), requiredPermits: newPermitsArray };
    handleAutoSave(updatedData, {
        field: `permit_${field}`,
        oldValue: oldValue,
        newValue: value,
        comment: `Permiso '${oldPermit.name}' actualizado. Campo: ${String(field)}`
    });
    updatePermitField(index, { ...oldPermit, [field]: value });
  };
  
  const handleUpdatePermitComments = (permitIndex: number, newComments: any[]) => {
    handlePermitFieldUpdate(permitIndex, 'comments', newComments);
  };

  const getStatusIndicatorClass = (status: DocumentStatus, dueDate?: Timestamp | null): string => {
    switch (status) {
      case 'Entregado': return 'bg-green-500';
      case 'Rechazado': return 'bg-red-500';
      case 'En Trámite':
        if (dueDate) {
          const daysLeft = differenceInDays(dueDate.toDate(), new Date());
          if (daysLeft <= 3) return 'bg-yellow-500';
        }
        return 'bg-blue-500';
      case 'Pendiente':
      case 'Sometido de Nuevo':
      default:
        return 'bg-gray-400';
    }
  };


  if (!caseId) {
    return <Card className="w-full max-w-4xl mx-auto"><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent><p>No se ha proporcionado un ID de caso.</p></CardContent></Card>;
  }

  return (
    <>
    <Card className="w-full max-w-6xl mx-auto custom-shadow">
        <CardHeader>
          <CardTitle>Gestionar Documentos y Permisos</CardTitle>
          <CardDescription>Añada nuevos documentos o actualice el estado de los permisos para el NE: {caseId}</CardDescription>
        </CardHeader>
        <CardContent>
        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            
            <div className="pt-4 border-t">
                <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-lg font-medium">Documentos Entregados</h3>
                    <Popover open={facturaPopoverOpen} onOpenChange={setFacturaPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm"><Receipt className="mr-2 h-4 w-4"/> Añadir Factura</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Añadir Factura(s)</h4>
                                    <p className="text-sm text-muted-foreground">Separe múltiples números con coma o punto y coma.</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="factura-number">Número(s) de Factura</Label>
                                    <Input id="factura-number" value={facturaNumberInput} onChange={e => setFacturaNumberInput(e.target.value)} />
                                    <div className="flex items-center space-x-2">
                                        <Switch id="factura-original" checked={facturaIsOriginal} onCheckedChange={setFacturaIsOriginal} />
                                        <Label htmlFor="factura-original">Es Original</Label>
                                    </div>
                                    <Button onClick={handleAddFactura}>Guardar Factura(s)</Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                 <div className="p-3 border rounded-md mb-4">
                    <h4 className="text-md font-medium text-primary mb-2">Documento de Transporte</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormField
                            control={form.control}
                            name="transportDocumentType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Documento</FormLabel>
                                    <Select onValueChange={(value) => handleAutoSave({ ...form.getValues(), transportDocumentType: value as any }, { field: 'transportDocumentType', oldValue: field.value, newValue: value, comment: 'Tipo de documento de transporte actualizado' })} value={field.value ?? undefined}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="guia_aerea">Guía Aérea</SelectItem>
                                            <SelectItem value="bl">BL (Conocimiento de Embarque)</SelectItem>
                                            <SelectItem value="carta_porte">Carta de Porte</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="transportCompany"
                            render={({ field }) => (
                            <FormItem><FormLabel>Compañía</FormLabel><FormControl><Input {...field} onBlur={() => handleAutoSave(form.getValues(), { field: 'transportCompany', oldValue: originalWorksheet?.transportCompany, newValue: field.value, comment: 'Compañía de transporte actualizada' })} placeholder="Nombre de la compañía" /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField
                            control={form.control}
                            name="transportDocumentNumber"
                            render={({ field }) => (
                            <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} onBlur={() => handleAutoSave(form.getValues(), { field: 'transportDocumentNumber', oldValue: originalWorksheet?.transportDocumentNumber, newValue: field.value, comment: 'Número de documento de transporte actualizado' })} placeholder="Número del documento" /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end mb-4 p-3 border rounded-md">
                     <div><Label>Tipo de Documento</Label><Input value={docType} onChange={e => setDocType(e.target.value)} placeholder="Ej: BL, Packing List" /></div>
                     <div><Label>Número</Label><Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="Ej: 12345" /></div>
                     <div className="flex items-center gap-2 pt-5"><Switch checked={isOriginal} onCheckedChange={setIsOriginal} /><Label>Es Original</Label></div>
                     <Button type="button" onClick={addDocument}><PlusCircle className="mr-2 h-4 w-4"/>Añadir</Button>
                </div>
                {docFields.length > 0 && (
                    <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Número</TableHead><TableHead>Formato</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                    <TableBody>{docFields.map((field, index) => (<TableRow key={field.id}><TableCell>{field.type}</TableCell><TableCell>{field.number}</TableCell><TableCell>{field.isCopy ? 'Copia' : 'Original'}</TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}</TableBody>
                    </Table></div>
                )}
            </div>
            
            <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Permisos Requeridos</h3>
                 <div className="space-y-4 p-3 border rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
                        <div className="grid gap-2">
                            <Label>Nombre del Permiso</Label>
                            <Select value={permitName} onValueChange={setPermitName}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar permiso..." /></SelectTrigger>
                                <SelectContent>
                                    {permitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {permitName === 'OTROS' && <Input value={otherPermitName} onChange={e => setOtherPermitName(e.target.value)} placeholder="Indique cuál" />}
                        </div>
                         <div>
                            <Label>Factura Asociada</Label>
                             <Select value={selectedFacturaForPermit} onValueChange={setSelectedFacturaForPermit} disabled={enteredFacturas.length === 0}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar factura..." /></SelectTrigger>
                                <SelectContent>
                                    {enteredFacturas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                </SelectContent>
                             </Select>
                         </div>
                        <div><Label>Estado</Label>
                            <RadioGroup value={permitStatus} onValueChange={(v: any) => setPermitStatus(v)} className="flex gap-4 pt-2">
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Pendiente"/></FormControl><FormLabel className="font-normal">Pendiente</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="En Trámite"/></FormControl><FormLabel className="font-normal">En Trámite</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Entregado"/></FormControl><FormLabel className="font-normal">Entregado</FormLabel></FormItem>
                            </RadioGroup>
                        </div>
                    </div>
                    <Button type="button" onClick={addPermit} className="w-full md:w-auto"><PlusCircle className="mr-2 h-4 w-4"/>Añadir Permiso a la Lista</Button>
                 </div>
                 {permitFields.length > 0 ? (
                    <div className="rounded-md border mt-4">
                        <Table>
                            <TableHeader><TableRow><TableHead>Permiso</TableHead><TableHead>Factura</TableHead><TableHead>Asignado A</TableHead><TableHead>Estado</TableHead><TableHead>Fecha Trámite</TableHead><TableHead>Fecha Entrega</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {permitFields.map((permit, index) => {
                                 const needsDetails = ['Dictamen Tecnico INE', 'IPSA', 'MINSA', 'TELCOR'].includes(permit.name);
                                 const isDictamenIne = permit.name === 'Dictamen Tecnico INE';
                                 return (
                                     <TableRow key={permit.id}>
                                         <TableCell className="font-medium">{permit.name}</TableCell>
                                         <TableCell>{permit.facturaNumber || 'N/A'}</TableCell>
                                          <TableCell>
                                             <Controller
                                                 control={form.control}
                                                 name={`requiredPermits.${index}.assignedExecutive`}
                                                 render={({ field: controllerField }) => (
                                                 <Select onValueChange={(value) => handlePermitFieldUpdate(index, 'assignedExecutive', value)} value={controllerField.value || user?.displayName || ''}>
                                                     <FormControl>
                                                         <SelectTrigger className="w-[180px] text-xs h-8">
                                                             <SelectValue placeholder="Asignar..."/>
                                                         </SelectTrigger>
                                                     </FormControl>
                                                     <SelectContent>
                                                     {groupMembers.map(member => (
                                                         <SelectItem key={member.uid} value={member.displayName || ''}>{member.displayName}</SelectItem>
                                                     ))}
                                                     </SelectContent>
                                                 </Select>
                                                 )}
                                             />
                                         </TableCell>
                                         <TableCell>
                                             <div className="flex items-center gap-2">
                                                <span className={cn("h-2.5 w-2.5 rounded-full", getStatusIndicatorClass(permit.status, permit.estimatedDeliveryDate))}/>
                                                <Select onValueChange={(value) => handlePermitFieldUpdate(index, 'status', value)} value={permit.status}>
                                                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                                                        <SelectItem value="En Trámite">En Trámite</SelectItem>
                                                        <SelectItem value="Entregado">Entregado</SelectItem>
                                                        <SelectItem value="Rechazado">Rechazado</SelectItem>
                                                        <SelectItem value="Sometido de Nuevo">Sometido de Nuevo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                             </div>
                                         </TableCell>
                                         <TableCell>
                                             <FormField
                                                 control={form.control}
                                                 name={`requiredPermits.${index}.tramiteDate`}
                                                 render={({ field: dateField }) => (
                                                 <DatePicker
                                                     date={dateField.value?.toDate()}
                                                     onDateChange={(date) => handlePermitFieldUpdate(index, 'tramiteDate', date ? Timestamp.fromDate(date) : null)}
                                                 />
                                                 )}
                                             />
                                         </TableCell>
                                         <TableCell>
                                             <FormField
                                                 control={form.control}
                                                 name={`requiredPermits.${index}.estimatedDeliveryDate`}
                                                 render={({ field: dateField }) => (
                                                 <DatePicker
                                                     date={dateField.value?.toDate()}
                                                     onDateChange={(date) => handlePermitFieldUpdate(index, 'estimatedDeliveryDate', date ? Timestamp.fromDate(date) : null)}
                                                 />
                                                 )}
                                             />
                                         </TableCell>
                                         <TableCell className="text-right">
                                             <div className="flex items-center justify-end gap-1">
                                                {isDictamenIne && originalWorksheet && (
                                                  <TooltipProvider>
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <Button asChild variant="ghost" size="icon">
                                                          <Link href={`/legal/request?ne=${originalWorksheet.ne}&consignee=${encodeURIComponent(originalWorksheet.consignee)}&serviceType=Dictamen%20Tecnico%20INE&factura=${encodeURIComponent(permit.facturaNumber || '')}&contenedor=${encodeURIComponent(originalWorksheet.reference || '')}&item=${encodeURIComponent(permit.item || '')}&marca=${encodeURIComponent(permit.marcaEquipo || '')}&modelo=${encodeURIComponent(permit.modeloEquipo || '')}&tipoEquipo=${encodeURIComponent(permit.equipoType || '')}`}>
                                                            <Scale className="h-4 w-4 text-purple-600" />
                                                          </Link>
                                                        </Button>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p>Enviar a Solicitud Legal</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                )}
                                             <Button variant="ghost" size="icon" onClick={() => setSelectedPermitForComment({ permit, index })}>
                                                 <MessageSquare className="h-4 w-4" />
                                                 {permit.comments && permit.comments.length > 0 && (
                                                 <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 justify-center text-xs">{permit.comments.length}</Badge>
                                                 )}
                                             </Button>
                                             {needsDetails && (
                                                 <Button type="button" variant="ghost" size="icon" onClick={() => setEditingPermit({ permit, index })}>
                                                   <Settings className="h-4 w-4 text-blue-600" />
                                                 </Button>
                                             )}
                                             <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePermit(index)}>
                                                 <Trash2 className="h-4 w-4 text-destructive" />
                                             </Button>
                                             </div>
                                         </TableCell>
                                     </TableRow>
                                 );
                            })}
                            </TableBody>
                        </Table>
                    </div>
                 ) : <p className="text-sm text-muted-foreground mt-4">No hay permisos requeridos en esta hoja de trabajo.</p>}
            </div>

            <DialogFooter className="pt-6">
                <Button type="button" variant="outline" asChild>
                    <Link href="/executive"><ArrowLeft className="mr-2 h-4 w-4"/> Volver</Link>
                </Button>
            </DialogFooter>
          </form>
        </Form>
        </CardContent>
    </Card>
     {selectedPermitForComment && originalWorksheet && (
        <PermitCommentModal
            isOpen={!!selectedPermitForComment}
            onClose={() => setSelectedPermitForComment(null)}
            permit={selectedPermitForComment.permit}
            worksheetId={originalWorksheet.id}
            onCommentsUpdate={(newComments) => handleUpdatePermitComments(selectedPermitForComment.index, newComments)}
        />
    )}
    {editingPermit && (
        <PermitDetailsModal
            isOpen={!!editingPermit}
            onClose={() => setEditingPermit(null)}
            permit={editingPermit.permit}
            onSave={(updatedDetails) => handleSavePermitDetails(editingPermit.index, updatedDetails)}
        />
    )}
    </>
  );
}
