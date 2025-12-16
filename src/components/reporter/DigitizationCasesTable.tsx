
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
  filters: {
    ne?: string;
  };
  setAllFetchedCases: (cases: AforoCase[]) => void;
  showPendingOnly: boolean;
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


export function DigitizationCasesTable({ filters, setAllFetchedCases, showPendingOnly }: DigitizationCasesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  const [displayCases, setDisplayCases] = useState<AforoCase[]>([]);
  
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForComment, setSelectedCaseForComment] = useState<AforoCase | null>(null);
  const [selectedCaseForCompletion, setSelectedCaseForCompletion] = useState<AforoCase | null>(null);
  const [selectedCaseForAssignment, setSelectedCaseForAssignment] = useState<AforoCase | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [statusModal, setStatusModal] = useState<{isOpen: boolean}>({isOpen: false});


  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any, isTriggerFromFieldUpdate: boolean = false) => {
    if (!user || !user.displayName) {
        toast({ title: "No autenticado", description: "Debe iniciar sesión para guardar cambios." });
        return;
    }

    const originalCase = displayCases.find(c => c.id === caseId);
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
    } catch (error) {
        console.error("Error updating case:", error);
        toast({ title: "Error", description: `No se pudo guardar el cambio.`, variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, displayCases, toast]);


  useEffect(() => {
    setIsLoading(true);

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
        } catch (e) {
            console.error("Error fetching users for digitization table", e);
        }
    };

    fetchAssignableUsers();
    
    let qCases;

    if (filters.ne?.trim()) {
        qCases = query(collection(db, 'AforoCases'), where('ne', '==', filters.ne.trim().toUpperCase()));
    } else {
        const statuses = ['Pendiente de Digitación', 'En Proceso', 'Almacenado', 'Trámite Completo'];
        qCases = query(
            collection(db, 'AforoCases'),
            where('digitacionStatus', 'in', statuses),
            orderBy('revisorStatus', 'desc'), 
            orderBy('createdAt', 'desc')
        );
    }

    const unsubscribe = onSnapshot(qCases, (snapshot) => {
        const fetchedCases: AforoCase[] = [];
        snapshot.forEach((doc) => {
            fetchedCases.push({ id: doc.id, ...doc.data() } as AforoCase);
        });
        
        let filtered = fetchedCases;
        if(showPendingOnly) {
            filtered = filtered.filter(c => c.digitacionStatus !== 'Trámite Completo');
        }

        setAllFetchedCases(filtered as WorksheetWithCase[]);
        setDisplayCases(filtered);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching digitization cases: ", error);
        toast({ title: "Error", description: "No se pudieron cargar los casos para digitación.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [filters, toast, setAllFetchedCases, showPendingOnly]);

  const handleAssignDigitador = (caseId: string, digitadorName: string) => {
     handleAutoSave(caseId, 'digitadorAsignado', digitadorName);
     handleAutoSave(caseId, 'digitadorAsignadoAt', Timestamp.now());
  };

  const handleStatusChange = (caseId: string, value: DigitacionStatus) => {
    if (value === 'Completar Trámite') {
        const caseToComplete = displayCases.find(c => c.id === caseId);
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
        const originalCase = displayCases.find(c => c.id === caseId);

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
    } catch (error) {
        console.error("Error with bulk action:", error);
        toast({ title: "Error", description: "No se pudo completar la acción masiva.", variant: "destructive" });
    } finally {
        setIsLoading(false);
        setAssignmentModal({ isOpen: false, case: null, type: 'aforador' });
        setStatusModal({ isOpen: false });
    }
  };
  
  const toggleSelectAll = () => {
    if (selectedRows.length === displayCases.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(displayCases.map(c => c.id));
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

  if (displayCases.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No hay casos pendientes</h3>
        <p className="mt-1 text-muted-foreground">No hay casos de aforo aprobados esperando digitación con los filtros actuales.</p>
      </div>
    );
  }
  
  const canEdit = user?.role === 'admin' || user?.role === 'coordinadora' || user?.roleTitle === 'supervisor';
  const isDigitador = user?.role === 'digitador';
  
  if (isMobile) {
    return (
      <div className="space-y-4">
        {displayCases.map((caseItem) => (
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

  return (
    <>
     <TooltipProvider>
    <div className="overflow-x-auto table-container rounded-lg border">
      <div className="flex items-center gap-2 p-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAssignmentModal({isOpen: true, case: null, type: 'bulk-revisor'})} disabled={selectedRows.length === 0}>Asignar Digitador ({selectedRows.length})</Button>
              <Button variant="outline" size="sm" onClick={() => setStatusModal({isOpen: true})} disabled={selectedRows.length === 0}>Asignar Estatus ({selectedRows.length})</Button>
            </>
          )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"><Checkbox checked={selectedRows.length > 0 && selectedRows.length === displayCases.length} onCheckedChange={toggleSelectAll}/></TableHead>
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
          {displayCases.map((caseItem) => {
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
                    <Select
                        value={currentStatus ?? ''}
                        onValueChange={(value: DigitacionStatus) => handleStatusChange(caseItem.id, value)}
                        disabled={(!isDigitador && !canEdit) || isCompleted}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Seleccionar estado..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pendiente de Digitación">Pendiente de Digitación</SelectItem>
                            <SelectItem value="En Proceso">En Proceso</SelectItem>
                            <SelectItem value="Almacenado">Almacenado</SelectItem>
                            <SelectItem value="Completar Trámite">Completar Trámite</SelectItem>
                        </SelectContent>
                    </Select>
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
            onClose={() => setAssignmentModal({ isOpen: false, case: null, type: 'aforador' })}
            caseData={assignmentModal.case}
            assignableUsers={
              assignmentModal.type === 'bulk-digitador'
                  ? assignableUsers.filter(u => u.role === 'digitador' || u.role === 'coordinadora' || u.role === 'supervisor')
                  : assignableUsers.filter(u => u.role === 'digitador' || u.role === 'coordinadora' || u.role === 'supervisor')
            }
            onAssign={(caseId, userName) => assignmentModal.type.includes('bulk') ? handleBulkAction('digitador', userName) : handleAssignDigitador(caseId, userName)}
            title={`Asignar ${assignmentModal.type.includes('bulk') ? 'Digitador Masivo' : 'Digitador'}`}
            description={assignmentModal.case ? `Seleccione un usuario para asignar al caso NE: ${assignmentModal.case.ne}` : `Seleccione un usuario para asignar a los ${selectedRows.length} casos seleccionados.`}
        />
    )}
     <Dialog open={statusModal.isOpen} onOpenChange={() => setStatusModal({isOpen: false})}>
        <DialogContent>
            <DialogHeader><DialogTitle>Asignar Estatus de Digitación Masivo</DialogTitle><DialogDescription>Seleccione el estatus a aplicar a los {selectedRows.length} casos seleccionados.</DialogDescription></DialogHeader>
            <Select onValueChange={(value) => { handleBulkAction('digitacionStatus', value); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estatus..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Pendiente de Digitación">Pendiente de Digitación</SelectItem>
                    <SelectItem value="En Proceso">En Proceso</SelectItem>
                    <SelectItem value="Almacenado">Almacenado</SelectItem>
                </SelectContent>
            </Select>
        </DialogContent>
    </Dialog>
    </>
  );
}

```
- src/components/reporter/page.tsx:
```tsx
"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, PartyPopper, PlusCircle, ChevronDown, Search, Download, Calendar, CalendarDays, CalendarRange, Filter, Send, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AforoCaseModal } from '@/components/reporter/AforoCaseModal';
import { DailyAforoCasesTable } from '@/components/reporter/DailyAforoCasesTable';
import { DigitizationCasesTable } from '@/components/reporter/DigitizationCasesTable';
import { Input } from '@/components/ui/input';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import type { DateRange } from 'react-day-picker';
import type { AforoCase, AppUser, AforoCaseUpdate, Worksheet, WorksheetWithCase } from '@/types';
import { collection, getDocs, query, where, collectionGroup, orderBy, writeBatch, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadAforoReportAsExcel } from '@/lib/fileExporterAforo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';

type DateFilterType = 'range' | 'month' | 'today';

const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, 'label': 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function TheReporterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isAforoModalOpen, setIsAforoModalOpen] = useState(false);
  const [isSendingToDigitization, setIsSendingToDigitization] = useState(false);
  
  // State for filter inputs
  const [neInput, setNeInput] = useState('');
  const [consigneeInput, setConsigneeInput] = useState('');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  
  // State for applied filters that trigger re-fetch
  const [appliedDbFilters, setAppliedDbFilters] = useState<{
    ne?: string;
    consignee?: string;
    dateRange?: DateRange;
    dateFilterType: DateFilterType;
  }>({
    dateFilterType: 'range',
  });
  
  const [allCasesForExport, setAllCasesForExport] = useState<WorksheetWithCase[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeathkeyModalOpen, setIsDeathkeyModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');


  const canCreateReport = user?.role === 'aforador' || user?.role === 'admin';
  const canSendToDigitization = user?.role === 'admin' || (user?.role === 'supervisor' && user?.roleTitle === 'PSMT');


  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/');
      } else if (!user.hasReportsAccess) {
        router.push('/thereporter/pending');
      }
    }
  }, [user, loading, router]);

  const handleSearch = () => {
    let dateRange: DateRange | undefined = undefined;
    if (dateFilterType === 'range') {
        dateRange = dateRangeInput;
    } else if (dateFilterType === 'month') {
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0);
        dateRange = { from: start, to: end };
    } else if (dateFilterType === 'today') {
        const today = new Date();
        dateRange = { from: today, to: today };
    }

    const filtersToApply: typeof appliedDbFilters = {
        dateFilterType: dateFilterType,
        dateRange: dateRange,
    };

    if (neInput.trim()) filtersToApply.ne = neInput.trim();
    if (consigneeInput.trim()) filtersToApply.consignee = consigneeInput.trim();

    setAppliedDbFilters(filtersToApply);
};

  const handleExport = async () => {
    if (allCasesForExport.length === 0) {
        toast({ title: "No hay datos", description: "No hay casos en la tabla para exportar.", variant: "secondary" });
        return;
    };
    setIsExporting(true);

    try {
        const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];
        
        for (const caseItem of allCasesForExport) {
            const logsQuery = query(collection(db, 'AforoCases', caseItem.id, 'actualizaciones'), orderBy('updatedAt', 'asc'));
            const logSnapshot = await getDocs(logsQuery);
            logSnapshot.forEach(logDoc => {
                auditLogs.push({
                    ...(logDoc.data() as AforoCaseUpdate),
                    caseNe: caseItem.ne
                });
            });
        }
        
        await downloadAforoReportAsExcel(allCasesForExport, auditLogs);
        
    } catch (e) {
        console.error("Error exporting data with audit logs: ", e);
        toast({ title: "Error de Exportación", description: "No se pudieron obtener todos los detalles para el reporte.", variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
  };


  const handleSendToDigitization = async () => {
    if (!user?.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'});
        return;
    }
    setIsSendingToDigitization(true);
    try {
        const q = query(collection(db, 'AforoCases'),
            where('revisorStatus', '==', 'Aprobado'),
            where('preliquidationStatus', '==', 'Aprobada')
        );
        const querySnapshot = await getDocs(q);
        const casesToSend = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as AforoCase))
            .filter(c => !c.digitacionStatus || c.digitacionStatus === 'N/A' || c.digitacionStatus === 'Pendiente');
        
        if (casesToSend.length === 0) {
            toast({ title: "Todo al día", description: "No hay nuevos casos aprobados para enviar a digitación." });
            setIsSendingToDigitization(false);
            return;
        }

        const batch = writeBatch(db);
        const newStatus = 'Pendiente de Digitación';

        casesToSend.forEach(caseItem => {
            const caseDocRef = doc(db, 'AforoCases', caseItem.id);
            batch.update(caseDocRef, { digitacionStatus: newStatus });

            const logRef = doc(collection(caseDocRef, 'actualizaciones'));
            const logEntry: AforoCaseUpdate = {
                updatedAt: new Date(),
                updatedBy: user.displayName,
                field: 'digitacionStatus',
                oldValue: caseItem.digitacionStatus || 'N/A',
                newValue: newStatus,
                comment: 'Envío masivo a digitación.'
            };
            batch.set(logRef, logEntry);
        });

        await batch.commit();

        toast({
            title: "Envío Exitoso",
            description: `${casesToSend.length} caso(s) han sido enviados a digitación.`
        });

    } catch (error) {
        console.error("Error sending cases to digitization:", error);
        toast({ title: "Error en envío masivo", description: "No se pudieron enviar los casos a digitación.", variant: "destructive"});
    } finally {
        setIsSendingToDigitization(false);
    }
  };

  const clearFilters = () => {
    setNeInput('');
    setConsigneeInput('');
    setDateRangeInput(undefined);
    setShowPendingOnly(false);
    setAppliedDbFilters({ 
        dateFilterType: 'range',
    });
  }
  
  if (loading || !user || !user.hasReportsAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Tabs defaultValue="aforo" className="w-full">
            <Card>
                 <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <TabsList>
                                <TabsTrigger value="aforo">Aforo</TabsTrigger>
                                <TabsTrigger value="digitacion">Digitación</TabsTrigger>
                            </TabsList>
                             {canCreateReport && (
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button>
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Crear Registro
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuLabel>Tipo de Registro</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => setIsAforoModalOpen(true)}>
                                            Registro de Aforo
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled>Registro de Incidencia (próximamente)</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        <div className="border-t pt-4 space-y-4">
                            <p className="text-sm font-medium text-muted-foreground">Filtros de Búsqueda</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input placeholder="Buscar por NE..." value={neInput} onChange={(e) => setNeInput(e.target.value)} className="w-full sm:w-auto flex-grow" />
                                <Input placeholder="Buscar por Consignatario..." value={consigneeInput} onChange={(e) => setConsigneeInput(e.target.value)} className="w-full sm:w-auto flex-grow" />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button variant={dateFilterType === 'range' ? 'default' : 'ghost'} size="sm" onClick={() => setDateFilterType('range')}><CalendarRange className="mr-2 h-4 w-4"/> Rango</Button>
                                    <Button variant={dateFilterType === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setDateFilterType('month')}><Calendar className="mr-2 h-4 w-4"/> Mes</Button>
                                    <Button variant={dateFilterType === 'today' ? 'default' : 'ghost'} size="sm" onClick={() => setDateFilterType('today')}><CalendarDays className="mr-2 h-4 w-4"/> Hoy</Button>
                                </div>
                                {dateFilterType === 'range' && <DatePickerWithRange date={dateRangeInput} onDateChange={setDateRangeInput} />}
                                {dateFilterType === 'month' && (
                                    <div className="flex gap-2">
                                        <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent></Select>
                                        <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                )}
                            </div>
                             <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                                 <Button onClick={handleSearch} className="w-full sm:w-auto"><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                                <div className="flex justify-end gap-2 w-full sm:w-auto">
                                    {canSendToDigitization && (
                                        <Button onClick={handleSendToDigitization} variant="outline" disabled={isSendingToDigitization}>
                                          {isSendingToDigitization ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                          {isSendingToDigitization ? 'Enviando...' : 'Enviar a Digitación'}
                                        </Button>
                                    )}
                                    <Button variant={showPendingOnly ? 'secondary' : 'outline'} onClick={() => setShowPendingOnly(!showPendingOnly)}>
                                        <Filter className="mr-2 h-4 w-4" /> Pendientes
                                    </Button>
                                    <Button variant="outline" onClick={clearFilters}>Limpiar Filtros</Button>
                                    <Button onClick={handleExport} disabled={allCasesForExport.length === 0 || isExporting}>
                                       {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                       {isExporting ? 'Exportando...' : 'Exportar'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <TabsContent value="aforo">
                        <DailyAforoCasesTable 
                           filters={appliedDbFilters} 
                           setAllFetchedCases={setAllCasesForExport}
                           showPendingOnly={showPendingOnly}
                        />
                    </TabsContent>
                    <TabsContent value="digitacion">
                        <DigitizationCasesTable 
                           filters={appliedDbFilters}
                           setAllFetchedCases={setAllCasesForExport}
                           showPendingOnly={showPendingOnly}
                        />
                    </TabsContent>
                </CardContent>
            </Card>
        </Tabs>
      </div>

       {isAforoModalOpen && <AforoCaseModal isOpen={isAforoModalOpen} onClose={() => setIsAforoModalOpen(false)} />}
       <Dialog open={isDeathkeyModalOpen} onOpenChange={setIsDeathkeyModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Acción "Deathkey"</DialogTitle>
                <DialogDescription>
                    Esta acción reclasificará los casos seleccionados a "Reporte Corporativo", excluyéndolos de la lógica de Aforo.
                    Esta acción es irreversible. Por favor ingrese el PIN para confirmar.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="pin-input" className="flex items-center gap-2"><KeyRound/>PIN de Seguridad</Label>
                <Input
                    id="pin-input"
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Ingrese el PIN de 6 dígitos"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeathkeyModalOpen(false)}>Cancelar</Button>
                <Button variant="destructive" disabled={isSendingToDigitization}>
                    {isSendingToDigitization && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Confirmar y Ejecutar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </AppShell>
  );
}

```
- src/firebase/config.ts:
```ts
// src/firebase/config.ts
import type { FirebaseOptions } from 'firebase/app';

const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

export default firebaseConfig;

```
- tailwindcss-animate:
```

```
