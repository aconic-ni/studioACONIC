
"use client";
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { LegalRequestSuccessModal } from './LegalRequestSuccessModal';
import type { LegalServiceItem } from '@/types';
import { Label } from '@/components/ui/label';


const legalServiceTypes = [
    "Declaracion Notarial",
    "Poder Especial",
    "Certificacion de Documentos",
    "Razon de Fecha Cierta",
    "Dictamen Tecnico INE",
    "Caso por Duda de Valor",
    "Certificacion de Fotocopia",
];

const serviceItemSchema = z.object({
  serviceType: z.string().min(1, "Debe seleccionar un servicio."),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
  // INE Specific fields
  factura: z.string().optional(),
  contenedor: z.string().optional(),
  item: z.string().optional(),
  marcaEquipo: z.string().optional(),
  modeloEquipo: z.string().optional(),
  equipoType: z.enum(['Refrigerador', 'Aire Acondicionado']).optional(),
});

const requestSchema = z.object({
  ne: z.string().min(1, "NE es requerido."),
  consignee: z.string().min(1, "Consignatario es requerido."),
  services: z.array(serviceItemSchema).min(1, "Debe añadir al menos un servicio."),
  observations: z.string().optional(),
  authorizedByClient: z.boolean().default(false),
});

type RequestFormData = z.infer<typeof requestSchema>;

export function LegalRequestForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);

  // States for adding a new service
  const [newServiceType, setNewServiceType] = useState('');
  const [newServiceQuantity, setNewServiceQuantity] = useState(1);
  const [newServiceIneFactura, setNewServiceIneFactura] = useState('');
  const [newServiceIneContenedor, setNewServiceIneContenedor] = useState('');
  const [newServiceIneItem, setNewServiceIneItem] = useState('');
  const [newServiceIneMarca, setNewServiceIneMarca] = useState('');
  const [newServiceIneModelo, setNewServiceIneModelo] = useState('');
  const [newServiceIneEquipoType, setNewServiceIneEquipoType] = useState<'Refrigerador' | 'Aire Acondicionado' | undefined>(undefined);
  
  const hasLoadedFromUrl = useRef(false);


  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: { ne: '', consignee: '', services: [], observations: '', authorizedByClient: false },
  });

   const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "services"
  });


  useEffect(() => {
    if (hasLoadedFromUrl.current) return;
    
    const ne = searchParams.get('ne');
    const consignee = searchParams.get('consignee');
    const serviceType = searchParams.get('serviceType');
    
    let didUpdate = false;

    if (ne) {
        form.setValue('ne', ne);
        didUpdate = true;
    }
    if (consignee) {
        form.setValue('consignee', consignee);
        didUpdate = true;
    }
    if (serviceType) {
        const newService: LegalServiceItem = { 
            serviceType: serviceType, 
            quantity: 1 
        };
        if (serviceType === 'Dictamen Tecnico INE') {
            newService.factura = searchParams.get('factura') || '';
            newService.contenedor = searchParams.get('contenedor') || '';
            newService.item = searchParams.get('item') || '';
            newService.marcaEquipo = searchParams.get('marca') || '';
            newService.modeloEquipo = searchParams.get('modelo') || '';
            const tipoEquipo = searchParams.get('tipoEquipo');
            if (tipoEquipo === 'Refrigerador' || tipoEquipo === 'Aire Acondicionado') {
                newService.equipoType = tipoEquipo;
            }
        }
        append(newService);
        didUpdate = true;
        hasLoadedFromUrl.current = true; // Mark as loaded after processing
    }

    if(didUpdate) {
        // Force re-validation after programmatically setting values
        form.trigger();
    }
  }, [searchParams, form, append]);


  const backLink = user?.role === 'coordinadora' ? '/assignments' : '/executive';

  const handleAddService = () => {
    if (!newServiceType) {
        toast({ title: "Error", description: "Por favor, seleccione un tipo de servicio.", variant: "destructive" });
        return;
    }
    const newService: LegalServiceItem = { 
        serviceType: newServiceType, 
        quantity: newServiceQuantity 
    };

    if (newServiceType === 'Dictamen Tecnico INE') {
        newService.factura = newServiceIneFactura;
        newService.contenedor = newServiceIneContenedor;
        newService.item = newServiceIneItem;
        newService.marcaEquipo = newServiceIneMarca;
        newService.modeloEquipo = newServiceIneModelo;
        newService.equipoType = newServiceIneEquipoType;
    }
    
    append(newService);
    
    // Reset inputs
    setNewServiceType('');
    setNewServiceQuantity(1);
    setNewServiceIneFactura('');
    setNewServiceIneContenedor('');
    setNewServiceIneItem('');
    setNewServiceIneMarca('');
    setNewServiceIneModelo('');
    setNewServiceIneEquipoType(undefined);
  };

  async function onSubmit(data: RequestFormData) {
    if (!user || !user.email) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const docId = `LEG-${Date.now()}`;
    const requestDocRef = doc(db, "solicitudesLegales", docId);
    
    const requestData = {
        ...data,
        id: docId,
        status: 'pendiente' as const,
        requestedBy: user.email!,
        requestedAt: Timestamp.fromDate(new Date()),
    };

    try {
        await setDoc(requestDocRef, requestData);
        setTicketData({
            id: docId,
            date: new Date(),
            ne: data.ne,
            services: data.services,
            consignee: data.consignee,
            observations: data.observations,
            authorizedByClient: data.authorizedByClient
        });
        setShowSuccessModal(true);
        form.reset();
    } catch (error) {
        console.error("Error creating legal request:", error);
        toast({ title: "Error", description: "No se pudo crear la solicitud legal.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setTicketData(null);
    router.push('/executive');
  }

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto custom-shadow">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Solicitud de Servicio Legal</CardTitle>
          <CardDescription>Complete la información para generar una nueva solicitud al departamento legal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="ne" render={({ field }) => (<FormItem><FormLabel>NE (Seguimiento NX1) *</FormLabel><FormControl><Input placeholder="Ej: NX1-12345" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="consignee" render={({ field }) => (<FormItem><FormLabel>Consignatario *</FormLabel><FormControl><Input placeholder="Nombre del consignatario" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium">Servicios Solicitados</h3>
                    <div className="space-y-4 p-3 border rounded-md bg-secondary/30">
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
                            <div>
                                <Label>Tipo de Servicio *</Label>
                                <Select value={newServiceType} onValueChange={setNewServiceType}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent>{legalServiceTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Cantidad *</Label>
                                <Input type="number" min="1" value={newServiceQuantity} onChange={(e) => setNewServiceQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}/>
                            </div>
                        </div>

                        {newServiceType === 'Dictamen Tecnico INE' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-muted">
                                 <div><Label>Factura</Label><Input value={newServiceIneFactura} onChange={e => setNewServiceIneFactura(e.target.value)} /></div>
                                 <div><Label>Contenedor</Label><Input value={newServiceIneContenedor} onChange={e => setNewServiceIneContenedor(e.target.value)} /></div>
                                 <div><Label>Item</Label><Input value={newServiceIneItem} onChange={e => setNewServiceIneItem(e.target.value)} /></div>
                                 <div><Label>Marca de Equipo</Label><Input value={newServiceIneMarca} onChange={e => setNewServiceIneMarca(e.target.value)} /></div>
                                 <div><Label>Modelo de Equipo</Label><Input value={newServiceIneModelo} onChange={e => setNewServiceIneModelo(e.target.value)} /></div>
                                 <div><Label>Tipo de Equipo</Label>
                                    <Select value={newServiceIneEquipoType} onValueChange={(v) => setNewServiceIneEquipoType(v as any)}>
                                        <SelectTrigger><SelectValue placeholder="Refrigerador o Aire Acondicionado..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Refrigerador">Refrigerador</SelectItem>
                                            <SelectItem value="Aire Acondicionado">Aire Acondicionado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                 </div>
                            </div>
                        )}
                        <Button type="button" onClick={handleAddService} className="w-full md:w-auto"><PlusCircle className="mr-2 h-4 w-4"/> Añadir Servicio a la Lista</Button>
                    </div>

                    {fields.length > 0 && (
                         <div className="rounded-md border">
                            <Table>
                                <TableHeader><TableRow><TableHead>Servicio</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell>{field.serviceType}</TableCell>
                                            <TableCell>{field.quantity}</TableCell>
                                            <TableCell className="text-right">
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </div>
                    )}
                    <FormField control={form.control} name="services" render={({ field }) => <FormMessage />} />
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                    <FormField control={form.control} name="observations" render={({ field }) => (
                        <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea placeholder="Añada cualquier observación o detalle adicional aquí..." {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="authorizedByClient" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                           <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                           <div className="space-y-1 leading-none"><FormLabel>Autorizado por el cliente</FormLabel></div>
                        </FormItem>
                     )}/>
                </div>

              <div className="flex justify-between items-center pt-6">
                 <Button type="button" variant="ghost" asChild>
                    <Link href={backLink}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Link>
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
      {ticketData && (
          <LegalRequestSuccessModal
            isOpen={showSuccessModal}
            onClose={handleCloseModal}
            ticketData={ticketData}
        />
      )}
    </>
  );
}
