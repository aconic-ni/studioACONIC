
"use client";
import React, { useState, useMemo } from 'react';
import type { Worksheet } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserCheck, MessageSquare, Eye, Edit, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface GestionLocalTableProps {
  worksheets: Worksheet[];
  selectedRows: string[];
  setSelectedRows: React.Dispatch<React.SetStateAction<string[]>>;
  onAssign: (worksheet: Worksheet, type: 'aforador' | 'revisor' | 'digitador') => void;
  onComment: (worksheet: Worksheet) => void;
  onView: (worksheet: Worksheet) => void;
  onRefresh: () => void;
}

export function GestionLocalTable({ worksheets, selectedRows, setSelectedRows, onAssign, onComment, onView, onRefresh }: GestionLocalTableProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; worksheet?: Worksheet | null; type: 'aforador' | 'digitador' }>({ isOpen: false });

  const totalPages = Math.ceil(worksheets.length / itemsPerPage);
  const paginatedWorksheets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return worksheets.slice(startIndex, startIndex + itemsPerPage);
  }, [worksheets, currentPage, itemsPerPage]);

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
  
  const handleStatusUpdate = async (worksheetId: string, newStatus: string, type: 'aforador' | 'digitador') => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'});
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
        setStatusModal({ isOpen: false });
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
     const worksheetRef = doc(db, 'worksheets', worksheetId, 'aforo', 'metadata');
     try {
        await writeBatch(db).set(worksheetRef, { declaracionAduanera: declaracion }, { merge: true }).commit();
        toast({ title: "Declaración Guardada", description: "El número de declaración ha sido guardado." });
        onRefresh();
     } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "No se pudo guardar el número de declaración.", variant: "destructive" });
     }
  }
  
  return (
    <>
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
            <TableHead>Insignias</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Modelo (Patrón)</TableHead>
            <TableHead>Fecha Creación</TableHead>
            <TableHead>Aforador Asignado</TableHead>
            <TableHead>Estado Aforador</TableHead>
            <TableHead>Revisor Asignado</TableHead>
            <TableHead>Estado Revisor</TableHead>
            <TableHead>Digitador Asignado</TableHead>
            <TableHead>Estado Digitador</TableHead>
            <TableHead>Declaración Aduanera</TableHead>
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
              <TableCell>
                <StatusBadges caseData={ws as any} />
              </TableCell>
              <TableCell>{ws.ne}</TableCell>
              <TableCell>{ws.consignee}</TableCell>
              <TableCell>{ws.patternRegime || 'N/A'}</TableCell>
              <TableCell>{formatDate(ws.createdAt)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">{aforoData?.aforador || 'N/A'}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAssign(ws, 'aforador')}><Edit className="h-3 w-3"/></Button>
                </div>
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
                 <div className="flex items-center gap-1">
                    <Badge variant={aforoData?.revisorStatus === 'Aprobado' ? 'default' : aforoData?.revisorStatus === 'Rechazado' ? 'destructive' : 'outline'}>
                        {aforoData?.revisorStatus || 'Pendiente'}
                    </Badge>
                    {aforoData?.revisorStatus === 'Rechazado' && (
                        <Button variant="secondary" size="sm" className="h-6 px-2 text-xs" onClick={() => handleRevalidationRequest(ws.id)}>
                            <Repeat className="mr-1 h-3 w-3" /> Revalidar
                        </Button>
                    )}
                 </div>
              </TableCell>
               <TableCell>
                  <div className="flex items-center gap-1">
                      <Badge variant="secondary">{aforoData?.digitador || 'N/A'}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAssign(ws, 'digitador')}><Edit className="h-3 w-3"/></Button>
                  </div>
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
                  <Input 
                    defaultValue={aforoData?.declaracionAduanera || ''} 
                    onBlur={(e) => handleDeclaracionSave(ws.id, e.target.value)}
                    className="h-8 text-xs"
                    placeholder="No. Declaración"
                  />
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
    <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
            {selectedRows.length} de {worksheets.length} fila(s) seleccionadas.
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm">Filas por página:</span>
            <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="40">40</SelectItem>
                    <SelectItem value="50">50</SelectItem>
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
                onClick={()={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
            >
                Siguiente
            </Button>
        </div>
    </div>
    <Dialog open={statusModal.isOpen} onOpenChange={() => setStatusModal({ isOpen: false })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Cambiar Estado de {statusModal.type === 'aforador' ? 'Aforador' : 'Digitador'}</DialogTitle>
                <DialogDescription>Seleccione el nuevo estado para el NE: {statusModal.worksheet?.ne}</DialogDescription>
            </DialogHeader>
            <Select onValueChange={(value) => handleStatusUpdate(statusModal.worksheet!.id, value, statusModal.type!)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estado..." /></SelectTrigger>
                <SelectContent>
                    {statusModal.type === 'aforador' ? (
                        <>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="En proceso">En proceso</SelectItem>
                            <SelectItem value="Incompleto">Incompleto</SelectItem>
                            <SelectItem value="En revisión">En revisión</SelectItem>
                        </>
                    ) : (
                         <>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="En Proceso">En Proceso</SelectItem>
                            <SelectItem value="Almacenado">Almacenado</SelectItem>
                            <SelectItem value="Trámite Completo">Trámite Completo</SelectItem>
                        </>
                    )}
                </SelectContent>
            </Select>
            <DialogFooter>
                <Button variant="outline" onClick={() => setStatusModal({ isOpen: false })}>Cancelar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

    