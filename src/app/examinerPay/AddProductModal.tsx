
"use client";
import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppContext } from '@/context/AppContext';
import type { SolicitudFormData } from './FormParts/zodSchemas';
import { solicitudSchema } from './FormParts/zodSchemas';
import type { SolicitudData } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { X, Hash, FileText, Tag, Landmark, Mail, FilePlus, DollarSign, ListFilter, Building, Code, MessageSquare, Banknote, User, Info, Settings2, Users, CalendarDays, Package, Search, Trash2, UserPlus } from 'lucide-react';
import { numeroALetras } from '@/lib/numeroALetras';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';


// Define the structure for the account registry
interface AccountRegistryEntry {
  id: string; // e.g., "1", "2", ... "30"
  name: string;
  accountNumber: string;
}

// Predefined account registry data
const accountRegistryData: AccountRegistryEntry[] = [
{ id: "1", name: "apen Bancentro C$", accountNumber: "240200457" },
{ id: "2", name: "DHL Bancentro C$", accountNumber: "100202913" },
{ id: "3", name: "OIRSA Bancentro C$", accountNumber: "100204959" },
{ id: "4", name: "OIRSA Bancentro $", accountNumber: "101207188" },
{ id: "5", name: "IPSA Bancentro C$", accountNumber: "100202228" },
{ id: "6", name: "IPSA Bancentro $", accountNumber: "101202103" },
{ id: "7", name: "EPN Bancentro C$", accountNumber: "500200987" },
{ id: "8", name: "EPN El Rama Bancentro C$", accountNumber: "800200156" },
{ id: "9", name: "TLA C$", accountNumber: "000257295" },
{ id: "10", name: "MSC BAC $", accountNumber: "360268908" },
{ id: "11", name: "IML SEQUEIRA HRZ Ltd. Bancentro C$", accountNumber: "100238209" },
{ id: "12", name: "COPA BAC C$", accountNumber: "154110054" },
{ id: "13", name: "Amerijet BAC C$", accountNumber: "356228338" },
{ id: "14", name: "Hapag-Lloyd Bancentro $", accountNumber: "761600095" },
{ id: "15", name: "SERMASA Bancentro $", accountNumber: "761602861" },
{ id: "16", name: "FEDEX Cordoba C$", accountNumber: "220200035" },
{ id: "17", name: "Bomberos Banpro $", accountNumber: "10012403047675" },
{ id: "18", name: "TELCOR BAC C$", accountNumber: "000263756" },
{ id: "19", name: "TELCOR BAC $", accountNumber: "000263749" },
{ id: "20", name: "Cuenta Principal C$", accountNumber: "00000000" },
{ id: "21", name: "Cuenta Principal C$", accountNumber: "00000000" },
{ id: "22", name: "Cuenta Principal C$", accountNumber: "00000000" },
{ id: "23", name: "Cuenta Principal C$", accountNumber: "00000000" },
{ id: "24", name: "Cuenta Principal C$", accountNumber: "00000001" },
{ id: "25", name: "Cuenta Principal C$", accountNumber: "00000002" },
{ id: "26", name: "Cuenta Principal C$", accountNumber: "00000003" },
{ id: "27", name: "Cuenta Principal C$", accountNumber: "00000004" },
{ id: "28", name: "Cuenta Principal C$", accountNumber: "00000005" },
{ id: "29", name: "Cuenta Principal C$", accountNumber: "00000006" },
{ id: "30", name: "Cuenta Principal C$", accountNumber: "00000007" },
];


export function AddProductModal() {
  const {
    isAddProductModalOpen,
    closeAddProductModal,
    addSolicitud,
    updateSolicitud,
    editingSolicitud,
    initialContextData,
    isMemorandumMode,
    resetApp,
  } = useAppContext();
  const { user } = useAuth();
  const [showBancoOtros, setShowBancoOtros] = useState(false);
  const [showMonedaCuentaOtros, setShowMonedaCuentaOtros] = useState(false);
  const [showOtrosTipoServicio, setShowOtrosTipoServicio] = useState(false);
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null);
  const router = useRouter();


  const form = useForm<SolicitudFormData>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: { 
      monto: 0,
      montoMoneda: 'cordoba',
      cantidadEnLetras: '',
      consignatario: '',
      declaracionNumero: '',
      unidadRecaudadora: '',
      codigo1: '',
      codigo2: '',
      banco: undefined,
      bancoOtros: '',
      numeroCuenta: '',
      monedaCuenta: undefined,
      monedaCuentaOtros: '',
      elaborarChequeA: '',
      elaborarTransferenciaA: '',
      impuestosPagadosCliente: false,
      impuestosPagadosRC: '',
      impuestosPagadosTB: '',
      impuestosPagadosCheque: '',
      impuestosPendientesCliente: false,
      soporte: false,
      documentosAdjuntos: false,
      constanciasNoRetencion: false,
      constanciasNoRetencion1: false,
      constanciasNoRetencion2: false,
      pagoServicios: false,
      tipoServicio: undefined,
      otrosTipoServicio: '',
      facturaServicio: '',
      institucionServicio: '',
      correo: user?.email || '',
      observation: '',
      memorandumCollaborators: [],
    }
  });

  const { fields: collaboratorFields, append: appendCollaborator, remove: removeCollaborator } = useFieldArray({
    control: form.control,
    name: "memorandumCollaborators",
  });

  const watchedBanco = form.watch("banco");
  const watchedMonedaCuenta = form.watch("monedaCuenta");
  const watchedImpuestosPagados = form.watch("impuestosPagadosCliente");
  const watchedConstanciasNoRetencion = form.watch("constanciasNoRetencion");
  const watchedMonto = form.watch("monto");
  const watchedMontoMoneda = form.watch("montoMoneda");
  const watchedPagoServicios = form.watch("pagoServicios");
  const watchedTipoServicio = form.watch("tipoServicio");

  const sanitizeMontoInput = (inputValue: string | number | undefined): string => {
    if (inputValue === undefined || inputValue === null) return '';
    let value = String(inputValue); 

    // Allow only digits and a single dot
    value = value.replace(/[^0-9.]/g, '');

    const dotIndex = value.indexOf('.');
    if (dotIndex !== -1) {
      const beforeDot = value.substring(0, dotIndex + 1);
      const afterDot = value.substring(dotIndex + 1).replace(/\./g, ''); 
      value = beforeDot + afterDot;
    }

    if (dotIndex !== -1) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].substring(0, 2);
      }
    }
    return value;
  };


  useEffect(() => {
    const montoForConversion = watchedMonto; 

    if (montoForConversion !== undefined && montoForConversion > 0 && watchedMontoMoneda) {
      const letras = numeroALetras(montoForConversion, watchedMontoMoneda);
      form.setValue('cantidadEnLetras', letras, { shouldValidate: true });
    } else {
      form.setValue('cantidadEnLetras', '', { shouldValidate: true });
    }
  }, [watchedMonto, watchedMontoMoneda, form]);

  useEffect(() => {
    setShowBancoOtros(watchedBanco === 'Otros');
    if (watchedBanco === 'ACCION POR CHEQUE/NO APLICA BANCO') {
      form.setValue('bancoOtros', '');
      form.setValue('numeroCuenta', '');
      form.setValue('monedaCuenta', undefined);
      form.setValue('monedaCuentaOtros', '');
      setShowMonedaCuentaOtros(false);
      setSelectedAccountName(null); 
    }
  }, [watchedBanco, form]);

  useEffect(() => {
    setShowMonedaCuentaOtros(watchedMonedaCuenta === 'Otros');
  }, [watchedMonedaCuenta]);

  useEffect(() => {
    setShowOtrosTipoServicio(watchedTipoServicio === 'OTROS');
  }, [watchedTipoServicio]);


  useEffect(() => {
    if (isAddProductModalOpen) {
      const defaultCorreo = user?.email || '';
      const initialValues: SolicitudFormData = {
        monto: 0, 
        montoMoneda: 'cordoba',
        cantidadEnLetras: '',
        consignatario: initialContextData?.consignee || '',
        declaracionNumero: initialContextData?.declaracionAduanera || '',
        unidadRecaudadora: '',
        codigo1: '',
        codigo2: '',
        banco: undefined,
        bancoOtros: '',
        numeroCuenta: '',
        monedaCuenta: undefined,
        monedaCuentaOtros: '',
        elaborarChequeA: '',
        elaborarTransferenciaA: '',
        impuestosPagadosCliente: false,
        impuestosPagadosRC: '',
        impuestosPagadosTB: '',
        impuestosPagadosCheque: '',
        impuestosPendientesCliente: false,
        soporte: false,
        documentosAdjuntos: false,
        constanciasNoRetencion: false,
        constanciasNoRetencion1: false,
        constanciasNoRetencion2: false,
        pagoServicios: false,
        tipoServicio: undefined,
        otrosTipoServicio: '',
        facturaServicio: '',
        institucionServicio: '',
        correo: defaultCorreo,
        observation: '',
        memorandumCollaborators: [],
      };

      setSelectedAccountName(null); 

      if (editingSolicitud) {
        const montoForForm = editingSolicitud.monto ?? 0;
        
        const populatedEditingSolicitud: SolicitudFormData = {
          ...initialValues,
          ...editingSolicitud,
          monto: montoForForm,
          correo: editingSolicitud.correo || defaultCorreo,
          soporte: editingSolicitud.soporte ?? false,
          pagoServicios: editingSolicitud.pagoServicios ?? false,
          impuestosPagadosCliente: editingSolicitud.impuestosPagadosCliente ?? false,
          impuestosPendientesCliente: editingSolicitud.impuestosPendientesCliente ?? false,
          documentosAdjuntos: editingSolicitud.documentosAdjuntos ?? false,
          constanciasNoRetencion: editingSolicitud.constanciasNoRetencion ?? false,
          constanciasNoRetencion1: editingSolicitud.constanciasNoRetencion1 ?? false,
          constanciasNoRetencion2: editingSolicitud.constanciasNoRetencion2 ?? false,
          banco: editingSolicitud.banco || undefined,
          monedaCuenta: editingSolicitud.monedaCuenta || undefined,
          tipoServicio: editingSolicitud.tipoServicio as SolicitudFormData['tipoServicio'] || undefined,
          memorandumCollaborators: editingSolicitud.memorandumCollaborators || [],
        };

        form.reset(populatedEditingSolicitud);
        setShowBancoOtros(editingSolicitud.banco === 'Otros');
        setShowMonedaCuentaOtros(editingSolicitud.monedaCuenta === 'Otros');
        setShowOtrosTipoServicio(editingSolicitud.tipoServicio === 'OTROS');

        if (montoForForm > 0 && populatedEditingSolicitud.montoMoneda) {
          const letras = numeroALetras(montoForForm, populatedEditingSolicitud.montoMoneda);
          form.setValue('cantidadEnLetras', letras, { shouldValidate: false }); 
        } else {
            form.setValue('cantidadEnLetras', '', { shouldValidate: false });
        }
        const matchingAccount = accountRegistryData.find(acc => acc.accountNumber === editingSolicitud.numeroCuenta);
        if (matchingAccount) {
            setSelectedAccountName(matchingAccount.name);
        }

      } else {
        form.reset(initialValues);
        setShowBancoOtros(false);
        setShowMonedaCuentaOtros(false);
        setShowOtrosTipoServicio(false);
      }
    }
  }, [editingSolicitud, form, isAddProductModalOpen, user, initialContextData]);

  const handleAccountRegistrySelect = (value: string) => {
    const selectedId = value;
    const selectedEntry = accountRegistryData.find(entry => entry.id === selectedId);
    if (selectedEntry) {
      form.setValue('numeroCuenta', selectedEntry.accountNumber, { shouldValidate: true });
      setSelectedAccountName(selectedEntry.name);
    } else {
      setSelectedAccountName(null);
    }
  };

  const handleCancel = () => {
    closeAddProductModal();
    resetApp();
    router.push('/');
  };

  function onSubmit(data: SolicitudFormData) {
    const solicitudDataToSave: Omit<SolicitudData, 'id'> & { id?: string, isMemorandum?: boolean } = {
        ...data,
        monto: data.monto,
        soporte: data.soporte ?? false,
        pagoServicios: data.pagoServicios ?? false,
        montoMoneda: data.montoMoneda as SolicitudData['montoMoneda'],
        banco: data.banco as SolicitudData['banco'],
        monedaCuenta: data.monedaCuenta as SolicitudData['monedaCuenta'],
        tipoServicio: data.tipoServicio as SolicitudData['tipoServicio'],
        isMemorandum: isMemorandumMode,
        memorandumCollaborators: data.memorandumCollaborators || []
    };

    if (editingSolicitud && editingSolicitud.id) {
        updateSolicitud({ ...solicitudDataToSave, id: editingSolicitud.id } as SolicitudData);
    } else {
        addSolicitud(solicitudDataToSave as Omit<SolicitudData, 'id'>);
    }
    closeAddProductModal();
}

  if (!isAddProductModalOpen) return null;

  const isBancoNoAplica = watchedBanco === 'ACCION POR CHEQUE/NO APLICA BANCO';

  const idPlaceholder = editingSolicitud
    ? editingSolicitud.id
    : initialContextData?.ne 
        ? `${initialContextData.ne}-AAAAmmdd-HHmmss (Al guardar)` 
        : "ID (Se generará al guardar)";


  return (
    <Dialog open={isAddProductModalOpen} onOpenChange={(open) => !open && closeAddProductModal()}>
      <DialogContent className="max-w-4xl w-full p-0">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {editingSolicitud ? 'Editar Solicitud' : 'Nueva Solicitud'}
                {isMemorandumMode && <Badge variant="destructive" className="ml-3 align-middle">Memorandum</Badge>}
              </DialogTitle>
              <button
                onClick={closeAddProductModal}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                aria-label="Cerrar"
              >
                <X className="h-6 w-6 text-muted-foreground" />
              </button>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {Object.keys(form.formState.errors).length > 0 && (
                  <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/30" role="alert">
                    <p className="font-bold">Por favor, corrija los siguientes errores:</p>
                    <ul className="list-disc list-inside mt-1">
                      {Object.entries(form.formState.errors).map(([fieldName, errorObject]) => {
                        const fieldError = errorObject as any; 
                        if (fieldError && fieldError.message) {
                          let readableFieldName = fieldName;
                          const fieldNameMap: { [key: string]: string } = {
                            monto: "Monto",
                            montoMoneda: "Moneda del Monto",
                            cantidadEnLetras: "Cantidad en Letras",
                            consignatario: "Consignatario",
                            declaracionNumero: "Declaración Número",
                            unidadRecaudadora: "Unidad Recaudadora",
                            codigo1: "Código 1",
                            codigo2: "Codigo MUR",
                            banco: "Banco",
                            bancoOtros: "Otro Banco",
                            numeroCuenta: "Número de Cuenta",
                            monedaCuenta: "Moneda de la Cuenta",
                            monedaCuentaOtros: "Otra Moneda de Cuenta",
                            elaborarChequeA: "Elaborar Cheque A",
                            elaborarTransferenciaA: "Elaborar Transferencia A",
                            impuestosPagadosRC: "R/C (Impuestos Pagados)",
                            impuestosPagadosTB: "T/B (Impuestos Pagados)",
                            impuestosPagadosCheque: "Cheque (Impuestos Pagados)",
                            correo: "Correo",
                            observation: "Observación",
                            tipoServicio: "Tipo de Servicio",
                            otrosTipoServicio: "Especifique Otro Tipo de Servicio",
                            facturaServicio: "Factura (Servicio)",
                            institucionServicio: "Institución (Servicio)",
                          };
                          readableFieldName = fieldNameMap[fieldName] || fieldName.replace(/([A-Z])/g, ' $1').toLowerCase();

                          return (
                            <li key={fieldName}>
                              <span className="capitalize">{readableFieldName}</span>: {fieldError.message}
                            </li>
                          );
                        }
                        return null;
                      })}
                    </ul>
                  </div>
                )}

                {isMemorandumMode && (
                  <div className="space-y-4 p-4 border border-destructive/50 rounded-md bg-destructive/5">
                      <h4 className="text-md font-medium text-destructive mb-2">Colaboradores del Memorandum</h4>
                      {collaboratorFields.map((field, index) => (
                          <div key={field.id} className="flex items-end gap-3 p-3 border rounded-md">
                              <FormField
                                  control={form.control}
                                  name={`memorandumCollaborators.${index}.name`}
                                  render={({ field }) => (
                                      <FormItem className="flex-grow">
                                          <FormLabel className="text-xs">Nombre del Colaborador</FormLabel>
                                          <FormControl><Input {...field} placeholder="Nombre completo" /></FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}
                              />
                              <FormField
                                  control={form.control}
                                  name={`memorandumCollaborators.${index}.number`}
                                  render={({ field }) => (
                                      <FormItem className="flex-grow">
                                          <FormLabel className="text-xs">Número de Colaborador</FormLabel>
                                          <FormControl><Input {...field} placeholder="ID o número" /></FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}
                              />
                              <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => removeCollaborator(index)}
                                  className="h-9 w-9 shrink-0"
                              >
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                      ))}
                      <Button
                          type="button"
                          variant="outline"
                          onClick={() => appendCollaborator({ id: uuidv4(), name: '', number: '' })}
                          className="mt-2"
                      >
                          <UserPlus className="mr-2 h-4 w-4" /> Añadir Colaborador
                      </Button>
                  </div>
                )}

                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="text-md font-medium text-primary mb-2">Detalles del Monto</h4>
                  <FormField control={form.control} name="monto" render={({ field }) => ( 
                    <FormItem>
                      <FormLabel className="flex items-center text-sm text-foreground">
                        <DollarSign className="mr-2 h-4 w-4 text-primary" />
                        Por este medio me dirijo a usted para solicitarle que elabore cheque por la cantidad de:
                      </FormLabel>
                      <div className="flex gap-2 items-center">
                        <FormControl>
                          <Input
                            type="text" 
                            inputMode="decimal"
                            placeholder="0.00"
                            value={field.value ?? ''}
                            onChange={(e) => {
                                const sanitized = sanitizeMontoInput(e.target.value);
                                field.onChange(sanitized);
                            }}
                            className="w-2/3"
                          />
                        </FormControl>
                        <FormField control={form.control} name="montoMoneda" render={({ field: selectField }) => (
                          <Select onValueChange={selectField.onChange} value={selectField.value || 'cordoba'}>
                            <FormControl><SelectTrigger className="w-1/3"><SelectValue placeholder="Moneda" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="cordoba">C$ (Córdobas)</SelectItem>
                              <SelectItem value="dolar">US$ (Dólares)</SelectItem>
                              <SelectItem value="euro">€ (Euros)</SelectItem>
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cantidadEnLetras" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-foreground"><FileText className="mr-2 h-4 w-4 text-primary" />Cantidad en letras</FormLabel>
                      <FormControl><Textarea rows={2} placeholder="Generado automáticamente..." {...field} value={field.value ?? ''} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="text-md font-medium text-primary mb-2">Información Adicional de Solicitud</h4>
                   <FormField control={form.control} name="consignatario" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-foreground"><Users className="mr-2 h-4 w-4 text-primary" />Consignatario</FormLabel>
                      <FormControl><Input placeholder="Nombre del consignatario" {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="declaracionNumero" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-foreground"><Hash className="mr-2 h-4 w-4 text-primary" />Declaracion Número</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="unidadRecaudadora" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-foreground"><Building className="mr-2 h-4 w-4 text-primary" />Unidad recaudadora</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="codigo1" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-foreground"><Code className="mr-2 h-4 w-4 text-primary" />Codigo 1</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="codigo2" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-foreground"><Code className="mr-2 h-4 w-4 text-primary" />Codigo MUR</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="text-md font-medium text-primary mb-3">Cuenta</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <FormField control={form.control} name="banco" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-foreground"><Landmark className="mr-2 h-4 w-4 text-primary" />Banco</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un banco" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {["BAC", "BANPRO", "BANCENTRO", "FICOSHA", "AVANZ", "ATLANTIDA", "ACCION POR CHEQUE/NO APLICA BANCO", "Otros"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {showBancoOtros && !isBancoNoAplica && (
                      <FormField control={form.control} name="bancoOtros" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-foreground"><FilePlus className="mr-2 h-4 w-4 text-primary" />Especifique Otro Banco</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                     <FormField control={form.control} name="monedaCuenta" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-foreground"><Banknote className="mr-2 h-4 w-4 text-primary" />Moneda de la cuenta</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isBancoNoAplica}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccione moneda" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="cordoba">C$ (Córdobas)</SelectItem>
                            <SelectItem value="dolar">US$ (Dólares)</SelectItem>
                            <SelectItem value="euro">€ (Euros)</SelectItem>
                            <SelectItem value="Otros">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {showMonedaCuentaOtros && !isBancoNoAplica && (
                      <FormField control={form.control} name="monedaCuentaOtros" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-foreground"><FilePlus className="mr-2 h-4 w-4 text-primary" />Especifique Otra Moneda</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <FormField control={form.control} name="numeroCuenta" render={({ field }) => (
                      <FormItem className="md:col-span-2"> 
                        <FormLabel className="flex items-center text-foreground"><ListFilter className="mr-2 h-4 w-4 text-primary" />Numero de cuenta</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} disabled={isBancoNoAplica} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {!isBancoNoAplica && (
                    <div className="mt-4 space-y-2">
                      <Label className="flex items-center text-foreground"><Search className="mr-2 h-4 w-4 text-primary" />Registro de cuentas</Label>
                      <TooltipProvider>
                        <div className="flex items-center gap-3">
                          <Select onValueChange={handleAccountRegistrySelect} value={accountRegistryData.find(acc => acc.accountNumber === form.getValues("numeroCuenta"))?.id || ""}>
                            <SelectTrigger className="w-[180px] flex-shrink-0">
                              <SelectValue placeholder="Reg. #" />
                            </SelectTrigger>
                            <SelectContent>
                              {accountRegistryData.map(entry => (
                                <Tooltip key={entry.id}>
                                  <TooltipTrigger asChild>
                                    <SelectItem value={entry.id}>
                                      {entry.id} - {entry.name}
                                    </SelectItem>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" align="start">
                                    <p className="text-xs">{entry.name}</p>
                                    <p className="text-xs text-muted-foreground">{entry.accountNumber}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="text"
                            value={selectedAccountName || "Nombre del registro"}
                            readOnly
                            disabled
                            className="flex-grow bg-muted/50 cursor-not-allowed"
                          />
                        </div>
                      </TooltipProvider>
                    </div>
                  )}
                </div>


                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="text-md font-medium text-primary mb-2">Beneficiario del Pago</h4>
                  <FormField control={form.control} name="elaborarChequeA" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-foreground"><Tag className="mr-2 h-4 w-4 text-primary" />Elaborar cheque a</FormLabel>
                      <FormControl><Input {...field} placeholder="Nombre del beneficiario del cheque" value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="elaborarTransferenciaA" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-foreground"><Tag className="mr-2 h-4 w-4 text-primary" />Elaborar transferencia a</FormLabel>
                      <FormControl><Input {...field} placeholder="Nombre del beneficiario de la transferencia" value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="text-md font-medium text-primary mb-3">Detalles Adicionales y Documentación</h4>
                   <FormField control={form.control} name="impuestosPendientesCliente" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-normal text-foreground">Impuestos pendientes de pago por el cliente</FormLabel>
                    </FormItem>
                  )} />
                   <FormField control={form.control} name="soporte" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-normal text-foreground">Soporte</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="impuestosPagadosCliente" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-normal text-foreground">Impuestos pagados por el cliente mediante:</FormLabel>
                    </FormItem>
                  )} />
                  {watchedImpuestosPagados && (
                    <div className="ml-8 mt-2 space-y-3 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border rounded-md bg-secondary/30">
                      <FormField
                        control={form.control}
                        name="impuestosPagadosRC"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs h-5 flex items-center">R/C</FormLabel>
                            <FormControl><Input placeholder="No. R/C" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      <FormField
                        control={form.control}
                        name="impuestosPagadosTB"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs h-5 flex items-center">T/B</FormLabel>
                            <FormControl><Input placeholder="No. T/B" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      <FormField
                        control={form.control}
                        name="impuestosPagadosCheque"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs h-5 flex items-center">Cheque</FormLabel>
                            <FormControl><Input placeholder="No. Cheque" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                    </div>
                  )}


                  <FormField control={form.control} name="documentosAdjuntos" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-normal text-foreground">Se añaden documentos adjuntos</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="constanciasNoRetencion" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-normal text-foreground">Constancias de no retencion</FormLabel>
                    </FormItem>
                  )} />
                  {watchedConstanciasNoRetencion && (
                    <div className="ml-8 mt-2 space-x-6 flex p-3 border rounded-md bg-secondary/30">
                      <FormField control={form.control} name="constanciasNoRetencion1" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-sm font-normal text-foreground">1%</FormLabel>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="constanciasNoRetencion2" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-sm font-normal text-foreground">2%</FormLabel>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="text-md font-medium text-primary mb-3">Pago de Servicios</h4>
                  <FormField control={form.control} name="pagoServicios" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-normal text-foreground">Habilitar Pago de Servicios</FormLabel>
                    </FormItem>
                  )} />
                  {watchedPagoServicios && (
                    <div className="ml-8 mt-2 space-y-3 grid grid-cols-1 md:grid-cols-2 gap-4 p-3 border rounded-md bg-secondary/30">
                      <FormField control={form.control} name="tipoServicio" render={({ field: selectField }) => (
                        <FormItem className={showOtrosTipoServicio ? 'md:col-span-1' : 'md:col-span-2'}>
                          <FormLabel className="flex items-center text-foreground"><Package className="mr-2 h-4 w-4 text-primary" />Tipo</FormLabel>
                          <Select 
                            onValueChange={(value) => selectField.onChange(value as SolicitudFormData['tipoServicio'])} 
                            value={selectField.value}
                          >
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione tipo de servicio" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="COMIECO">COMIECO</SelectItem>
                              <SelectItem value="MARCHAMO">MARCHAMO</SelectItem>
                              <SelectItem value="FUMIGACION">FUMIGACION</SelectItem>
                              <SelectItem value="RECORRIDO">RECORRIDO</SelectItem>
                              <SelectItem value="EPN">EPN</SelectItem>
                              <SelectItem value="ANALISIS_Y_LABORATORIO">ANALISIS Y LABORATORIO</SelectItem>
                              <SelectItem value="OTROS">OTROS</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      {showOtrosTipoServicio && (
                        <FormField control={form.control} name="otrosTipoServicio" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center text-foreground"><FilePlus className="mr-2 h-4 w-4 text-primary" />Especifique Otro Tipo</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={form.control} name="facturaServicio" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-foreground"><FileText className="mr-2 h-4 w-4 text-primary" />Factura</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="institucionServicio" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-foreground"><Building className="mr-2 h-4 w-4 text-primary" />Institución</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="text-md font-medium text-primary mb-2">Comunicación y Observaciones</h4>
                  <FormField control={form.control} name="correo" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-foreground"><Mail className="mr-2 h-4 w-4 text-primary" />Correo (separar con ; para múltiples)</FormLabel>
                      <FormControl><Input {...field} placeholder="usuario@ejemplo.com; otro@ejemplo.com" value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="observation" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-foreground"><MessageSquare className="mr-2 h-4 w-4 text-primary" />Observación</FormLabel>
                      <FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                
                <div className="mb-4 p-4 border rounded-md bg-secondary/5">
                  <Label htmlFor="solicitudIdDisplay" className="flex items-center text-sm mb-1 text-muted-foreground">
                    <Info className="mr-2 h-4 w-4 text-primary/70" />
                    ID de Solicitud
                  </Label>
                  <Input
                    id="solicitudIdDisplay"
                    value={idPlaceholder}
                    readOnly
                    disabled
                    className="mt-1 bg-muted/50 cursor-not-allowed text-sm text-foreground"
                  />
                </div>

                <DialogFooter className="pt-6 gap-3">
                  <Button type="button" variant="outline" onClick={handleCancel}>Cancelar</Button>
                  <Button type="submit" className="btn-primary">{editingSolicitud ? 'Guardar Cambios' : 'Guardar Solicitud'}</Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
