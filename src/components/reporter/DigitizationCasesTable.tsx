
"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc, addDoc, getDocs, writeBatch, getCountFromServer, getDoc, documentId, type Query } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, DigitacionStatus, AforoCaseUpdate, AppUser, LastUpdateInfo, Worksheet, WorksheetWithCase } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, History, Edit, User, PlusSquare, FileText, Info, Send, AlertTriangle, CheckSquare, ChevronsUpDown, Check, ChevronDown, ChevronRight, BookOpen, Search, MessageSquare, FileSignature, Repeat, Eye, Users, Scale, UserCheck, Shield, ShieldCheck, FileDigit, Truck, Anchor, Plane, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, toDate, isSameDay, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AforoCaseHistoryModal } from './AforoCaseHistoryModal';
import { DigitizationCommentModal } from './DigitizationCommentModal';
import { CompleteDigitizationModal } from './CompleteDigitizationModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AssignUserModal } from './AssignUserModal';
import { InvolvedUsersModal } from './InvolvedUsersModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDigitacionCard } from './MobileDigitacionCard';
import { StatusBadges } from '../executive/StatusBadges';
import { useRouter } from 'next/navigation';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { tiposDeclaracion } from '@/lib/formData';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import type { SecurityRuleContext } from '@/firebase/errors';
import { FirestorePermissionError } from '@/firebase/errors';
import { IncidentReportModal } from './IncidentReportModal';
import { IncidentReportDetails } from './IncidentReportDetails';
import { DatePickerWithTime } from '@/components/reports/DatePickerWithTime';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { WorksheetDetailModal } from './WorksheetDetailModal';
import { ScrollArea } from '../ui/scroll-area';
import { Anexo5Details } from '../executive/anexos/Anexo5Details';
import { Label } from '../ui/label';
import { AforadorCommentModal } from './AforadorCommentModal';


interface DigitizationCasesTableProps {
  cases: WorksheetWithCase[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    if (d instanceof Date && !isNaN(d.getTime())) {
        const formatString = 'dd/MM/yy HH:mm';
        return format(d, formatString, { locale: es });
    }
    return 'Fecha Inválida';
};

const LastUpdateTooltip = ({ lastUpdate, caseCreation }: { lastUpdate?: LastUpdateInfo | null, caseCreation: Timestamp }) => {
    if (!lastUpdate || !lastUpdate.at) return null;

    const isInitialEntry = lastUpdate.at.isEqual(caseCreation);
    const label = isInitialEntry ? "Registro realizado por" : "Modificado por";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground ml-2 cursor-pointer"/>
            </TooltipTrigger>
            <TooltipContent>
                <p>{label}: {lastUpdate.by}</p>
                <p>Fecha: {formatDate(lastUpdate.at)}</p>
            </TooltipContent>
        </Tooltip>
    );
};


export function DigitizationCasesTable({ cases, isLoading, error, onRefresh }: DigitizationCasesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForComment, setSelectedCaseForComment] = useState<AforoCase | null>(null);
  const [selectedCaseForCompletion, setSelectedCaseForCompletion] = useState<AforoCase | null>(null);
  const [selectedCaseForAssignment, setSelectedCaseForAssignment] = useState<AforoCase | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [statusModal, setStatusModal] = useState<{isOpen: boolean; caseData?: AforoCase | null}>({isOpen: false, caseData: null});
  const [assignmentModal, setAssignmentModal] = useState<{ isOpen: boolean; case: AforoCase | null; type: 'bulk-digitador' | 'digitador' }>({ isOpen: false, case: null, type: 'digitador' });
  const isMobile = useIsMobile();


  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any, isTriggerFromFieldUpdate: boolean = false) => {
    if (!user || !user.displayName) {
        toast({ title: "No autenticado", description: "Debe iniciar sesión para guardar cambios." });
        return;
    }

    const originalCase = cases.find(c => c.id === caseId);
    if (!originalCase) return;

    const oldValue = originalCase[field as keyof AforoCase];
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
        return;
    }
    
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const updateData: { [key: string]: any } = { [field]: value };
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        const statusFieldMap: {[key: string]: keyof AforoCase} = {
            'aforadorStatus': 'aforadorStatusLastUpdate',
            'revisorStatus': 'revisorStatusLastUpdate',
            'digitacionStatus': 'digitacionStatusLastUpdate',
            'preliquidationStatus': 'preliquidationStatusLastUpdate',
            'incidentStatus': 'incidentStatusLastUpdate',
            'revisorAsignado': 'revisorAsignadoLastUpdate',
            'digitadorAsignado': 'digitadorAsignadoLastUpdate',
            'aforador': 'aforadorStatusLastUpdate',
        };

        if(statusFieldMap[field]) {
            updateData[statusFieldMap[field]] = userInfo;
        }

        batch.update(caseDocRef, updateData);

        const updateLog: AforoCaseUpdate = {
            updatedAt: now,
            updatedBy: user.displayName,
            field: field as keyof AforoCase,
            oldValue: oldValue ?? null,
            newValue: value,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);

        await batch.commit();

        if(!isTriggerFromFieldUpdate) {
            toast({ title: "Guardado Automático", description: `El campo se ha actualizado.` });
        }
        onRefresh();
    } catch (error) {
        console.error("Error updating case:", error);
        toast({ title: "Error", description: `No se pudo guardar el cambio.`, variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, cases, toast, onRefresh]);


  useEffect(() => {
    const fetchAssignableUsers = async () => {
        const usersMap = new Map<string, AppUser>();
        const rolesToFetch = ['aforador', 'coordinadora', 'supervisor', 'digitador'];
        
        try {
            const usersQuery = query(collection(db, 'users'), where('role', 'in', rolesToFetch));
            const querySnapshot = await getDocs(usersQuery);
            querySnapshot.forEach(doc => {
                const userData = { uid: doc.id, ...doc.data() } as AppUser;
                if (!usersMap.has(userData.uid) && userData.displayName) {
                    usersMap.set(userData.uid, userData);
                }
            });
            setAssignableUsers(Array.from(usersMap.values()));
        } catch(e) {
            console.error("Error fetching users for digitization table", e);
        }
    };

    fetchAssignableUsers();
  }, []);

  const handleAssignDigitador = (caseId: string, digitadorName: string) => {
     handleAutoSave(caseId, 'digitadorAsignado', digitadorName);
     handleAutoSave(caseId, 'digitadorAsignadoAt', Timestamp.now());
  };

  const handleStatusChange = (caseId: string, value: DigitacionStatus) => {
    if (value === 'Completar Trámite') {
        const caseToComplete = cases.find(c => c.id === caseId);
        if (caseToComplete) {
            setSelectedCaseForCompletion(caseToComplete);
        }
    } else {
        handleAutoSave(caseId, 'digitacionStatus', value);
    }
  }
  
  const handleBulkAction = async (type: 'digitador' | 'digitacionStatus', value: string) => {
    if (!user || !user.displayName || selectedRows.length === 0) return;
    
    setIsLoading(true);
    const batch = writeBatch(db);
    
    selectedRows.forEach(caseId => {
      const caseDocRef = doc(db, 'AforoCases', caseId);
      const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
      const originalCase = cases.find(c => c.id === caseId);

      if (originalCase) {
        const field = type === 'digitador' ? 'digitadorAsignado' : 'digitacionStatus';
        const updateData: {[key: string]: any} = { [field]: value };
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        if (field === 'digitadorAsignado') updateData.digitadorAsignadoLastUpdate = userInfo;
        if (field === 'digitacionStatus') updateData.digitacionStatusLastUpdate = userInfo;
        
        batch.update(caseDocRef, updateData);

        const logEntry: AforoCaseUpdate = {
          updatedAt: now,
          updatedBy: user.displayName,
          field: field as keyof AforoCase,
          oldValue: originalCase[field as keyof AforoCase] || null,
          newValue: value,
          comment: `Acción masiva: ${field} actualizado a ${value}.`
        };
        batch.set(doc(updatesSubcollectionRef), logEntry);
      }
    });

    try {
      await batch.commit();
      toast({ title: "Acción Masiva Exitosa", description: `${selectedRows.length} casos han sido actualizados.` });
      setSelectedRows([]);
      onRefresh();
    } catch (error) {
      console.error("Error with bulk action:", error);
      toast({ title: "Error", description: "No se pudo completar la acción masiva.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setAssignmentModal({ isOpen: false, case: null, type: 'digitador' });
      setStatusModal({ isOpen: false });
    }
  };
  

  const toggleSelectAll = () => {
    if (selectedRows.length === cases.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(cases.map(c => c.id));
    }
  };

  const toggleRowSelection = (caseId: string) => {
    setSelectedRows(prev => 
        prev.includes(caseId) 
            ? prev.filter(id => id !== caseId)
            : [...prev, caseId]
    );
  };

  const openHistoryModal = (caseItem: AforoCase) => setSelectedCaseForHistory(caseItem);
  const openCommentModal = (caseItem: AforoCase) => setSelectedCaseForComment(caseItem);
    
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Cargando registros para digitación...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 px-6 bg-destructive/10 rounded-lg">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-4 text-lg font-medium text-destructive">Error al Cargar los Datos</h3>
        <p className="mt-1 text-sm text-destructive/80 whitespace-pre-wrap">{error}</p>
      </div>
    );
  }
  
  if (cases.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No hay casos pendientes</h3>
        <p className="mt-1 text-muted-foreground">No hay casos de aforo aprobados esperando digitación con los filtros actuales.</p>
      </div>
    );
  }
  
  const canEdit = user?.role === 'admin' || user?.role === 'coordinadora' || user?.role === 'supervisor';
  const isDigitador = user?.role === 'digitador';
  
  if (isMobile) {
      return (
        <div className="space-y-4">
            {cases.map((caseItem) => (
                <MobileDigitacionCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    canEdit={canEdit}
                    isDigitador={isDigitador}
                    savingState={savingState}
                    handleStatusChange={handleStatusChange}
                    handleAutoSave={handleAutoSave}
                    openCommentModal={openCommentModal}
                    openHistoryModal={openHistoryModal}
                    setSelectedCaseForAssignment={setSelectedCaseForAssignment}
                />
            ))}
        </div>
      )
  }
  
  const getDigitacionBadgeVariant = (status: DigitacionStatus | undefined | null) => {
    switch(status) {
        case 'Trámite Completo': return 'default';
        case 'En Proceso': return 'secondary';
        case 'Almacenado': return 'outline';
        case 'Pendiente de Digitación':
        default:
            return 'destructive';
    }
  }

  return (
    <>
     <TooltipProvider>
    <div className="overflow-x-auto table-container rounded-lg border">
      <div className="flex items-center gap-2 p-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAssignmentModal({isOpen: true, case: null, type: 'bulk-digitador'})} disabled={selectedRows.length === 0}>Asignar Digitador ({selectedRows.length})</Button>
              <Button variant="outline" size="sm" onClick={() => setStatusModal({isOpen: true})} disabled={selectedRows.length === 0}>Asignar Estatus ({selectedRows.length})</Button>
            </>
          )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"><Checkbox checked={selectedRows.length > 0 && selectedRows.length === cases.length} onCheckedChange={toggleSelectAll}/></TableHead>
            <TableHead>Acciones</TableHead>
            <TableHead>Ejecutivo</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Asignar Digitador</TableHead>
            <TableHead>Estado Digitación</TableHead>
            <TableHead>Declaración Aduanera</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseItem) => {
            const isCompleted = caseItem.digitacionStatus === 'Trámite Completo';
            const currentStatus = caseItem.digitacionStatus === 'Pendiente' ? 'Pendiente de Digitación' : caseItem.digitacionStatus;

            return (
                <TableRow key={caseItem.id} className={savingState[caseItem.id] ? "bg-amber-100" : ""} data-state={selectedRows.includes(caseItem.id) ? "selected" : undefined}>
                <TableCell><Checkbox checked={selectedRows.includes(caseItem.id)} onCheckedChange={() => toggleRowSelection(caseItem.id)}/></TableCell>
                <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <PlusSquare className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openCommentModal(caseItem)}>
                                <Edit className="mr-2 h-4 w-4" /> Ver/Editar Observación
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openHistoryModal(caseItem)}>
                                <History className="mr-2 h-4 w-4" /> Ver Bitácora
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                      <span>{caseItem.executive}</span>
                       <LastUpdateTooltip lastUpdate={{by: caseItem.executive, at: caseItem.createdAt}} caseCreation={caseItem.createdAt} />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{caseItem.ne}</TableCell>
                <TableCell>{caseItem.consignee}</TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <span>{caseItem.digitadorAsignado || 'Sin asignar'}</span>
                        {canEdit && !isCompleted && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedCaseForAssignment(caseItem)}>
                                {caseItem.digitadorAsignado ? 'Cambiar' : 'Asignar'}
                            </Button>
                        )}
                        <LastUpdateTooltip lastUpdate={caseItem.digitadorAsignadoLastUpdate} caseCreation={caseItem.createdAt} />
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center">
                    <Button variant="outline" className="w-[180px] justify-start" onClick={() => setStatusModal({isOpen: true, caseData: caseItem})} disabled={(!isDigitador && !canEdit) || isCompleted}>
                      <Badge variant={getDigitacionBadgeVariant(currentStatus)}>{currentStatus || 'N/A'}</Badge>
                    </Button>
                    <LastUpdateTooltip lastUpdate={caseItem.digitacionStatusLastUpdate} caseCreation={caseItem.createdAt} />
                    </div>
                </TableCell>
                <TableCell>
                    {isCompleted ? (
                        <Badge variant="default">{caseItem.declaracionAduanera}</Badge>
                    ) : (
                        <Input
                            placeholder="Ingrese No. Declaración"
                            defaultValue={caseItem.declaracionAduanera ?? ''}
                            onBlur={(e) => handleAutoSave(caseItem.id, 'declaracionAduanera', e.target.value)}
                            disabled={!isDigitador && !canEdit}
                        />
                    )}
                </TableCell>
                </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    </TooltipProvider>
    {selectedCaseForHistory && (
        <AforoCaseHistoryModal
            isOpen={!!selectedCaseForHistory}
            onClose={() => setSelectedCaseForHistory(null)}
            caseData={selectedCaseForHistory}
        />
    )}
     {selectedCaseForComment && (
        <DigitizationCommentModal
            isOpen={!!selectedCaseForComment}
            onClose={() => setSelectedCaseForComment(null)}
            caseData={selectedCaseForComment}
        />
    )}
    {selectedCaseForCompletion && (
        <CompleteDigitizationModal
            isOpen={!!selectedCaseForCompletion}
            onClose={() => setSelectedCaseForCompletion(null)}
            caseData={selectedCaseForCompletion}
        />
    )}
    {selectedCaseForAssignment && (
        <AssignUserModal
            isOpen={!!selectedCaseForAssignment}
            onClose={() => setSelectedCaseForAssignment(null)}
            caseData={selectedCaseForAssignment}
            assignableUsers={assignableUsers.filter(u => u.role === 'digitador' || u.role === 'coordinadora' || u.role === 'supervisor' || u.role === 'aforador')}
            onAssign={handleAssignDigitador}
            title="Asignar Digitador"
            description={`Seleccione un usuario para asignar al caso NE: ${selectedCaseForAssignment.ne}`}
        />
    )}
    {assignmentModal.isOpen && (
        <AssignUserModal
            isOpen={assignmentModal.isOpen}
            onClose={() => setAssignmentModal({ isOpen: false, case: null, type: 'digitador' })}
            caseData={assignmentModal.case}
            assignableUsers={assignableUsers.filter(u => u.role === 'digitador' || u.role === 'coordinadora' || u.role === 'supervisor')}
            onAssign={(caseId, userName) => handleBulkAction('digitador', userName)}
            title="Asignar Digitador Masivo"
            description={`Seleccione un usuario para asignar a los ${selectedRows.length} casos seleccionados.`}
        />
    )}
     <Dialog open={statusModal.isOpen} onOpenChange={() => setStatusModal({isOpen: false, caseData: undefined})}>
        <DialogContent>
            <DialogHeader>
                  <DialogTitle>
                    {statusModal.caseData ? `Cambiar Estatus para NE: ${statusModal.caseData.ne}` : `Asignar Estatus Masivo`}
                  </DialogTitle>
                  <DialogDescription>
                    {statusModal.caseData ? 'Seleccione el nuevo estado para este caso.' : `Seleccione el estatus a aplicar a los ${selectedRows.length} casos seleccionados.`}
                  </DialogDescription>
            </DialogHeader>
            <Select onValueChange={(value) => {
                if (statusModal.caseData) {
                    handleStatusChange(statusModal.caseData.id, value as DigitacionStatus);
                    setStatusModal({isOpen: false});
                } else {
                    handleBulkAction('digitacionStatus', value);
                }
            }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estatus..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Pendiente de Digitación">Pendiente de Digitación</SelectItem>
                    <SelectItem value="En Proceso">En Proceso</SelectItem>
                    <SelectItem value="Almacenado">Almacenado</SelectItem>
                    <SelectItem value="Completar Trámite">Completar Trámite</SelectItem>
                </SelectContent>
            </Select>
        </DialogContent>
    </Dialog>
    </>
  );
}

