
"use client";

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, SlidersHorizontal, MessageSquare, Download, Upload, GitCommit, Check, FileEdit } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp, where, type Query, getDocs, doc, writeBatch, getDoc, documentId } from 'firebase/firestore';
import type { Worksheet, RequiredPermit, AppUser, PermitDelivery, DocumentStatus } from '@/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePermitCard } from '@/components/permisos/MobilePermitCard';
import { PermitCommentModal } from '../executive/PermitCommentModal';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { PermitDeliveryTicket } from '@/components/permisos/PermitDeliveryTicket';
import { cn } from '@/lib/utils';
import { PermitDetailsModal } from '../executive/worksheet/PermitDetailsModal';
import { permitOptions } from '@/lib/formData';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import Link from 'next/link';
import { DatePicker } from '@/components/reports/DatePicker';
import { downloadPermisosAsExcel } from '@/lib/fileExporterPermisos';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { v4 as uuidv4 } from 'uuid';


export interface PermitRow extends RequiredPermit {
  worksheetId: string; // Keep track of the parent worksheet
  ne: string;
  reference?: string;
  executive: string;
  consignee?: string;
  worksheetCreatedAt: Timestamp;
  eta?: Timestamp | null;
}

const formatDate = (timestamp: Timestamp | null | undefined, short: boolean = false): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  const formatString = short ? 'dd/MM/yy' : 'dd/MM/yy HH:mm';
  return format(date, formatString, { locale: es });
};

export default function PermisosPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [allPermits, setAllPermits] = useState<PermitRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusMode, setFocusMode] = useState(true);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryRecipient, setDeliveryRecipient] = useState('');
  const [ticketData, setTicketData] = useState<{ permits: PermitRow[], recipient: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [bulkTramiteDate, setBulkTramiteDate] = useState<Date | undefined>();
  const [bulkRetiroDate, setBulkRetiroDate] = useState<Date | undefined>();


  const [groupMembers, setGroupMembers] = useState<AppUser[]>([]);
  const [selectedPermitForComment, setSelectedPermitForComment] = useState<{permit: RequiredPermit, index: number} | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !user.email) return;
    
    const fetchUsers = async () => {
        if (!user) return;
        const execRoles = ['admin', 'supervisor', 'coordinadora', 'ejecutivo'];
        const isManagement = execRoles.includes(user.role || '');
        if (isManagement) {
            const groupMembersFromAuth = user.visibilityGroup || [];
            const execQuery = query(collection(db, 'users'), where('role', 'in', ['ejecutivo', 'coordinadora']));
            const querySnapshot = await getDocs(execQuery);
            const members = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));

             // Combine and remove duplicates
            const combined = [...groupMembersFromAuth, ...members];
            const uniqueMembers = Array.from(new Map(combined.map(item => [item.uid, item])).values());
            setGroupMembers(uniqueMembers);
        }
    };
    fetchUsers();


    const handleSnapshot = (snapshot: any) => {
        const fetchedPermits: PermitRow[] = [];
        snapshot.forEach((doc: any) => {
            const worksheet = doc.data() as Worksheet;
            if (worksheet.requiredPermits && worksheet.requiredPermits.length > 0) {
                worksheet.requiredPermits.forEach(permit => {
                    fetchedPermits.push({
                        ...permit,
                        worksheetId: worksheet.id,
                        ne: worksheet.ne,
                        reference: worksheet.reference,
                        executive: worksheet.executive,
                        consignee: worksheet.consignee,
                        worksheetCreatedAt: worksheet.createdAt,
                        eta: worksheet.eta,
                    });
                });
            }
        });
        setAllPermits(fetchedPermits);
        setIsLoading(false);
    };

    const handleError = (error: any) => {
        console.error("Error fetching permits from worksheets:", error);
        setIsLoading(false);
    };

    const fetchGroupEmailsAndQuery = async () => {
        setIsLoading(true);
        const worksheetsRef = collection(db, 'worksheets');
        let q: Query;
        
        if (user.role === 'admin' || user.role === 'supervisor' || user.role === 'coordinadora') {
            q = query(worksheetsRef, orderBy('createdAt', 'desc'));
        } else if (user.role === 'ejecutivo' && user.visibilityGroup && user.visibilityGroup.length > 0) {
            const groupEmails = Array.from(new Set([user.email, ...user.visibilityGroup.map(m => m.email)])).filter(Boolean) as string[];
            q = query(worksheetsRef, where('createdBy', 'in', groupEmails), orderBy('createdAt', 'desc'));
        } else if (user.role === 'invitado') {
             const dirRef = collection(db, `users/${user.uid}/consigneeDirectory`);
             const dirSnap = await getDocs(dirRef);
             const directoryNames = dirSnap.docs.map(d => d.data().name);
             if (directoryNames.length > 0) {
                q = query(worksheetsRef, where('consignee', 'in', directoryNames), orderBy('createdAt', 'desc'));
             } else {
                setAllPermits([]);
                setIsLoading(false);
                return () => {};
             }
        } else {
            q = query(worksheetsRef, where('createdBy', '==', user.email), orderBy('createdAt', 'desc'));
        }
        
        return onSnapshot(q, handleSnapshot, handleError);
    };
    
    const unsubscribePromise = fetchGroupEmailsAndQuery();
    return () => { unsubscribePromise.then(unsub => unsub()); };
  }, [user]);

  const filteredPermits = useMemo(() => {
    let filtered = allPermits;
    
    if (focusMode) {
      filtered = filtered.filter(p => p.status !== 'Entregado' && !p.permitDelivery);
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.ne.toLowerCase().includes(lowercasedTerm) ||
        p.reference?.toLowerCase().includes(lowercasedTerm) ||
        p.facturaNumber?.toLowerCase().includes(lowercasedTerm) ||
        p.executive.toLowerCase().includes(lowercasedTerm) ||
        (p.assignedExecutive && p.assignedExecutive.toLowerCase().includes(lowercasedTerm)) ||
        p.name.toLowerCase().includes(lowercasedTerm) ||
        p.consignee?.toLowerCase().includes(lowercasedTerm)
      );
    }
    
    const statusOrder: { [key in DocumentStatus]: number } = { 'Pendiente': 1, 'En Trámite': 2, 'Rechazado': 3, 'Sometido de Nuevo': 4, 'Entregado': 5, 'Aprobado': 6 };
    filtered.sort((a, b) => {
        const aDueDate = a.estimatedDeliveryDate?.toDate() || new Date(8640000000000000);
        const bDueDate = b.estimatedDeliveryDate?.toDate() || new Date(8640000000000000);
        
        if (a.status !== 'Entregado' && b.status === 'Entregado') return -1;
        if (a.status === 'Entregado' && b.status !== 'Entregado') return 1;

        const aDaysLeft = differenceInDays(aDueDate, new Date());
        const bDaysLeft = differenceInDays(bDueDate, new Date());
        
        if (aDaysLeft <= 3 && bDaysLeft > 3) return -1;
        if (aDaysLeft > 3 && bDaysLeft <= 3) return 1;

        if (aDaysLeft < bDaysLeft) return -1;
        if (aDaysLeft > bDaysLeft) return 1;
        
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    });

    return filtered;
  }, [allPermits, searchTerm, focusMode]);
  
  const getStatusBadgeVariant = (status: RequiredPermit['status']) => {
    switch (status) {
        case 'Entregado': return 'default';
        case 'Aprobado': return 'default';
        case 'Rechazado': return 'destructive';
        case 'En Trámite': return 'secondary';
        case 'Sometido de Nuevo': return 'secondary';
        case 'Pendiente':
        default:
            return 'outline';
    }
  }

  const handleDownloadTemplate = () => {
    const headers = ["NE", "Permiso", "Tipo", "Factura", "Estado", "FechaTramite", "FechaEntregaEstimada", "Recibo", "AsignadoA"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Permisos");
    XLSX.writeFile(wb, "plantilla_permisos.xlsx");
  };

 const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast({ title: "Importando...", description: "Procesando el archivo Excel." });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            const batch = writeBatch(db);
            let updatedCount = 0;
            let skippedCount = 0;

            for (const row of json) {
                const ne = row['NE']?.toString().trim();
                const permitName = row['Permiso']?.toString().trim();
                
                if (!ne || !permitName) {
                    skippedCount++;
                    continue;
                }

                const wsRef = doc(db, 'worksheets', ne);
                const wsSnap = await getDoc(wsRef);

                if (wsSnap.exists()) {
                    const wsData = wsSnap.data() as Worksheet;
                    const permits = wsData.requiredPermits || [];
                    const existingPermitIndex = permits.findIndex(p => p.name === permitName);

                    const parseDate = (dateStr: string | number | null | undefined): Timestamp | null => {
                        if (dateStr === null || dateStr === undefined || String(dateStr).trim() === '' || String(dateStr).trim().toUpperCase() === 'N/A') return null;
                        const parsed = typeof dateStr === 'number' 
                            ? new Date(Date.UTC(0, 0, dateStr - 1))
                            : new Date(dateStr);
                        return isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
                    };

                    const permitData: Partial<RequiredPermit> = {
                        name: permitName,
                        facturaNumber: row['Factura'] || undefined,
                        status: row['Estado'] || 'Pendiente',
                        tramiteDate: parseDate(row['FechaTramite']),
                        estimatedDeliveryDate: parseDate(row['FechaEntregaEstimada']),
                        assignedExecutive: row['AsignadoA'] || wsData.executive,
                        tipoTramite: row['Tipo'] || undefined,
                    };
                    
                    // Remove undefined properties before merging/pushing
                    Object.keys(permitData).forEach(key => permitData[key as keyof typeof permitData] === undefined && delete permitData[key as keyof typeof permitData]);

                    if (existingPermitIndex !== -1) {
                        permits[existingPermitIndex] = { ...permits[existingPermitIndex], ...permitData };
                    } else {
                        permits.push({ id: uuidv4(), ...permitData } as RequiredPermit);
                    }
                    
                    batch.update(wsRef, { requiredPermits: permits });
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            }

            if (updatedCount > 0) {
                await batch.commit();
                toast({ title: "Importación Completa", description: `${updatedCount} registros de permisos han sido actualizados/añadidos. ${skippedCount > 0 ? `${skippedCount} filas omitidas (NE no encontrado).`: ''}` });
            } else {
                 toast({ title: "Sin Cambios", description: `No se encontraron NEs coincidentes en el archivo para actualizar. Se omitieron ${skippedCount} filas.` });
            }

        } catch (error: any) {
            console.error("Error al importar el archivo: ", error);
            toast({ title: "Error de Importación", description: error.message || "Hubo un problema al leer el archivo Excel.", variant: "destructive" });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmDelivery = async () => {
    if (!deliveryRecipient) {
        toast({ title: 'Error', description: 'Por favor, seleccione un destinatario.', variant: 'destructive'});
        return;
    }
    if (!user || !user.displayName) return;

    setIsSubmitting(true);
    const selectedPermits = allPermits.filter(p => selectedRows.includes(p.id));
    const newTicketData = { permits: selectedPermits, recipient: deliveryRecipient };
    
    const batch = writeBatch(db);
    const worksheetsToUpdate = new Map<string, RequiredPermit[]>();

    // Prepare updates
    for (const permit of selectedPermits) {
        if (!worksheetsToUpdate.has(permit.worksheetId)) {
            const wsDoc = await getDoc(doc(db, 'worksheets', permit.worksheetId));
            if (wsDoc.exists()) {
                worksheetsToUpdate.set(permit.worksheetId, (wsDoc.data() as Worksheet).requiredPermits || []);
            }
        }

        const existingPermits = worksheetsToUpdate.get(permit.worksheetId);
        if (existingPermits) {
            const permitIndex = existingPermits.findIndex(p => p.id === permit.id);
            if (permitIndex !== -1) {
                existingPermits[permitIndex] = {
                    ...existingPermits[permitIndex],
                    status: 'Entregado',
                    permitDelivery: {
                        deliveredTo: deliveryRecipient,
                        deliveredBy: user.displayName,
                        deliveredAt: Timestamp.now(),
                    },
                };
            }
        }
    }

    worksheetsToUpdate.forEach((permits, worksheetId) => {
        const wsRef = doc(db, 'worksheets', worksheetId);
        batch.update(wsRef, { requiredPermits: permits });
    });
    
    try {
        await batch.commit();
        setTicketData(newTicketData);
        setIsDeliveryModalOpen(false);
        setSelectedRows([]);
        toast({ title: 'Entrega Registrada', description: `${selectedPermits.length} permisos marcados como entregados.` });
    } catch (error) {
        console.error("Error confirming delivery: ", error);
        toast({ title: 'Error', description: 'No se pudo registrar la entrega.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

 const handleBulkUpdate = async () => {
    if (selectedRows.length === 0 || (!bulkTramiteDate && !bulkRetiroDate)) {
        toast({ title: "Sin cambios", description: "Seleccione al menos un permiso y una fecha para actualizar." });
        return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);
    const worksheetsToUpdate = new Map<string, RequiredPermit[]>();
    const selectedPermitsInfo = allPermits.filter(p => selectedRows.includes(p.id));

    for (const permitInfo of selectedPermitsInfo) {
        if (!worksheetsToUpdate.has(permitInfo.worksheetId)) {
            const wsDoc = await getDoc(doc(db, 'worksheets', permitInfo.worksheetId));
            if (wsDoc.exists()) {
                worksheetsToUpdate.set(permitInfo.worksheetId, (wsDoc.data() as Worksheet).requiredPermits || []);
            }
        }

        const existingPermits = worksheetsToUpdate.get(permitInfo.worksheetId);
        if (existingPermits) {
            const permitIndex = existingPermits.findIndex(p => p.id === permitInfo.id);
            if (permitIndex !== -1) {
                const updatedPermit = { ...existingPermits[permitIndex] };
                if (bulkTramiteDate) {
                    updatedPermit.tramiteDate = Timestamp.fromDate(bulkTramiteDate);
                }
                if (bulkRetiroDate) {
                    updatedPermit.estimatedDeliveryDate = Timestamp.fromDate(bulkRetiroDate);
                }
                existingPermits[permitIndex] = updatedPermit;
            }
        }
    }

    worksheetsToUpdate.forEach((permits, worksheetId) => {
        const dataToUpdate = { requiredPermits: permits.map(p => ({
            ...p,
            tramiteDate: p.tramiteDate || null,
            estimatedDeliveryDate: p.estimatedDeliveryDate || null,
        }))};
        batch.update(doc(db, 'worksheets', worksheetId), dataToUpdate);
    });

    try {
        await batch.commit();
        toast({ title: 'Actualización Exitosa', description: `${selectedRows.length} permisos han sido actualizados.` });
        setIsBulkUpdateModalOpen(false);
        setSelectedRows([]);
        setBulkTramiteDate(undefined);
        setBulkRetiroDate(undefined);
    } catch (error) {
        console.error("Error bulk updating permits:", error);
        toast({ title: 'Error', description: 'No se pudieron actualizar los permisos.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
};

  const handleBulkStatusUpdate = async (newStatus: DocumentStatus) => {
    if (selectedRows.length === 0) return;
    setIsSubmitting(true);
    const batch = writeBatch(db);
    const worksheetsToUpdate = new Map<string, RequiredPermit[]>();
    const selectedPermitsInfo = allPermits.filter(p => selectedRows.includes(p.id));

    for (const permitInfo of selectedPermitsInfo) {
        if (!worksheetsToUpdate.has(permitInfo.worksheetId)) {
            const wsDoc = await getDoc(doc(db, 'worksheets', permitInfo.worksheetId));
            if (wsDoc.exists()) {
                worksheetsToUpdate.set(permitInfo.worksheetId, (wsDoc.data() as Worksheet).requiredPermits || []);
            }
        }

        const existingPermits = worksheetsToUpdate.get(permitInfo.worksheetId);
        if (existingPermits) {
            const permitIndex = existingPermits.findIndex(p => p.id === permitInfo.id);
            if (permitIndex !== -1) {
                existingPermits[permitIndex].status = newStatus;
            }
        }
    }

    worksheetsToUpdate.forEach((permits, worksheetId) => {
        batch.update(doc(db, 'worksheets', worksheetId), { requiredPermits: permits });
    });

    try {
        await batch.commit();
        toast({ title: "Actualización Exitosa", description: `${selectedRows.length} permisos han cambiado a '${newStatus}'.` });
        setSelectedRows([]);
    } catch(e) {
        toast({ title: "Error", description: "No se pudieron actualizar los estados.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
        setIsBulkStatusModalOpen(false);
    }
  };


  const handleExportExcel = () => {
    if (filteredPermits.length === 0) {
      toast({ title: "Sin Datos", description: "No hay permisos para exportar.", variant: "secondary" });
      return;
    }
    setIsExporting(true);
    downloadPermisosAsExcel(filteredPermits);
    setIsExporting(false);
  };


  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (ticketData) {
      return <PermitDeliveryTicket data={ticketData} onClose={() => setTicketData(null)} />;
  }
  
  const content = () => {
    if (isLoading) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    if (filteredPermits.length === 0) {
        return <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg"><p className="mt-1 text-muted-foreground">No se encontraron permisos con los filtros actuales.</p></div>;
    }
    
    if (isMobile) {
        return (
            <div className="space-y-4">
                {filteredPermits.map(permit => (
                    <MobilePermitCard 
                        key={`${permit.worksheetId}-${permit.id}`} 
                        permit={permit} 
                        getStatusBadgeVariant={getStatusBadgeVariant} 
                    />
                ))}
            </div>
        );
    }
    
    return (
        <div className="overflow-x-auto table-container rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                     <Checkbox
                        checked={selectedRows.length > 0 && selectedRows.length === filteredPermits.length}
                        onCheckedChange={() => {
                            if (selectedRows.length === filteredPermits.length) {
                                setSelectedRows([]);
                            } else {
                                setSelectedRows(filteredPermits.map(p => p.id));
                            }
                        }}
                     />
                  </TableHead>
                  <TableHead>Fecha de Reporte</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>NE</TableHead>
                  <TableHead>Consignatario</TableHead>
                  <TableHead>Factura Asociada</TableHead>
                  <TableHead>Permiso</TableHead>
                  <TableHead>Tipo de Trámite</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ejecutivo Asignado</TableHead>
                  <TableHead>Fecha Sometido</TableHead>
                  <TableHead>Fecha Retiro Estimada</TableHead>
                  <TableHead>Comentarios</TableHead>
                  <TableHead>Entregado a</TableHead>
                  <TableHead>Fecha de Remisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermits.map(permit => {
                    const daysLeft = permit.estimatedDeliveryDate ? differenceInDays(permit.estimatedDeliveryDate.toDate(), new Date()) : null;
                    const rowClass = cn(
                        (permit.status !== 'Entregado' && daysLeft !== null && daysLeft <= 3) && 'bg-yellow-100 dark:bg-yellow-900/30'
                    );
                    return (
                      <TableRow key={`${permit.worksheetId}-${permit.id}`} className={rowClass}>
                        <TableCell>
                           <Checkbox
                                checked={selectedRows.includes(permit.id)}
                                onCheckedChange={() => {
                                    setSelectedRows(prev => 
                                        prev.includes(permit.id) 
                                        ? prev.filter(id => id !== permit.id)
                                        : [...prev, permit.id]
                                    );
                                }}
                            />
                        </TableCell>
                        <TableCell className="font-medium">{formatDate(permit.worksheetCreatedAt, false)}</TableCell>
                        <TableCell className="font-medium">{formatDate(permit.eta, false)}</TableCell>
                        <TableCell className="font-medium">{permit.ne}</TableCell>
                        <TableCell>{permit.consignee}</TableCell>
                        <TableCell>{permit.facturaNumber || 'N/A'}</TableCell>
                        <TableCell>{permit.name}</TableCell>
                        <TableCell>{permit.tipoTramite || 'N/A'}</TableCell>
                        <TableCell><Badge variant={getStatusBadgeVariant(permit.status)}>{permit.status}</Badge></TableCell>
                        <TableCell>{permit.assignedExecutive || permit.executive}</TableCell>
                        <TableCell>{formatDate(permit.tramiteDate, false)}</TableCell>
                        <TableCell>{formatDate(permit.estimatedDeliveryDate, false)}</TableCell>
                        <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedPermitForComment({ permit, index: -1 })}>
                                <MessageSquare className="h-4 w-4" />
                                 {permit.comments && permit.comments.length > 0 && (
                                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 justify-center text-xs">{permit.comments.length}</Badge>
                                )}
                            </Button>
                        </TableCell>
                         <TableCell>
                            {permit.permitDelivery ? (
                                <Badge className="bg-blue-100 text-blue-700">{permit.permitDelivery.deliveredTo}</Badge>
                            ) : <Badge variant="outline">Pendiente</Badge>}
                        </TableCell>
                        <TableCell>{formatDate(permit.permitDelivery?.deliveredAt, true)}</TableCell>
                      </TableRow>
                    )
                })}
              </TableBody>
            </Table>
        </div>
    );
  };

  return (
    <>
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-screen-2xl mx-auto custom-shadow">
          <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-semibold">Gestión de Permisos</CardTitle>
                    <CardDescription>Seguimiento del estado de todos los permisos requeridos.</CardDescription>
                </div>
                 <div className="flex flex-col sm:flex-row gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".xlsx, .xls" />
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={isImporting}>
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                        Importar
                    </Button>
                    <Button onClick={handleDownloadTemplate} variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Plantilla
                    </Button>
                     <Button onClick={() => setIsBulkUpdateModalOpen(true)} variant="outline" disabled={selectedRows.length === 0}>
                        <FileEdit className="mr-2 h-4 w-4" /> Modificación Masiva ({selectedRows.length})
                     </Button>
                      <Button onClick={() => setIsBulkStatusModalOpen(true)} variant="outline" disabled={selectedRows.length === 0}>
                        <FileEdit className="mr-2 h-4 w-4" /> Asignar Estatus ({selectedRows.length})
                      </Button>
                     <Button onClick={handleExportExcel} variant="outline" disabled={isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                        Exportar a Excel
                     </Button>
                     <Button onClick={() => setIsDeliveryModalOpen(true)} disabled={selectedRows.length === 0}>
                        <GitCommit className="mr-2 h-4 w-4" /> Generar Entrega ({selectedRows.length})
                    </Button>
                </div>
            </div>
             <div className="flex flex-col sm:flex-row items-center space-x-4 pt-4 border-t mt-4">
                 <div className="relative flex-grow w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar en todos los campos..."
                        className="pl-10 w-full"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
                <Button 
                    variant={focusMode ? 'secondary' : 'ghost'} 
                    onClick={() => setFocusMode(!focusMode)}
                    className="w-full sm:w-auto"
                >
                    <SlidersHorizontal className="mr-2 h-4 w-4"/>
                    {focusMode ? 'Pendientes de Entrega' : 'Viendo Todos'}
                </Button>
                <p className="text-sm text-muted-foreground w-full sm:w-auto text-center sm:text-left">
                    Total de permisos: {filteredPermits.length}
                </p>
            </div>
          </CardHeader>
          <CardContent>
            {content()}
          </CardContent>
        </Card>
      </div>
    </AppShell>
    {selectedPermitForComment && (
        <PermitCommentModal
            isOpen={!!selectedPermitForComment}
            onClose={() => setSelectedPermitForComment(null)}
            permit={selectedPermitForComment.permit}
            worksheetId={selectedPermitForComment.permit.ne}
            onCommentsUpdate={() => {}}
        />
    )}
     <Dialog open={isDeliveryModalOpen} onOpenChange={setIsDeliveryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Entrega de Permisos</DialogTitle>
            <DialogDescription>
              Seleccione la persona que recibe los {selectedRows.length} permisos seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <Command className="rounded-lg border shadow-sm">
                <CommandInput placeholder="Buscar persona..." />
                <CommandList>
                    <CommandEmpty>No se encontró persona.</CommandEmpty>
                    <CommandGroup>
                        {groupMembers.map(member => (
                            <CommandItem
                                key={member.uid}
                                value={member.displayName || ''}
                                onSelect={(currentValue) => {
                                    setDeliveryRecipient(currentValue === deliveryRecipient ? "" : member.displayName || '');
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", deliveryRecipient === member.displayName ? "opacity-100" : "opacity-0")} />
                                {member.displayName}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsDeliveryModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmDelivery} disabled={!deliveryRecipient || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Confirmar y Generar Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isBulkUpdateModalOpen} onOpenChange={setIsBulkUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualización Masiva de Fechas</DialogTitle>
            <DialogDescription>
              Seleccione las fechas que desea aplicar a los {selectedRows.length} permisos seleccionados. Los campos que deje en blanco no se modificarán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Fecha de Trámite</Label>
                <DatePicker date={bulkTramiteDate} onDateChange={setBulkTramiteDate} />
            </div>
            <div className="space-y-2">
                <Label>Fecha de Retiro (Estimada)</Label>
                <DatePicker date={bulkRetiroDate} onDateChange={setBulkRetiroDate} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkUpdateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkUpdate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Aplicar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isBulkStatusModalOpen} onOpenChange={setIsBulkStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
              <DialogTitle>Actualización Masiva de Estado</DialogTitle>
              <DialogDescription>Seleccione el estado a aplicar a los {selectedRows.length} permisos seleccionados.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select onValueChange={(value) => handleBulkStatusUpdate(value as DocumentStatus)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar nuevo estado..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="En Trámite">En Trámite</SelectItem>
                    <SelectItem value="Entregado">Entregado</SelectItem>
                    <SelectItem value="Rechazado">Rechazado</SelectItem>
                    <SelectItem value="Sometido de Nuevo">Sometido de Nuevo</SelectItem>
                    <SelectItem value="Aprobado">Aprobado</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkStatusModalOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    