"use client";
import React, { useState, useMemo, useRef } from 'react';
import type { Worksheet } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserCheck, MessageSquare, Eye, Edit, Repeat, Upload, Download, FileUp, Loader2, Filter, FileSignature, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { StatusBadges } from '../executive/StatusBadges';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, Timestamp } from 'firebase/firestore';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import * as XLSX from 'xlsx';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { CompleteDigitizationModal } from '../reporter/CompleteDigitizationModal';

interface GestionLocalTableProps {
  worksheets: Worksheet[];
  setWorksheets: React.Dispatch<React.SetStateAction<Worksheet[]>>;
  selectedRows: string[];
  setSelectedRows: React.Dispatch<React.SetStateAction<string[]>>;
  onAssign: (worksheet: Worksheet, type: 'aforador' | 'revisor' | 'digitador') => void;
  onComment: (worksheet: Worksheet) => void;
  onView: (worksheet: Worksheet) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function GestionLocalTable({ worksheets, setWorksheets, selectedRows, setSelectedRows, onAssign, onComment, onView, isLoading, onRefresh }: GestionLocalTableProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; worksheet?: Worksheet | null; type: 'aforador' | 'digitador' | 'bulk-aforador' | 'bulk-digitador' }>({ isOpen: false, type: 'aforador' });
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBulkCompleteModalOpen, setIsBulkCompleteModalOpen] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [bulkActionResult, setBulkActionResult] = useState<{ isOpen: boolean, success: string[], skipped: string[] }>({ isOpen: false, success: [], skipped: [] });
  const [selectedCaseForCompletion, setSelectedCaseForCompletion] = useState<Worksheet | null>(null);
  const [positionsModal, setPositionsModal] = useState<{isOpen: boolean, worksheet?: Worksheet | null, newStatus?: string}>({isOpen: false});
  const [positionsInput, setPositionsInput] = useState<number | string>('');


  const filteredWorksheets = useMemo(() => {
    if (showOnlyPending) {
      return worksheets.filter(ws => {
        const aforoData = (ws as any).aforo;
        return !aforoData || aforoData.digitadorStatus !== 'Trámite Completo';
      });
    }
    return worksheets;
  }, [worksheets, showOnlyPending]);


  const totalPages = Math.ceil(filteredWorksheets.length / itemsPerPage);
  const paginatedWorksheets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredWorksheets.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredWorksheets, currentPage, itemsPerPage]);

  const handleSelectAll = () => {
    if (selectedRows.length === paginatedWorksheets.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(paginatedWorksheets.map(ws => ws.id));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const formatDate = (timestamp: any) => {
      if (!timestamp) return 'N/A';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'dd/MM/yyyy');
  };
  
  const handleBulkCompleteDigitacion = async () => {
    if (!user || !user.displayName || selectedRows.length === 0) return;
    setIsImporting(true);
    const batch = writeBatch(db);
    let successNEs: string[] = [];
    let skippedNEs: string[] = [];
    
    for (const wsId of selectedRows) {
        const ws = worksheets.find(w => w.id === wsId);
        const aforoData = (ws as any)?.aforo;
        if (ws && aforoData && aforoData.declaracionAduanera) {
            const worksheetRef = doc(db, 'worksheets', wsId, 'aforo', 'metadata');
            batch.set(worksheetRef, {
                digitadorStatus: 'Trámite Completo',
                digitadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
            }, { merge: true });
            successNEs.push(ws.ne);
        } else if (ws) {
            skippedNEs.push(ws.ne);
        }
    }

    try {
        if (successNEs.length > 0) {
            await batch.commit();
            onRefresh();
        }
        setBulkActionResult({ isOpen: true, success: successNEs, skipped: skippedNEs });
        setSelectedRows([]);
    } catch(e) {
        toast({ title: "Error", description: "No se pudo completar la acción masiva.", variant: "destructive"});
    } finally {
        setIsImporting(false);
    }
  }


  const handleBulkAction = async (type: 'aforadorStatus' | 'digitadorStatus', value: string) => {
    if (!user || !user.displayName || selectedRows.length === 0) return;

    if (type === 'digitadorStatus' && value === 'Trámite Completo') {
        setIsBulkCompleteModalOpen(true);
        setStatusModal({isOpen: false, type: 'aforador'}); // Close the status selection modal
        return;
    }

    const batch = writeBatch(db);
    selectedRows.forEach(wsId => {
        const worksheetRef = doc(db, 'worksheets', wsId, 'aforo', 'metadata');
        batch.set(worksheetRef, {
            [type]: value,
            [`${type}LastUpdate`]: { by: user.displayName, at: Timestamp.now() }
        }, { merge: true });
    });

    try {
        await batch.commit();
        toast({ title: 'Actualización Masiva Exitosa', description: `${selectedRows.length} registros actualizados.`});
        onRefresh();
        setSelectedRows([]);
    } catch(e) {
        console.error("Bulk update error:", e);
        toast({ title: "Error", description: "No se pudo completar la acción masiva.", variant: "destructive"});
    }
    setStatusModal({isOpen: false, type: 'aforador'});
  };

  const handleStatusUpdate = async (worksheetId: string, newStatus: string, type: 'aforador' | 'digitador') => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'});
        return;
    }

    if (type === 'aforador' && newStatus === 'En revisión') {
        const ws = worksheets.find(w => w.id === worksheetId);
        setPositionsModal({ isOpen: true, worksheet: ws, newStatus: newStatus });
        setStatusModal({isOpen: false, type: 'aforador'});
        return;
    }
    if (type === 'digitador' && newStatus === 'Completar Trámite') {
        const ws = worksheets.find(w => w.id === worksheetId);
        setSelectedCaseForCompletion(ws || null);
        setStatusModal({isOpen: false, type: 'aforador'});
        return;
    }

    const worksheetRef = doc(db, 'worksheets', worksheetId, 'aforo', 'metadata');
    try {
        const fieldName = type === 'aforador' ? 'aforadorStatus' : 'digitadorStatus';
        const updateData = {
            [fieldName]: newStatus,
            [`${fieldName}LastUpdate`]: { by: user.displayName, at: Timestamp.now() }
        };
        await writeBatch(db).set(worksheetRef, updateData, { merge: true }).commit();
        toast({ title: 'Estado Actualizado', description: `El estado del ${type} ha sido actualizado a "${newStatus}".` });
        onRefresh();
        setStatusModal({isOpen: false, type: 'aforador'});
    } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleRevalidationRequest = async (worksheetId: string) => {
    if (!user || !user.displayName) return;
    const worksheetRef = doc(db, 'worksheets', worksheetId, 'aforo', 'metadata');
    try {
        const updateData = {
            revisorStatus: 'Revalidación Solicitada',
            revisorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        };
        await writeBatch(db).set(worksheetRef, updateData, { merge: true }).commit();
        toast({ title: 'Solicitud Enviada', description: 'Se ha solicitado la revalidación al revisor.' });
        onRefresh();
    } catch(e) {
        console.error(e);
        toast({ title: "Error", description: "No se pudo solicitar la revalidación.", variant: "destructive" });
    }
  }
  
 const handleDeclaracionSave = async (worksheetId: string, declaracion: string) => {
    if (!user || !user.displayName) return;
    if (!declaracion || declaracion.trim() === '') {
      toast({title: "Dato requerido", description: "El número de declaración no puede estar vacío.", variant: "destructive"});
      return;
    };

    const worksheetRef = doc(db, 'worksheets', worksheetId, 'aforo', 'metadata');
    const batch = writeBatch(db);
    try {
      batch.set(worksheetRef, { 
        declaracionAduanera: declaracion,
        digitadorStatus: 'Trámite Completo',
        digitadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
      }, { merge: true });

      await batch.commit();
      toast({ title: "Declaración y Estado Guardados", description: `Declaración guardada y estado actualizado a 'Trámite Completo'.` });
      onRefresh();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo guardar el número de declaración.", variant: "destructive" });
    }
  };
  
  const handleDownloadTemplate = (forBulkComplete = false) => {
    let data;
    if (forBulkComplete && selectedRows.length > 0) {
        data = selectedRows.map(id => ({ NE: id, 'Declaracion Aduanera': '' }));
    } else {
        data = [{ NE: '', 'Declaracion Aduanera': '' }];
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Declaraciones");
    XLSX.writeFile(wb, "plantilla_declaraciones.xlsx");
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>, isForBulkComplete = false) => {
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
        let neToUpdate = new Set(isForBulkComplete ? selectedRows : json.map(row => String(row['NE']).trim().toUpperCase()));

        for (const row of json) {
          const ne = String(row['NE']).trim().toUpperCase();
          const declaracion = String(row['Declaracion Aduanera'] || '').trim();

          if (ne && declaracion && neToUpdate.has(ne)) {
            const worksheetRef = doc(db, 'worksheets', ne, 'aforo', 'metadata');
            const updatePayload: any = { declaracionAduanera: declaracion };
            if (isForBulkComplete) {
                updatePayload.digitadorStatus = 'Trámite Completo';
                updatePayload.digitadorStatusLastUpdate = { by: user?.displayName, at: Timestamp.now() };
            }
            batch.set(worksheetRef, updatePayload, { merge: true });
            updatedCount++;
          }
        }
        
        if (updatedCount > 0) {
            await batch.commit();
            onRefresh();
            toast({ title: "Importación Completa", description: `${updatedCount} declaraciones han sido actualizadas.` });
            if(isForBulkComplete) {
                setIsBulkCompleteModalOpen(false);
                setSelectedRows([]);
            }
        } else {
            toast({ title: "Sin Cambios", description: "No se encontraron NEs coincidentes en el archivo para actualizar." });
        }

      } catch (error: any) {
        toast({ title: "Error de Importación", description: error.message || "Hubo un problema al leer el archivo Excel.", variant: "destructive" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleBulkAcknowledge = async () => {
    if (!user || !user.displayName || selectedRows.length === 0) return;
    setIsLoading(true);
    const batch = writeBatch(db);
    const comment = "Se reciben hojas fisicas de casos";

    selectedRows.forEach(wsId => {
        const worksheetRef = doc(db, 'worksheets', wsId);
        batch.update(worksheetRef, { entregadoAforoAt: Timestamp.now() });
    });
    
    try {
      await batch.commit();
      toast({
        title: "Acuse Masivo Exitoso",
        description: `${selectedRows.length} caso(s) han sido actualizados.`
      });
      onRefresh();
      setSelectedRows([]);
    } catch (error) {
      console.error("Error with bulk acknowledge:", error);
      toast({ title: "Error", description: "No se pudo registrar el acuse masivo.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePositions = async () => {
    if (!positionsModal.worksheet || !user?.displayName) return;
    
    const batch = writeBatch(db);
    const metadataRef = doc(db, 'worksheets', positionsModal.worksheet.id, 'aforo', 'metadata');
    
    const updatePayload: any = {
        totalPosiciones: Number(positionsInput)
    };
    if (positionsModal.newStatus) {
        updatePayload.aforadorStatus = positionsModal.newStatus;
        updatePayload.aforadorStatusLastUpdate = { by: user.displayName, at: Timestamp.now() };
    }
    
    batch.set(metadataRef, updatePayload, { merge: true });

    try {
        await batch.commit();
        toast({title: 'Éxito', description: 'Las posiciones y el estado han sido guardados.'});
        setPositionsModal({isOpen: false});
        setPositionsInput('');
        onRefresh();
    } catch(e) {
        toast({title: 'Error', description: 'No se pudieron guardar los datos.', variant: 'destructive'});
    }
  };

  return (
    <>
    <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} Importar Declaraciones
            </Button>
            <Button onClick={() => handleDownloadTemplate(false)} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" /> Plantilla
            </Button>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileImport(e, false)} className="hidden" accept=".xlsx, .xls" />
            <Button variant="secondary" size="sm" onClick={() => handleBulkCompleteDigitacion()} disabled={selectedRows.length === 0 || isImporting}>
                Completar Digitación ({selectedRows.length})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatusModal({isOpen: true, type: 'bulk-aforador'})} disabled={selectedRows.length === 0}>
                Asignar Estatus Aforador ({selectedRows.length})
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkAcknowledge} disabled={selectedRows.length === 0 || isLoading}>
                <FileSignature className="mr-2 h-4 w-4" /> Enviar Acuse ({selectedRows.length})
            </Button>

        </div>
        <div className="flex items-center space-x-2">
            <Switch
                id="pending-filter"
                checked={showOnlyPending}
                onCheckedChange={setShowOnlyPending}
            />
            <Label htmlFor="pending-filter">Solo Pendientes</Label>
        </div>
    </div>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedRows.length > 0 && selectedRows.length === paginatedWorksheets.length}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Aforador</TableHead>
            <TableHead>Estado Aforador</TableHead>
            <TableHead>Revisor</TableHead>
            <TableHead>Estado Revisor</TableHead>
            <TableHead>Digitador</TableHead>
            <TableHead>Estado Digitador</TableHead>
            <TableHead>Declaración</TableHead>
            <TableHead>Posiciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedWorksheets.map(ws => {
            const aforoData = (ws as any).aforo;
            return (
            <TableRow key={ws.id} data-state={selectedRows.includes(ws.id) ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  checked={selectedRows.includes(ws.id)}
                  onCheckedChange={() => handleSelectRow(ws.id)}
                />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(ws)}><Eye className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAssign(ws, 'aforador')}><UserCheck className="mr-2 h-4 w-4" /> Asignar Aforador</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAssign(ws, 'revisor')}><UserCheck className="mr-2 h-4 w-4" /> Asignar Revisor</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAssign(ws, 'digitador')}><UserCheck className="mr-2 h-4 w-4" /> Asignar Digitador</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onComment(ws)}><MessageSquare className="mr-2 h-4 w-4" /> Ver/Añadir Comentarios</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
              <TableCell>{ws.ne}</TableCell>
              <TableCell>{ws.consignee}</TableCell>
              <TableCell>
                <Badge variant="secondary">{aforoData?.aforador || 'N/A'}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                    <Badge variant={aforoData?.aforadorStatus === 'En revisión' ? 'default' : 'outline'}>
                        {aforoData?.aforadorStatus || 'Pendiente'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setStatusModal({isOpen: true, worksheet: ws, type: 'aforador'})}><Edit className="h-3 w-3"/></Button>
                 </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{aforoData?.revisor || 'N/A'}</Badge>
              </TableCell>
              <TableCell>
                 <Badge variant={aforoData?.revisorStatus === 'Aprobado' ? 'default' : aforoData?.revisorStatus === 'Rechazado' ? 'destructive' : 'outline'}>
                    {aforoData?.revisorStatus || 'Pendiente'}
                </Badge>
              </TableCell>
              <TableCell>
                  <Badge variant="secondary">{aforoData?.digitador || 'N/A'}</Badge>
              </TableCell>
              <TableCell>
                 <div className="flex items-center gap-1">
                    <Badge variant={aforoData?.digitadorStatus === 'Trámite Completo' ? 'default' : 'outline'}>
                        {aforoData?.digitadorStatus || 'Pendiente'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setStatusModal({isOpen: true, worksheet: ws, type: 'digitador'})}><Edit className="h-3 w-3"/></Button>
                 </div>
              </TableCell>
              <TableCell>
                  {aforoData?.declaracionAduanera ? <Badge variant="default">{aforoData.declaracionAduanera}</Badge> : 'N/A'}
              </TableCell>
               <TableCell>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{aforoData?.totalPosiciones || 0}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setPositionsInput(aforoData?.totalPosiciones || ''); setPositionsModal({isOpen: true, worksheet: ws})}}><Edit className="h-3 w-3"/></Button>
                  </div>
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
    <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
            {selectedRows.length} de {filteredWorksheets.length} fila(s) seleccionadas.
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm">Filas por página:</span>
            <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                    if (value === 'all') {
                        setItemsPerPage(filteredWorksheets.length);
                    } else {
                        setItemsPerPage(Number(value));
                    }
                    setCurrentPage(1);
                }}
            >
                <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="40">40</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center space-x-2">
            <span className="text-sm">Página {currentPage} de {totalPages}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
            >
                Anterior
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
            >
                Siguiente
            </Button>
        </div>
    </div>
    <Dialog open={statusModal.isOpen} onOpenChange={() => setStatusModal({isOpen: false})}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Cambiar Estado de {statusModal.type?.includes('aforador') ? 'Aforador' : 'Digitador'} {statusModal.type?.includes('bulk') ? 'Masivo' : ''}</DialogTitle>
                <DialogDescription>
                    {statusModal.worksheet ? `Seleccione el nuevo estado para el NE: ${statusModal.worksheet.ne}` : `Seleccione el estatus a aplicar a los ${selectedRows.length} casos seleccionados.`}
                </DialogDescription>
            </DialogHeader>
            <Select onValueChange={(value) => {
                if (statusModal.worksheet) {
                    handleStatusUpdate(statusModal.worksheet.id, value, statusModal.type as 'aforador' | 'digitador');
                } else if (statusModal.type) {
                    handleBulkAction(statusModal.type.split('-')[1] as 'aforadorStatus' | 'digitadorStatus', value);
                }
            }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estado..." /></SelectTrigger>
                <SelectContent>
                    {statusModal.type?.includes('aforador') ? (
                        <>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="En proceso">En proceso</SelectItem>
                            <SelectItem value="Incompleto">Incompleto</SelectItem>
                            <SelectItem value="En revisión">En revisión</SelectItem>
                        </>
                    ) : (
                         <>
                            <SelectItem value="Pendiente de Digitación">Pendiente de Digitación</SelectItem>
                            <SelectItem value="En Proceso">En Proceso</SelectItem>
                            <SelectItem value="Almacenado">Almacenado</SelectItem>
                            <SelectItem value="Completar Trámite">Completar Trámite</SelectItem>
                        </>
                    )}
                </SelectContent>
            </Select>
            <DialogFooter>
                <Button variant="outline" onClick={() => setStatusModal({isOpen: false})}>Cancelar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
     <Dialog open={positionsModal.isOpen} onOpenChange={() => setPositionsModal({isOpen: false})}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Ingresar Total de Posiciones</DialogTitle>
                <DialogDescription>
                    Para marcar el caso NE: <span className="font-bold">{positionsModal.worksheet?.ne}</span> como "En revisión", debe ingresar el total de posiciones.
                </DialogDescription>
            </DialogHeader>
             <div className="py-4 space-y-2">
                <Label htmlFor="positions-input">Total de Posiciones</Label>
                <Input
                    id="positions-input"
                    type="number"
                    value={positionsInput}
                    onChange={(e) => setPositionsInput(e.target.value)}
                    placeholder="Ingrese el número de posiciones"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setPositionsModal({isOpen: false})}>Cancelar</Button>
                <Button onClick={handleSavePositions} disabled={!positionsInput}>Guardar y Actualizar Estado</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    {selectedCaseForCompletion && (
        <CompleteDigitizationModal
            isOpen={!!selectedCaseForCompletion}
            onClose={() => setSelectedCaseForCompletion(null)}
            caseData={{id: selectedCaseForCompletion.id, ne: selectedCaseForCompletion.ne}}
            onRefresh={onRefresh}
        />
    )}
     <Dialog open={isBulkCompleteModalOpen} onOpenChange={setIsBulkCompleteModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Completar Trámite Masivo</DialogTitle>
                <DialogDescription>
                    Descargue la plantilla, llene los números de declaración para los {selectedRows.length} casos seleccionados y súbala para finalizar.
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
                 <Button onClick={() => handleDownloadTemplate(true)} variant="secondary">
                    <Download className="mr-2 h-4 w-4" /> Descargar Plantilla con NEs
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileUp className="mr-2 h-4 w-4" />}
                    Subir Plantilla Completada
                </Button>
                 <input type="file" ref={fileInputRef} onChange={(e) => handleFileImport(e, true)} className="hidden" accept=".xlsx, .xls" />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkCompleteModalOpen(false)}>Cancelar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
     <AlertDialog open={bulkActionResult.isOpen} onOpenChange={(isOpen) => setBulkActionResult(prev => ({...prev, isOpen}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <DialogTitle>Resultado de la Operación Masiva</DialogTitle>
                <AlertDialogDescription>
                    <div className="space-y-4 max-h-60 overflow-y-auto">
                        {bulkActionResult.success.length > 0 && (
                            <div>
                                <p className="font-semibold text-green-600">Casos completados exitosamente:</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {bulkActionResult.success.map(ne => <li key={ne}>{ne}</li>)}
                                </ul>
                            </div>
                        )}
                        {bulkActionResult.skipped.length > 0 && (
                             <div>
                                <p className="font-semibold text-amber-600">Casos omitidos (sin declaración aduanera):</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {bulkActionResult.skipped.map(ne => <li key={ne}>{ne}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setBulkActionResult({ isOpen: false, success: [], skipped: [] })}>Entendido</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
