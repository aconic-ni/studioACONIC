
"use client";
import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, writeBatch, collection, addDoc, Timestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { X, Loader2, PlusCircle, Trash2, CheckSquare, Square, Receipt, Check, ChevronsUpDown, RotateCcw, ArrowLeft, Settings, Edit } from 'lucide-react';
import type { AforoCase, AforoCaseUpdate, RequiredPermit, DocumentStatus, Worksheet, AppUser, WorksheetDocument } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aduanas, aduanaToShortCode, permitOptions, tiposDeclaracion } from '@/lib/formData';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ConsigneeSelector } from '@/components/shared/ConsigneeSelector';
import { useAppContext } from '@/context/AppContext';
import { DatePicker } from '@/components/reports/DatePicker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AppShell } from '@/components/layout/AppShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { PermitDetailsModal } from '@/components/executive/worksheet/PermitDetailsModal';


// Zod Schema Definition
const worksheetDocumentSchema = z.object({
  id: z.string(),
  type: z.string().min(1, "Tipo es requerido."),
  number: z.string().min(1, "Número es requerido."),
  isCopy: z.boolean().default(false),
  status: z.custom<DocumentStatus>().default('Entregado')
});

const requiredPermitSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nombre del permiso es requerido."),
  status: z.custom<DocumentStatus>(),
  facturaNumber: z.string().optional(),
  assignedExecutive: z.string().optional(),
  comments: z.array(z.any()).optional(),
  tramiteDate: z.custom<Timestamp>().optional().nullable(),
  estimatedDeliveryDate: z.custom<Timestamp>().optional().nullable(),
  // Unified field
  tipoTramite: z.string().optional(),
  // INE Specific fields
  item: z.string().optional(),
  marcaEquipo: z.string().optional(),
  modeloEquipo: z.string().optional(),
  equipoType: z.enum(['Refrigerador', 'Aire Acondicionado']).optional(),
});

const worksheetSchema = z.object({
  worksheetType: z.enum(['hoja_de_trabajo', 'anexo_5', 'anexo_7', 'corporate_report']).default('hoja_de_trabajo'),
  ne: z.string().min(1, "El campo NE es requerido."),
  reference: z.string().max(12, "La referencia no puede exceder los 12 caracteres.").optional(),
  executive: z.string().min(1, "Ejecutivo es requerido."),
  consignee: z.string().min(1, "Consignatario es requerido."),
  aforador: z.string().optional(),
  eta: z.date().optional().nullable(),
  appliesTLC: z.boolean().default(false),
  tlcName: z.string().optional(),
  appliesModexo: z.boolean().default(false),
  modexoCode: z.string().optional(),
  facturaNumber: z.string().min(1, "La factura es requerida. Añádala usando el botón 'Añadir Factura'."),
  grossWeight: z.string().optional(),
  netWeight: z.string().optional(),
  description: z.string().min(1, "La descripción es un campo obligatorio."),
  packageNumber: z.string().optional(),
  entryCustoms: z.string().min(1, "Aduana de entrada es requerida."),
  dispatchCustoms: z.string().min(1, "Aduana de despacho es requerida."),
  resa: z.string().optional(),
  transportMode: z.enum(['aereo', 'maritimo', 'frontera', 'terrestre'], {
    required_error: "Debe seleccionar un modo de transporte."
  }),
  inLocalWarehouse: z.boolean().default(false),
  inCustomsWarehouse: z.boolean().default(false),
  location: z.string().optional(),
  documents: z.array(worksheetDocumentSchema),
  requiredPermits: z.array(requiredPermitSchema),
  operationType: z.enum(['importacion', 'exportacion']).optional().nullable(),
  patternRegime: z.string().optional(),
  subRegime: z.string().optional(),
  isJointOperation: z.boolean().default(false),
  jointNe: z.string().optional(),
  jointReference: z.string().optional(),
  dcCorrespondiente: z.string().optional(),
  isSplit: z.boolean().default(false),
  observations: z.string().optional(),
  transportDocumentType: z.enum(['guia_aerea', 'bl', 'carta_porte']).optional().nullable(),
  transportCompany: z.string().optional(),
  transportDocumentNumber: z.string().optional(),
  precinto: z.string().optional(),
  precintoLateral: z.string().optional(),
  vin: z.string().optional(),
})
.refine(data => !(data.inLocalWarehouse || data.inCustomsWarehouse) || (data.location && data.location.trim() !== ''), {
  message: "La localización es requerida si la mercancía está en almacén local o aduana aérea.",
  path: ["location"],
})
.refine(data => !data.isJointOperation || (data.isJointOperation && data.jointNe && data.jointNe.trim() !== ''), {
    message: "El NE mancomunado es requerido.",
    path: ["jointNe"],
})
.refine(data => !data.operationType || (data.operationType && data.patternRegime && data.patternRegime.trim() !== ''), {
    message: "El Modelo (Patrón) es requerido si se especifica un Tipo de Operación.",
    path: ["patternRegime"],
})
.refine(data => {
    if (data.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA") {
      return !!data.aforador && data.aforador.trim() !== '';
    }
    return true;
  }, {
    message: "Debe seleccionar un aforador para PSMT.",
    path: ["aforador"],
});


type WorksheetFormData = z.infer<typeof worksheetSchema>;

function WorksheetForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupMembers, setGroupMembers] = useState<AppUser[]>([]);
  const [aforadores, setAforadores] = useState<AppUser[]>([]);
  const [entryCustomsOpen, setEntryCustomsOpen] = useState(false);
  const [dispatchCustomsOpen, setDispatchCustomsOpen] = useState(false);
  const { setCaseToAssignAforador } = useAppContext();
  const [editingPermit, setEditingPermit] = useState<{ permit: Partial<RequiredPermit>, index: number } | null>(null);
  const [pendingPermitData, setPendingPermitData] = useState<Partial<RequiredPermit> | null>(null);
  const [editingWorksheetId, setEditingWorksheetId] = useState<string | null>(null);
  const [originalWorksheet, setOriginalWorksheet] = useState<Worksheet | null>(null);
  const [tlcNumberInput, setTlcNumberInput] = useState('');
  const [isTransportDocOriginal, setIsTransportDocOriginal] = useState(false);


  const form = useForm<WorksheetFormData>({
    resolver: zodResolver(worksheetSchema),
    defaultValues: {
      worksheetType: 'hoja_de_trabajo',
      ne: '', reference: '', executive: '', consignee: '', eta: null, facturaNumber: '', grossWeight: '', netWeight: '', description: '',
      packageNumber: '', entryCustoms: '', dispatchCustoms: '', resa: '', aforador: '',
      inLocalWarehouse: false, inCustomsWarehouse: false, location: '', documents: [], requiredPermits: [], operationType: null,
      patternRegime: '', subRegime: '', isJointOperation: false, jointNe: '',
      jointReference: '', dcCorrespondiente: '', isSplit: false, observations: '',
      appliesTLC: false, tlcName: '', appliesModexo: false, modexoCode: '',
      transportDocumentType: null, transportCompany: '', transportDocumentNumber: '',
      precinto: '', precintoLateral: '', vin: '',
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
          const data = {id: wsSnap.id, ...wsSnap.data()} as Worksheet;
          setOriginalWorksheet(data);
          // Convert Firestore Timestamps to JS Dates for the form
          const formData: Partial<WorksheetFormData> = {
            ...data,
            eta: data.eta?.toDate(),
            requiredPermits: (data.requiredPermits || []).map((p: any) => ({
              ...p,
              tramiteDate: p.tramiteDate?.toDate(),
              estimatedDeliveryDate: p.estimatedDeliveryDate?.toDate(),
            })),
          };
          form.reset(formData as WorksheetFormData);
        } else {
          toast({ title: 'Error', description: 'No se encontró la hoja de trabajo para editar.', variant: 'destructive'});
        }
      };
      fetchWorksheet();
    }
  }, [searchParams, form, toast]);
  
  const { fields: docFields, append: appendDoc, remove: rhfRemoveDoc, update: updateDocField } = useFieldArray({
    control: form.control, name: "documents",
  });
  const { fields: permitFields, append: appendPermit, remove: removePermit, update: updatePermitField } = useFieldArray({
    control: form.control, name: "requiredPermits",
  });
  
  const watchConsignee = form.watch('consignee');
  const watchInWarehouse = form.watch('inLocalWarehouse');
  const watchInCustoms = form.watch('inCustomsWarehouse');
  const watchTransportMode = form.watch('transportMode');
  const watchOperationType = form.watch('operationType');
  const watchIsJoint = form.watch('isJointOperation');
  const watchAppliesTLC = form.watch('appliesTLC');
  const watchAppliesModexo = form.watch('appliesModexo');
  const watchEntryCustoms = aduanaToShortCode[form.watch('entryCustoms')];
  const watchDispatchCustoms = aduanaToShortCode[form.watch('dispatchCustoms')];
  
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
    if (user?.displayName && !editingWorksheetId) {
      form.setValue('executive', user.displayName);
    }
  }, [user, form, editingWorksheetId]);
  
  useEffect(() => {
    const fetchUsers = async () => {
        if (!user) return;
        const execRoles = ['admin', 'supervisor', 'coordinadora', 'ejecutivo'];
        const isManagement = execRoles.includes(user.role || '');
        if (isManagement) {
            const execQuery = query(collection(db, 'users'), where('role', 'in', ['ejecutivo', 'coordinadora']));
            const querySnapshot = await getDocs(execQuery);
            setGroupMembers(querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
        }
        const aforadorQuery = query(collection(db, "users"), where("role", "in", ["aforador", "supervisor"]));
        const aforadorSnapshot = await getDocs(aforadorQuery);
        setAforadores(aforadorSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    };
    fetchUsers();
  }, [user]);

  const addDocument = () => {
    if (docType.trim() && docNumber.trim()) {
      appendDoc({ id: uuidv4(), type: docType, number: docNumber, isCopy: !isOriginal, status: 'Entregado' });
      setDocType(''); setDocNumber(''); setIsOriginal(false);
    } else {
      toast({ title: "Datos incompletos", variant: "destructive" });
    }
  };

  const handleAddTlc = () => {
    const tlcName = form.getValues('tlcName');
    if (tlcName && tlcNumberInput) {
        appendDoc({ id: uuidv4(), type: `TLC: ${tlcName}`, number: tlcNumberInput, isCopy: !isOriginal, status: 'Entregado'});
        toast({ title: 'TLC añadido a documentos'});
        form.setValue('tlcName', '');
        setTlcNumberInput('');
    } else {
        toast({ title: "Datos incompletos", description: "Ingrese el nombre y número del TLC.", variant: "destructive"});
    }
  };

  const handleAddModexo = () => {
      const modexoCode = form.getValues('modexoCode');
      if (modexoCode) {
          appendDoc({ id: uuidv4(), type: 'MODEXO', number: modexoCode, isCopy: !isOriginal, status: 'Entregado'});
          toast({ title: 'MODEXO añadido a documentos'});
          form.setValue('modexoCode', '');
      } else {
          toast({ title: "Código requerido", description: "Ingrese el código Modexo.", variant: "destructive"});
      }
  };

  const handleAddTransportDoc = () => {
    const { transportDocumentType, transportDocumentNumber, transportCompany } = form.getValues();
    if (transportDocumentType && transportDocumentNumber) {
        const typeLabel = transportDocumentType === 'guia_aerea' ? 'Guía Aérea' : transportDocumentType === 'bl' ? 'BL' : 'Carta de Porte';
        appendDoc({
            id: uuidv4(),
            type: typeLabel,
            number: `${transportDocumentNumber} (${transportCompany || 'N/A'})`,
            isCopy: !isTransportDocOriginal,
            status: 'Entregado'
        });
        toast({ title: 'Documento de transporte añadido' });
    } else {
        toast({ title: "Datos incompletos", description: "Seleccione el tipo e ingrese el número.", variant: "destructive" });
    }
  };


  const removeDoc = (index: number) => {
    const docToRemove = docFields[index];
    if (docToRemove && docToRemove.type === 'FACTURA') {
        const currentFacturas = form.getValues('facturaNumber') || '';
        const facturasArray = currentFacturas.split(';').map(f => f.trim()).filter(f => f);
        const newFacturasArray = facturasArray.filter(f => f !== docToRemove.number);
        form.setValue('facturaNumber', newFacturasArray.join('; '));
    }
    rhfRemoveDoc(index);
  };
  
  const handleAddFactura = () => {
    const facturaNumbers = facturaNumberInput.split(/[,;]/).map(f => f.trim()).filter(f => f);
    if (facturaNumbers.length > 0) {
        let currentFacturas = form.getValues('facturaNumber') || '';
        let facturasArray = currentFacturas ? currentFacturas.split(';').map(f => f.trim()) : [];
        let addedCount = 0;
        facturaNumbers.forEach(facturaNum => {
            if (!facturasArray.includes(facturaNum)) {
                facturasArray.push(facturaNum);
                appendDoc({ id: uuidv4(), type: 'FACTURA', number: facturaNum, isCopy: !facturaIsOriginal, status: 'Entregado'});
                addedCount++;
            }
        });
        form.setValue('facturaNumber', facturasArray.join('; '));
        if (addedCount > 0) {
            toast({ title: `Factura(s) Añadida(s)`, description: `${addedCount} nueva(s) factura(s) registrada(s).` });
        } else {
            toast({ title: "Sin cambios", description: "Las facturas ingresadas ya existían en la lista.", variant: "default" });
        }
        setFacturaPopoverOpen(false);
        setFacturaNumberInput('');
    } else {
        toast({ title: "Número de factura requerido", description: "Ingrese uno o más números de factura.", variant: "destructive" });
    }
  }

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
        setEditingPermit({ permit: permitBaseData, index: -1 }); // Open modal for a new permit
    } else {
        const fullPermitData = { ...permitBaseData, tipoTramite: 'Autorización' } as RequiredPermit;
        if (permitStatus === 'Entregado') {
            appendDoc({ id: uuidv4(), type: finalPermitName, number: 'VER BITACORA', isCopy: false, status: 'Entregado' });
        } else {
            appendPermit(fullPermitData);
        }
        resetPermitInputs();
    }
  };
  
  const handleSavePermitDetails = (index: number, updatedDetails: Partial<RequiredPermit>) => {
    const permitToUpdate = index > -1 ? { ...permitFields[index], ...updatedDetails } : { ...pendingPermitData, ...updatedDetails };

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
  
  const resetPermitInputs = () => {
    setPermitName('');
    setOtherPermitName('');
    setPermitStatus('Pendiente');
    setSelectedFacturaForPermit('');
  };


  const handleResubmitPermit = (index: number) => {
    const currentPermit = form.getValues(`requiredPermits.${index}`);
    form.setValue(`requiredPermits.${index}.status`, 'Sometido de Nuevo');
    toast({ title: "Permiso Reenviado", description: "El estado del permiso se ha actualizado." });
  };


  const onSubmit = async (data: WorksheetFormData) => {
    if (!user || !user.displayName) {
      toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'});
      return;
    }
    if (!data.ne) {
      toast({ title: 'Error', description: 'El campo NE no puede estar vacío.', variant: 'destructive'});
      return;
    }
  
    setIsSubmitting(true);
    
    if (editingWorksheetId) {
      const worksheetDocRef = doc(db, 'worksheets', editingWorksheetId);
      const aforoCaseDocRef = doc(db, 'AforoCases', editingWorksheetId);
      const batch = writeBatch(db);

      try {
        const updatedWorksheetData = { 
            ...data, 
            eta: data.eta ? Timestamp.fromDate(data.eta) : null,
            lastUpdatedAt: Timestamp.now(),
            createdBy: originalWorksheet?.createdBy || user.email // Preserve original creator
        };
        batch.update(worksheetDocRef, updatedWorksheetData);
        batch.update(aforoCaseDocRef, {
            executive: data.executive,
            consignee: data.consignee,
            facturaNumber: data.facturaNumber,
            merchandise: data.description,
            aforador: data.aforador || '',
        });

        const logRef = doc(collection(aforoCaseDocRef, 'actualizaciones'));
        const updateLog: AforoCaseUpdate = {
          updatedAt: Timestamp.now(),
          updatedBy: user.displayName,
          field: 'document_update',
          oldValue: 'worksheet',
          newValue: 'worksheet_updated',
          comment: `Hoja de trabajo modificada por ${user.displayName}.`,
        };
        batch.set(logRef, updateLog);
        
        await batch.commit();
        toast({ title: "Hoja de Trabajo Actualizada", description: `El registro para el NE ${editingWorksheetId} ha sido guardado.` });
        router.push('/executive');

      } catch(serverError: any) {
         const permissionError = new FirestorePermissionError({
          path: `batch update to worksheets/${editingWorksheetId} and AforoCases/${editingWorksheetId}`,
          operation: 'update',
          requestResourceData: { worksheetData: data },
        });
        errorEmitter.emit('permission-error', permissionError);
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
        const createdByInfo = { by: user.displayName, at: creationTimestamp };
  
        const worksheetData: Worksheet = { 
            ...data, 
            id: neTrimmed, 
            ne: neTrimmed, 
            eta: data.eta ? Timestamp.fromDate(data.eta) : null, 
            createdAt: creationTimestamp, 
            createdBy: user.email!, 
            requiredPermits: data.requiredPermits || [], 
            lastUpdatedAt: creationTimestamp 
        };
        batch.set(worksheetDocRef, worksheetData);
  
        const aforoCaseData: Partial<AforoCase> = {
            ne: neTrimmed,
            executive: data.executive,
            consignee: data.consignee,
            facturaNumber: data.facturaNumber,
            declarationPattern: data.patternRegime,
            merchandise: data.description,
            createdBy: user.uid,
            createdAt: creationTimestamp,
            aforador: data.aforador || '',
            assignmentDate: (data.aforador && data.aforador !== '-') ? creationTimestamp : null,
            aforadorStatus: 'Pendiente ',
            aforadorStatusLastUpdate: createdByInfo,
            revisorStatus: 'Pendiente',
            revisorStatusLastUpdate: createdByInfo,
            preliquidationStatus: 'Pendiente',
            preliquidationStatusLastUpdate: createdByInfo,
            digitacionStatus: 'Pendiente',
            digitacionStatusLastUpdate: createdByInfo,
            incidentStatus: 'Pendiente',
            incidentStatusLastUpdate: createdByInfo,
            revisorAsignado: '',
            revisorAsignadoLastUpdate: createdByInfo,
            digitadorAsignado: '',
            digitadorAsignadoLastUpdate: createdByInfo,
            worksheetId: neTrimmed,
            entregadoAforoAt: creationTimestamp,
        };
        batch.set(aforoCaseDocRef, aforoCaseData);
  
        const initialLogRef = doc(collection(aforoCaseDocRef, 'actualizaciones'));
        const initialLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'creation',
            oldValue: null,
            newValue: 'case_created_from_worksheet',
            comment: `Hoja de Trabajo ingresada por ${user.displayName}.`,
        };
        batch.set(initialLogRef, initialLog);
  
        if (data.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA" && (!data.aforador || data.aforador === '-')) {
            setCaseToAssignAforador(aforoCaseData as AforoCase);
        }
  
        await batch.commit();
        toast({ title: "Registro Creado", description: `El registro para el NE ${neTrimmed} ha sido guardado.` });
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
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader><CardTitle className="text-2xl">{editingWorksheetId ? 'Editar' : 'Nueva'} Hoja de Trabajo</CardTitle><CardDescription>{editingWorksheetId ? `Modificando la hoja de trabajo para el NE: ${editingWorksheetId}` : 'Complete la información para generar el registro.'}</CardDescription></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField 
                    control={form.control} 
                    name="ne" 
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>NE</FormLabel>
                            <FormControl><Input {...field} disabled={!!editingWorksheetId} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField control={form.control} name="reference" render={({ field }) => (<FormItem><FormLabel>Referencia</FormLabel><FormControl><Input {...field} maxLength={12} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField
                  control={form.control}
                  name="executive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ejecutivo</FormLabel>
                      {['admin', 'supervisor', 'coordinadora'].includes(user?.role || '') ? (
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                           <FormControl>
                             <SelectTrigger>
                               <SelectValue placeholder="Seleccionar ejecutivo..." />
                             </SelectTrigger>
                           </FormControl>
                           <SelectContent>
                             {groupMembers.map(member => (
                               <SelectItem key={member.uid} value={member.displayName || member.email!}>
                                 {member.displayName || member.email}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                      ) : (
                         <FormControl>
                            <Input {...field} disabled />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    <FormField
                        control={form.control}
                        name="consignee"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Consignatario</FormLabel>
                                <FormControl>
                                    <ConsigneeSelector
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     {watchConsignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA" && (
                        <FormField
                            control={form.control}
                            name="aforador"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Asignar Aforador (para PSMT)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar aforador..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {aforadores.map((aforador) => (
                                    <SelectItem key={aforador.uid} value={aforador.displayName || aforador.email!}>
                                        {aforador.displayName || aforador.email}
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
                </div>
                 <div className="lg:col-span-3">
                    <FormField
                        control={form.control}
                        name="eta"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>ETA (Fecha Estimada de Arribo)</FormLabel>
                                <FormControl>
                                    <DatePicker date={field.value ?? undefined} onDateChange={(date) => field.onChange(date)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-start border-t pt-4">
                  <div className="space-y-4">
                    <FormField control={form.control} name="appliesTLC" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Aplica TLC</FormLabel></FormItem>)} />
                    {watchAppliesTLC && (
                      <div className="space-y-2 pl-4">
                        <FormField control={form.control} name="tlcName" render={({ field }) => (<FormItem><FormLabel>Nombre TLC</FormLabel><FormControl><Input placeholder="Nombre del Tratado" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="flex items-center gap-2">
                            <Input value={tlcNumberInput} onChange={e => setTlcNumberInput(e.target.value)} placeholder="Número de TLC" className="flex-grow" />
                             <div className="flex items-center gap-2 pt-5"><Switch checked={isOriginal} onCheckedChange={setIsOriginal} /><Label>Es Original</Label></div>
                            <Button type="button" size="sm" onClick={handleAddTlc} className="shrink-0">Añadir Doc.</Button>
                        </div>
                      </div>
                    )}
                  </div>
                   <div className="space-y-4">
                      <FormField control={form.control} name="appliesModexo" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Aplica Modexo</FormLabel></FormItem>)} />
                      {watchAppliesModexo && (
                         <div className="space-y-2 pl-4">
                          <FormField control={form.control} name="modexoCode" render={({ field }) => (<FormItem><FormLabel>Código Modexo</FormLabel><FormControl><Input placeholder="Código Modexo" {...field} /></FormControl><FormMessage /></FormItem>)} />
                           <div className="flex items-center gap-2">
                             <div className="flex items-center gap-2 pt-5"><Switch checked={isOriginal} onCheckedChange={setIsOriginal} /><Label>Es Original</Label></div>
                             <Button type="button" size="sm" variant="outline" onClick={handleAddModexo} className="w-full">Añadir Modexo como Documento</Button>
                           </div>
                        </div>
                      )}
                  </div>
                 </div>
                
                <div className="lg:col-span-3">
                    <FormField control={form.control} name="facturaNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Factura</FormLabel>
                            <FormControl><Input {...field} readOnly placeholder="Añada facturas con el botón dedicado. Separe con ; si son varias." className="bg-muted/50 cursor-not-allowed"/></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>

                <FormField control={form.control} name="grossWeight" render={({ field }) => (<FormItem><FormLabel>Peso Bruto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="netWeight" render={({ field }) => (<FormItem><FormLabel>Peso Neto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="packageNumber" render={({ field }) => (<FormItem><FormLabel>Número de Bultos</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 
                 <div className="lg:col-span-3">
                     <FormField
                        control={form.control}
                        name="entryCustoms"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Aduana Entrada</FormLabel>
                                <div className="flex items-center gap-2">
                                    <Popover open={entryCustomsOpen} onOpenChange={setEntryCustomsOpen}>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between truncate",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            {field.value
                                                ? aduanas.find(
                                                    (aduana) => aduana.value === field.value
                                                )?.label
                                                : "Seleccionar aduana..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar aduana..." />
                                            <CommandList>
                                            <CommandEmpty>No se encontró aduana.</CommandEmpty>
                                            <CommandGroup>
                                                {aduanas.map((aduana) => (
                                                <CommandItem
                                                    value={aduana.label}
                                                    key={aduana.value}
                                                    onSelect={() => {
                                                        form.setValue("entryCustoms", aduana.value);
                                                        setEntryCustomsOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        aduana.value === field.value
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                    )}
                                                    />
                                                    {aduana.label}
                                                </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            </CommandList>
                                        </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {watchEntryCustoms && <Badge variant="secondary">{watchEntryCustoms}</Badge>}
                                </div>
                                <FormMessage />
                            </FormItem>
                     )}/>
                 </div>
                 <div className="lg:col-span-3">
                     <FormField
                        control={form.control}
                        name="dispatchCustoms"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Aduana Despacho</FormLabel>
                             <div className="flex items-center gap-2">
                                <Popover open={dispatchCustomsOpen} onOpenChange={setDispatchCustomsOpen}>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between truncate",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value
                                            ? aduanas.find(
                                                (aduana) => aduana.value === field.value
                                            )?.label
                                            : "Seleccionar aduana..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar aduana..." />
                                        <CommandList>
                                        <CommandEmpty>No se encontró aduana.</CommandEmpty>
                                        <CommandGroup>
                                        {aduanas.map((aduana) => (
                                            <CommandItem
                                            value={aduana.label}
                                            key={aduana.value}
                                            onSelect={() => {
                                                form.setValue("dispatchCustoms", aduana.value);
                                                setDispatchCustomsOpen(false);
                                            }}
                                            >
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                aduana.value === field.value
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                                )}
                                            />
                                            {aduana.label}
                                            </CommandItem>
                                        ))}
                                        </CommandGroup>
                                        </CommandList>
                                    </Command>
                                    </PopoverContent>
                                </Popover>
                                {watchDispatchCustoms && <Badge variant="secondary">{watchDispatchCustoms}</Badge>}
                            </div>
                            <FormMessage />
                        </FormItem>
                     )}/>
                 </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <FormField control={form.control} name="transportMode" render={({ field }) => (
                     <FormItem className="space-y-3"><FormLabel>Modo de Transporte</FormLabel><FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value ?? ""} className="flex flex-wrap gap-4">
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="aereo" /></FormControl><FormLabel className="font-normal">Aéreo</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="maritimo" /></FormControl><FormLabel className="font-normal">Marítimo</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="frontera" /></FormControl><FormLabel className="font-normal">Frontera</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="terrestre" /></FormControl><FormLabel className="font-normal">Terrestre</FormLabel></FormItem>
                        </RadioGroup>
                     </FormControl><FormMessage /></FormItem>
                )}/>
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                       <FormField control={form.control} name="inLocalWarehouse" render={({ field }) => (
                         <FormItem className="flex flex-row items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>En Almacén Local</FormLabel></FormItem>
                       )}/>
                        <FormField control={form.control} name="inCustomsWarehouse" render={({ field }) => (
                         <FormItem className="flex flex-row items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>En Aduana Aérea</FormLabel></FormItem>
                       )}/>
                    </div>
                   {(watchInWarehouse || watchInCustoms) && <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormControl><Input placeholder="Especifique localización..." {...field} /></FormControl><FormMessage /></FormItem>)}/>}
                </div>
            </div>
             {(watchInWarehouse || watchInCustoms || watchTransportMode === 'aereo') && (
                 <FormField
                    control={form.control}
                    name="resa"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>RESA</FormLabel>
                            <FormControl><Input {...field} placeholder="Número de RESA" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
             )}
            
            <div className="lg:col-span-3 pt-4 border-t">
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Descripción de la Mercancía *</FormLabel>
                        <FormControl><Textarea rows={3} placeholder="Breve descripción de la mercancía" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>

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
                                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
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
                            <FormItem><FormLabel>Compañía</FormLabel><FormControl><Input {...field} placeholder="Nombre de la compañía" /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField
                            control={form.control}
                            name="transportDocumentNumber"
                            render={({ field }) => (
                            <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} placeholder="Número del documento" /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center space-x-2">
                           <Switch id="transport-original" checked={isTransportDocOriginal} onCheckedChange={setIsTransportDocOriginal} />
                           <Label htmlFor="transport-original">Es Original</Label>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={handleAddTransportDoc}>Añadir a Documentos</Button>
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
                    <TableBody>{docFields.map((field, index) => (<TableRow key={field.id}><TableCell>{field.type}</TableCell><TableCell>{field.number}</TableCell><TableCell>
                        <div className="flex items-center gap-2">
                            <Switch
                                id={`isCopy-${field.id}`}
                                checked={!field.isCopy}
                                onCheckedChange={(checked) => {
                                    const newIsCopy = !checked;
                                    updateDocField(index, { ...field, isCopy: newIsCopy });
                                }}
                            />
                            <Label htmlFor={`isCopy-${field.id}`}>{field.isCopy ? 'Copia' : 'Original'}</Label>
                        </div>
                    </TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}</TableBody>
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
                 {permitFields.length > 0 && (
                    <div className="rounded-md border mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Permiso</TableHead>
                                    <TableHead>Factura</TableHead>
                                    <TableHead>Asignado A</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {permitFields.map((field, index) => {
                                const needsDetails = ['Dictamen Tecnico INE', 'IPSA', 'MINSA', 'TELCOR'].includes(field.name);
                                return (
                                <TableRow key={field.id}>
                                    <TableCell>{field.name}</TableCell>
                                    <TableCell>{field.facturaNumber || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Controller
                                            control={form.control}
                                            name={`requiredPermits.${index}.assignedExecutive`}
                                            render={({ field: controllerField }) => (
                                            <Select onValueChange={controllerField.onChange} value={controllerField.value || user?.displayName || ''}>
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
                                        <Controller
                                            control={form.control}
                                            name={`requiredPermits.${index}.status`}
                                            render={({ field: controllerField }) => (
                                            <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                                                    <SelectItem value="En Trámite">En Trámite</SelectItem>
                                                    <SelectItem value="Entregado">Entregado</SelectItem>
                                                    <SelectItem value="Rechazado">Rechazado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {needsDetails && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setEditingPermit({ permit: field, index })}>
                                              <Settings className="h-4 w-4 text-blue-600" />
                                            </Button>
                                          )}
                                          <Button type="button" variant="ghost" size="icon" onClick={() => removePermit(index)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )})}</TableBody>
                        </Table>
                    </div>
                 )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <FormField control={form.control} name="operationType" render={({ field }) => (
                     <FormItem className="space-y-3"><FormLabel>Tipo de Operación</FormLabel><FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value ?? ""} className="flex gap-4">
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="importacion" /></FormControl><FormLabel className="font-normal">Importación</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="exportacion" /></FormControl><FormLabel className="font-normal">Exportación</FormLabel></FormItem>
                        </RadioGroup>
                     </FormControl><FormMessage /></FormItem>
                )}/>
                {watchOperationType && (
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="patternRegime"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Modelo (Patrón)</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                                >
                                                    {field.value
                                                        ? tiposDeclaracion.find(
                                                            (tipo) => tipo.value === field.value
                                                        )?.value
                                                        : "Seleccionar..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Buscar por código..." />
                                                <CommandList>
                                                    <CommandEmpty>No se encontró el modelo.</CommandEmpty>
                                                    <CommandGroup>
                                                        {tiposDeclaracion.map(tipo => (
                                                            <CommandItem
                                                                value={tipo.value}
                                                                key={tipo.value}
                                                                onSelect={() => {
                                                                    form.setValue("patternRegime", tipo.value);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", tipo.value === field.value ? "opacity-100" : "opacity-0")} />
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold">{tipo.value}</span>
                                                                    <span className="text-xs text-muted-foreground">{tipo.label}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField control={form.control} name="subRegime" render={({ field }) => (<FormItem><FormLabel>Sub-Régimen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    </div>
                )}
            </div>

            <div className="space-y-4 pt-4 border-t">
                <FormField control={form.control} name="isJointOperation" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl><FormLabel>Operación Mancomunada</FormLabel></FormItem>
                )}/>
                {watchIsJoint && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="jointNe" render={({ field }) => (<FormItem><FormLabel>NE Mancomunado</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="jointReference" render={({ field }) => (<FormItem><FormLabel>Referencia Mancomunada</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    </div>
                )}
            </div>
            
             <div className="flex items-end gap-6 pt-4">
                <FormField control={form.control} name="dcCorrespondiente" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Ingresar DC Correspondiente" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="isSplit" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 pb-2">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="is-split"/></FormControl>
                        <FormLabel htmlFor="is-split" className="text-sm font-normal">Es Split</FormLabel>
                    </FormItem>
                )}/>
            </div>

            <div className="pt-4 border-t">
                <FormField control={form.control} name="observations" render={({ field }) => (
                    <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} placeholder="Añada cualquier observación adicional aquí..."/></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
            <div className="flex justify-end gap-2 pt-6">
                <Button type="button" variant="outline" asChild>
                  <Link href="/executive"><ArrowLeft className="mr-2 h-4 w-4"/> Volver</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Hoja de Trabajo
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
    {editingPermit && (
        <PermitDetailsModal
            isOpen={!!editingPermit}
            onClose={() => setEditingPermit(null)}
            permit={editingPermit.permit}
            onSave={(updatedDetails) => handleSavePermitDetails(editingPermit.index, updatedDetails)}
        />
    )}
    </>
  )
}

export default function WorksheetPage() {
    return (
        <AppShell>
            <div className="py-2 md:py-5">
                <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
                    <WorksheetForm />
                </Suspense>
            </div>
        </AppShell>
    )
}
