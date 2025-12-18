
"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc, addDoc, getDocs, writeBatch, getCountFromServer, getDoc, documentId, type Query } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { worksheet, DigitacionStatus, no existeUpdate, AppUser, LastUpdateInfo, Worksheet, WorksheetWithCase } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, History, Edit, User, PlusSquare, FileText, Info, Send, AlertTriangle, CheckSquare, ChevronsUpDown, Check, ChevronDown, ChevronRight, BookOpen, Search, MessageSquare, FileSignature, Repeat, Eye, Users, Scale, UserCheck, Shield, ShieldCheck, FileDigit, Truck, Anchor, Plane, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, toDate, isSameDay, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { no existeHistoryModal } from './no existeHistoryModal';
import { DigitizationCommentModal } from './DigitizationCommentModal';
import { CompleteDigitizationModal } from './CompleteDigitizationModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AssignUserModal } from './AssignUserModal';
import { InvolvedUsersModal } from './InvolvedUsersModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileAforoCard } from './MobileAforoCard';
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


interface Dailyno existesTableProps {
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

const LastUpdateTooltip: React.FC<{ lastUpdate?: LastUpdateInfo | null; defaultUser?: string; defaultDate?: Timestamp | Date | null; }> = ({ lastUpdate, defaultUser, defaultDate }) => {
    const displayUser = lastUpdate?.by || defaultUser;
    const displayDate = lastUpdate?.at || defaultDate;

    if (!displayUser || !displayDate) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground ml-1 cursor-pointer"/>
            </TooltipTrigger>
            <TooltipContent>
                <p>Por: {displayUser}</p>
                <p>Fecha: {formatDate(displayDate)}</p>
            </TooltipContent>
        </Tooltip>
    );
};


export function Dailyno existesTable({ cases, isLoading, error, onRefresh }: Dailyno existesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<no existe | null>(null);
  const [selectedCaseForAforadorComment, setSelectedCaseForAforadorComment] = useState<no existe | null>(null);
  const [selectedCaseForIncident, setSelectedCaseForIncident] = useState<no existe | null>(null);
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);
  const [selectedIncidentForDetails, setSelectedIncidentForDetails] = useState<no existe | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<{ isOpen: boolean; case: no existe | null; type: 'aforador' | 'revisor' | 'bulk-aforador' | 'bulk-revisor' }>({ isOpen: false, case: null, type: 'aforador' });
  const [statusModal, setStatusModal] = useState<{isOpen: boolean}>({isOpen: false});
  const [involvedUsersModal, setInvolvedUsersModal] = useState<{ isOpen: boolean; caseData: no existe | null }>({ isOpen: false, caseData: null });
  const [bulkActionResult, setBulkActionResult] = useState<{ isOpen: boolean, success: string[], skipped: string[] }>({ isOpen: false, success: [], skipped: [] });
  const [isDeathkeyModalOpen, setIsDeathkeyModalOpen] = useState(false);
  const isMobile = useIsMobile();
  
  useEffect(() => {
    const fetchAssignableUsers = async () => {
        const usersMap = new Map<string, AppUser>();
        const rolesToFetch = ['aforador', 'coordinadora', 'supervisor', 'digitador', 'agente'];
        const userQueries = rolesToFetch.map(role => query(collection(db, 'users'), where('role', '==', role)));
        
        try {
            const querySnapshots = await Promise.all(userQueries.map(q => getDocs(q)));
            querySnapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const userData = { uid: doc.id, ...doc.data() } as AppUser;
                    if (!usersMap.has(userData.uid) && userData.displayName) {
                        usersMap.set(userData.uid, userData);
                    }
                });
            });
            setAssignableUsers(Array.from(usersMap.values()));
        } catch(e) {
            console.error("Error fetching users", e);
        }
    };
    fetchAssignableUsers();
  }, []);


  const handleAutoSave = useCallback(async (caseId: string, field: keyof worksheet, value: any, isTriggerFromFieldUpdate: boolean = false) => {
    if (!user || !user.displayName) {
        toast({ title: "No autenticado", description: "Debe iniciar sesión para guardar cambios." });
        return;
    }

    const originalCase = cases.find(c => c.id === caseId);
    if (!originalCase) return;

    const oldValue = originalCase[field as keyof no existe];
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
        return;
    }
    
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    
    const caseDocRef = doc(db, 'worksheets', caseId, 'aforo', 'metadata');
    const updatesSubcollectionRef = collection(doc(db, 'worksheets', caseId), 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const updateData: { [key: string]: any } = { [field]: value };
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        const statusFieldMap: {[key: string]: keyof no existe} = {
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

        batch.set(caseDocRef, updateData, { merge: true });

        const updateLog: no existeUpdate = {
            updatedAt: now,
            updatedBy: user.displayName,
            field: field as keyof worksheet,
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
  
  const handleValidatePattern = useCallback(async (caseId: string) => {
    if (!user || !user.displayName) return;

    setSavingState(prev => ({ ...prev, [caseId]: true }));
    const caseDocRef = doc(db, 'worksheets', caseId, 'aforo', 'metadata');
    const updatesSubcollectionRef = collection(doc(db, 'worksheets', caseId), 'actualizaciones');
    
    try {
      const batch = writeBatch(db);
      
      batch.update(caseDocRef, { isPatternValidated: true });

      const validationLog: no existeUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.displayName,
        field: 'isPatternValidated',
        oldValue: false,
        newValue: true,
        comment: `${user.displayName} validó el patrón de declaración.`
      };
      batch.set(doc(updatesSubcollectionRef), validationLog);

      await batch.commit();

      toast({
        title: "Patrón Validado",
        description: "Ahora puede asignar un aforador."
      });
      onRefresh();
    } catch (error) {
      console.error("Error validating pattern:", error);
      toast({ title: "Error", description: "No se pudo validar el patrón.", variant: "destructive" });
    } finally {
       setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, toast, onRefresh]);

  const handleAssignUser = useCallback((caseId: string, userName: string, type: 'aforador' | 'revisor') => {
      const field = type === 'aforador' ? 'aforador' : 'revisorAsignado';
      handleAutoSave(caseId, field, userName);
      if (type === 'aforador') {
        handleAutoSave(caseId, 'assignmentDate', Timestamp.now());
      }
  }, [handleAutoSave]);

   const handleBulkAcknowledge = async () => {
    if (!user || !user.displayName || selectedRows.length === 0) return;
    setIsLoading(true);
    const batch = writeBatch(db);
    const comment = "Se reciben hojas fisicas de casos";

    selectedRows.forEach(wsId => {
        const worksheetRef = doc(db, 'worksheets', wsId);
        const updatesSubcollectionRef = collection(worksheetRef, 'actualizaciones');
        const updateLog = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'document_update',
            oldValue: null,
            newValue: 'worksheet_received',
            comment: comment
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
        batch.set(doc(db, 'worksheets', wsId, 'aforo', 'metadata'), { entregadoAforoAt: Timestamp.now() }, { merge: true });
    });
    
    try {
      await batch.commit();
      toast({
        title: "Acuse Masivo Exitoso",
        description: `${selectedRows.length} caso(s) han sido actualizados.`
      });
      setSelectedRows([]);
      onRefresh();
    } catch (error) {
      console.error("Error with bulk acknowledge:", error);
      toast({ title: "Error", description: "No se pudo registrar el acuse masivo.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const handleAcknowledgeWorksheet = async (caseId: string) => {
    if (!user || !user.displayName) return;
    const worksheetRef = doc(db, 'worksheets', caseId);
    const updatesSubcollectionRef = collection(worksheetRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const logEntry: no existeUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'document_update',
            oldValue: null,
            newValue: 'worksheet_received',
            comment: `El supervisor ${user.displayName} confirma la recepción de la hoja de trabajo.`
        };
        batch.set(doc(updatesSubcollectionRef), logEntry);
        batch.update(doc(db, 'worksheets', caseId, 'aforo', 'metadata'), { entregadoAforoAt: Timestamp.now() });

        await batch.commit();
        
        toast({ title: "Acuse Registrado", description: "Se ha registrado la recepción de la hoja de trabajo en la bitácora." });
        onRefresh();
    } catch (error) {
        console.error("Error acknowledging worksheet:", error);
        toast({ title: "Error", description: "No se pudo registrar el acuse.", variant: "destructive" });
    }
  };

  const handleRequestRevalidation = async (caseItem: no existe) => {
    if (!user || !user.displayName) return;
    const caseDocRef = doc(db, 'worksheets', caseItem.id, 'aforo', 'metadata');
    const updatesSubcollectionRef = collection(doc(db, 'worksheets', caseItem.id), 'actualizaciones');
    const batch = writeBatch(db);

    try {
        batch.update(caseDocRef, { revisorStatus: 'Revalidación Solicitada' });
        
        const logEntry: no existeUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'status_change',
            oldValue: caseItem.revisorStatus,
            newValue: 'Revalidación Solicitada',
            comment: `El aforador ${user.displayName} ha solicitado una revalidación del caso.`
        };
        batch.set(doc(updatesSubcollectionRef), logEntry);
        
        await batch.commit();
        toast({ title: "Revalidación Solicitada", description: "Se ha notificado al revisor para una nueva validación." });
        onRefresh();
     } catch(e) {
        toast({ title: 'Error', description: 'No se pudo solicitar la revalidación.', variant: 'destructive'});
     }
  };
  
  const handleAssignToDigitization = async (caseItem: no existe) => {
     if (!user || !user.displayName) return;
     const caseDocRef = doc(db, 'worksheets', caseItem.id, 'aforo', 'metadata');
     const updatesSubcollectionRef = collection(doc(db, 'worksheets', caseItem.id), 'actualizaciones');
     const batch = writeBatch(db);

     try {
        batch.update(caseDocRef, { digitacionStatus: 'Pendiente de Digitación' });

        const logEntry: no existeUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'status_change',
            oldValue: caseItem.digitacionStatus,
            newValue: 'Pendiente de Digitación',
            comment: 'Caso listo y enviado a digitación.'
        };
        batch.set(doc(updatesSubcollectionRef), logEntry);
        
        await batch.commit();

        toast({ title: 'Enviado a Digitación', description: 'El caso está listo para que el digitador lo procese.' });
        onRefresh();
     } catch(e) {
        toast({ title: 'Error', description: 'No se pudo enviar a digitación.', variant: 'destructive'});
     }
  };

  const handleBulkAction = async (type: 'aforador' | 'revisor' | 'digitador' | 'aforadorStatus' | 'revisorStatus' | 'preliquidationStatus' | 'digitacionStatus', value: string) => {
    if (!user || !user.displayName || selectedRows.length === 0) return;
    
    setIsLoading(true);
    const batch = writeBatch(db);
    
    selectedRows.forEach(wsId => {
      const aforoMetadataRef = doc(db, 'worksheets', wsId, 'aforo', 'metadata');
      const updatesSubcollectionRef = collection(doc(db, 'worksheets', wsId), 'actualizaciones');
      const originalCase = cases.find(c => c.id === wsId);

      if (originalCase) {
        const field = type === 'aforador' ? 'aforador' : type === 'revisor' ? 'revisorAsignado' : type;
        const updateData: {[key: string]: any} = { [field]: value };
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        const statusFieldMap: {[key: string]: keyof no existe} = {
            'revisorAsignado': 'revisorAsignadoLastUpdate',
            'aforador': 'aforadorStatusLastUpdate',
            'digitadorAsignado': 'digitadorAsignadoLastUpdate',
            'aforadorStatus': 'aforadorStatusLastUpdate',
            'revisorStatus': 'revisorStatusLastUpdate',
            'preliquidationStatus': 'preliquidationStatusLastUpdate',
            'digitacionStatus': 'digitacionStatusLastUpdate',
        };
        if (statusFieldMap[field]) updateData[statusFieldMap[field]] = userInfo;
        if (field === 'aforador') updateData.assignmentDate = now;


        batch.set(aforoMetadataRef, updateData, { merge: true });

        const logEntry: no existeUpdate = {
          updatedAt: now,
          updatedBy: user.displayName,
          field: field as keyof worksheet,
          oldValue: originalCase[field as keyof no existe] || null,
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
      setAssignmentModal({ isOpen: false, case: null, type: 'aforador' });
      setStatusModal({ isOpen: false });
    }
  };

  const handleSendSelectedToDigitization = async () => {
    if (!user || !user.displayName || selectedRows.length === 0) return;
    setIsLoading(true);
    const batch = writeBatch(db);
    let successNEs: string[] = [];
    let skippedNEs: string[] = [];
    const newStatus = 'Pendiente de Digitación';

    for(const wsId of selectedRows) {
        const caseItem = cases.find(c => c.id === wsId);
        const aforoData = (caseItem as any)?.aforo;
        if (caseItem && aforoData && aforoData.revisorStatus === 'Aprobado' && aforoData.preliquidationStatus === 'Aprobada' && (!aforoData.digitacionStatus || aforoData.digitacionStatus === 'N/A' || aforoData.digitacionStatus === 'Pendiente')) {
            const caseDocRef = doc(db, 'worksheets', wsId, 'aforo', 'metadata');
            const updatesSubcollectionRef = collection(doc(db, 'worksheets', wsId), 'actualizaciones');
            
            batch.update(caseDocRef, { digitacionStatus: newStatus });
            
            const logEntry: no existeUpdate = {
                updatedAt: Timestamp.now(),
                updatedBy: user.displayName,
                field: 'digitacionStatus',
                oldValue: aforoData.digitacionStatus || 'N/A',
                newValue: newStatus,
                comment: 'Envío masivo a digitación.'
            };
            batch.set(doc(updatesSubcollectionRef), logEntry);
            successNEs.push(caseItem.ne);
        } else if (caseItem) {
            skippedNEs.push(caseItem.ne);
        }
    }

    try {
        if(successNEs.length > 0) {
            await batch.commit();
        }
        setBulkActionResult({ isOpen: true, success: successNEs, skipped: skippedNEs });
        setSelectedRows([]);
        onRefresh();
    } catch (error) {
        console.error("Error bulk sending to digitization:", error);
        toast({ title: 'Error', description: 'No se pudieron enviar los casos a digitación.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
};

  const handleSearchPrevio = (ne: string) => {
    const url = `/database?ne=${encodeURIComponent(ne)}`;
    window.open(url, '_blank');
  };

  const toggleRowExpansion = (caseId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const collapseAllRows = () => {
    setExpandedRows(new Set());
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
  
  const [pinInput, setPinInput] = useState('');

    const handleDeathkey = async () => {
        if (pinInput !== "192438") {
            toast({ title: "PIN Incorrecto", variant: "destructive" });
            return;
        }
        if (selectedRows.length === 0) return;

        setIsLoading(true);
        const batch = writeBatch(db);

        for (const caseId of selectedRows) {
            const caseItem = cases.find(c => c.id === caseId);
            if (caseItem && caseItem.id) {
                const worksheetRef = doc(db, 'worksheets', caseItem.id);
                batch.update(worksheetRef, { worksheetType: 'corporate_report' });

                const updatesSubcollectionRef = collection(worksheetRef, 'actualizaciones');
                const updateLog: no existeUpdate = {
                    updatedAt: Timestamp.now(),
                    updatedBy: user?.displayName || 'Sistema',
                    field: 'worksheetType',
                    oldValue: 'hoja_de_trabajo',
                    newValue: 'corporate_report',
                    comment: 'Caso reclasificado a Reporte Corporativo via Deathkey.'
                };
                batch.set(doc(updatesSubcollectionRef), updateLog);
            }
        }

        try {
            await batch.commit();
            toast({ title: "Éxito", description: `${selectedRows.length} casos han sido reclasificados.` });
            setSelectedRows([]);
            setIsDeathkeyModalOpen(false);
            setPinInput('');
            onRefresh();
        } catch (error) {
            console.error("Error with Deathkey action:", error);
            toast({ title: "Error", description: "No se pudieron reclasificar los casos.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };



  const openHistoryModal = (caseItem: no existe) => setSelectedCaseForHistory(caseItem);
  const openAforadorCommentModal = (caseItem: no existe) => setSelectedCaseForAforadorComment(caseItem);
  const openIncidentModal = (caseItem: no existe) => setSelectedCaseForIncident(caseItem);
  const openObservationModal = (caseItem: no existe) => {
    setSelectedCaseForAforadorComment(caseItem);
  };
  const openAssignmentModal = (caseItem: worksheet, type: 'aforador' | 'revisor') => setAssignmentModal({ isOpen: true, case: caseItem, type });
  
  const handleViewWorksheet = async (caseItem: no existe) => {
    if (!caseItem.worksheetId) {
        toast({ title: "Error", description: "Este caso no tiene una hoja de trabajo asociada.", variant: "destructive" });
        return;
    }
    const worksheetDocRef = doc(db, 'worksheets', caseItem.worksheetId);
    const docSnap = await getDoc(worksheetDocRef);
    if (docSnap.exists()) {
        setSelectedWorksheet({ id: docSnap.id, ...docSnap.data() } as Worksheet);
    } else {
        toast({ title: "Error", description: "No se pudo encontrar la hoja de trabajo.", variant: "destructive" });
    }
  };
  
  const getRevisorStatusBadgeVariant = (status?: no existe['revisorStatus']) => {
    switch (status) { case 'Aprobado': return 'default'; case 'Rechazado': return 'destructive'; case 'Revalidación Solicitada': return 'secondary'; default: return 'outline'; }
  };
  const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) { case 'En revisión': return 'default'; case 'Incompleto': return 'destructive'; case 'En proceso': return 'secondary'; case 'Pendiente': return 'destructive'; default: return 'outline'; }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Cargando registros de aforo...</p>
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
        <p className="mt-1 text-muted-foreground">No hay casos de aforo que cumplan con los filtros actuales.</p>
      </div>
    );
  }
  
  const canEdit = user?.role === 'admin' || user?.role === 'coordinadora' || user?.role === 'supervisor';
  const isAforador = user?.role === 'aforador';
  
  if (isMobile) {
      return (
        <div className="space-y-4">
            {cases.map(c => (
                 <MobileAforoCard
                    key={c.id}
                    caseItem={c}
                    savingState={savingState}
                    canEditFields={canEdit}
                    handleAutoSave={handleAutoSave}
                    handleValidatePattern={handleValidatePattern}
                    openAssignmentModal={openAssignmentModal}
                    openHistoryModal={openHistoryModal}
                    openIncidentModal={openIncidentModal}
                    openAforadorCommentModal={openAforadorCommentModal}
                    openObservationModal={openObservationModal}
                    handleRequestRevalidation={handleRequestRevalidation}
                    handleAssignToDigitization={handleAssignToDigitization}
                    handleViewWorksheet={handleViewWorksheet}
                    setSelectedIncidentForDetails={setSelectedIncidentForDetails}
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
          <Button variant="ghost" size="icon" onClick={collapseAllRows} className="h-8 w-8"><ChevronsUpDown className="h-4 w-4" /></Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={handleBulkAcknowledge} disabled={selectedRows.length === 0}>Enviar Acuse ({selectedRows.length})</Button>
              <Button variant="outline" size="sm" onClick={() => setAssignmentModal({isOpen: true, case: null, type: 'bulk-aforador'})} disabled={selectedRows.length === 0}>Asignar Aforador ({selectedRows.length})</Button>
              <Button variant="outline" size="sm" onClick={() => setAssignmentModal({isOpen: true, case: null, type: 'bulk-revisor'})} disabled={selectedRows.length === 0}>Asignar Revisor ({selectedRows.length})</Button>
              <Button variant="outline" size="sm" onClick={() => setStatusModal({isOpen: true})} disabled={selectedRows.length === 0}>Asignar Estatus ({selectedRows.length})</Button>
              <Button variant="secondary" size="sm" onClick={handleSendSelectedToDigitization} disabled={selectedRows.length === 0}>Enviar a Digitación ({selectedRows.length})</Button>
              <Button variant="destructive" size="sm" onClick={() => setIsDeathkeyModalOpen(true)} disabled={selectedRows.length === 0}>Deathkey Masivo ({selectedRows.length})</Button>
            </>
          )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"><Checkbox checked={selectedRows.length > 0 && selectedRows.length === cases.length} onCheckedChange={toggleSelectAll}/></TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Insignias</TableHead>
            <TableHead>Ejecutivo</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Aforador</TableHead>
            <TableHead>Fecha Asignación</TableHead>
            <TableHead>Estatus Aforador</TableHead>
            <TableHead>Revisor</TableHead>
            <TableHead>Estatus Revisor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseItem) => {
            const aforoData = (caseItem as any).aforo || {};
            const isExpanded = expandedRows.has(caseItem.id);
            const daysUntilDue = caseItem.resaDueDate ? differenceInDays(caseItem.resaDueDate.toDate(), new Date()) : null;
            const isResaCritical = daysUntilDue !== null && daysUntilDue < -15;

            const rowClass = cn(
              savingState[caseItem.id] && "bg-amber-100",
              isResaCritical ? "bg-red-200 hover:bg-red-200/80" : (caseItem.incidentReported ? "bg-red-100 hover:bg-red-100/80" : (aforoData.aforadorStatus === 'Pendiente ' ? "bg-red-50 hover:bg-red-100/60" : ""))
            );
            
            const canEditThisRow = canEdit || (user?.role === 'aforador' && user?.displayName === aforoData.aforador);
            const canExpandRow = user?.role === 'aforador' || canEdit;
            const isPatternValidated = aforoData.isPatternValidated === true;
            const allowPatternEdit = aforoData.revisorStatus === 'Rechazado';
            
            const hasAcuse = aforoData.entregadoAforoAt;

            return (
            <React.Fragment key={caseItem.id}>
            <TableRow className={rowClass} data-state={selectedRows.includes(caseItem.id) ? "selected" : undefined}>
              <TableCell><Checkbox checked={selectedRows.includes(caseItem.id)} onCheckedChange={() => toggleRowSelection(caseItem.id)}/></TableCell>
              <TableCell>
                  {canExpandRow && (
                    <Button variant="ghost" size="icon" onClick={() => toggleRowExpansion(caseItem.id)} className="h-8 w-8">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  )}
              </TableCell>
               <TableCell>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <PlusSquare className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {caseItem.id && (
                             <DropdownMenuItem onSelect={() => handleViewWorksheet(caseItem)}>
                                <BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => handleSearchPrevio(caseItem.ne)}>
                            <Search className="mr-2 h-4 w-4" /> Buscar Previo
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openObservationModal(caseItem)}>
                            <MessageSquare className="mr-2 h-4 w-4" /> Observación
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openHistoryModal(caseItem)}>
                            <History className="mr-2 h-4 w-4" /> Ver Bitácora
                        </DropdownMenuItem>
                        { (canEditThisRow) && (
                            <DropdownMenuItem onSelect={() => openIncidentModal(caseItem)}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia
                            </DropdownMenuItem>
                        )}
                        {caseItem.incidentReported && (
                            <DropdownMenuItem onSelect={() => setSelectedIncidentForDetails(caseItem)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver Incidencia
                            </DropdownMenuItem>
                        )}
                        { (user?.role === 'aforador' || user?.role === 'admin') && aforoData.revisorStatus === 'Rechazado' && (
                           <DropdownMenuItem onSelect={() => handleRequestRevalidation(caseItem)}>
                               <Repeat className="mr-2 h-4 w-4" /> Solicitar Revalidación
                           </DropdownMenuItem>
                        )}
                         { (canEdit) && aforoData.revisorStatus === 'Aprobado' && (
                           <DropdownMenuItem onSelect={() => handleAssignToDigitization(caseItem)} disabled={aforoData.preliquidationStatus !== 'Aprobada'}>
                               <Send className="mr-2 h-4 w-4" /> Asignar a Digitación
                           </DropdownMenuItem>
                        )}
                        {canEdit && (
                            <DropdownMenuItem onSelect={() => handleAcknowledgeWorksheet(caseItem.id)}>
                                <FileSignature className="mr-2 h-4 w-4 text-blue-600" /> Acuse de Hoja
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                 </DropdownMenu>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                    <span className="font-medium">{caseItem.ne}</span>
                    {caseItem.incidentReported && canEdit && (
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => setInvolvedUsersModal({ isOpen: true, caseData: caseItem })}>
                                    <Users className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Asignar Involucrados</p></TooltipContent>
                        </Tooltip>
                    )}
                </div>
              </TableCell>
              <TableCell>
                  <StatusBadges caseData={{...caseItem, entregadoAforoAt: hasAcuse }} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                    <span>{caseItem.executive}</span>
                       <LastUpdateTooltip lastUpdate={{by: caseItem.executive, at: caseItem.createdAt}} caseCreation={caseItem.createdAt} />
                  </div>
              </TableCell>
              <TableCell>{caseItem.consignee}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{aforoData.aforador || 'Sin asignar'}</span>
                  <LastUpdateTooltip lastUpdate={aforoData.aforadorAssignedAt ? { by: aforoData.aforadorAssignedBy, at: aforoData.aforadorAssignedAt } : undefined} defaultUser={caseItem.executive} defaultDate={caseItem.createdAt} />
                </div>
              </TableCell>
              <TableCell>
                {formatDate(aforoData.assignmentDate)}
              </TableCell>
              <TableCell>
                 <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                                value={aforoData.aforadorStatus ?? ''}
                                onValueChange={(value: AforadorStatus) => handleAutoSave(caseItem.id, 'aforadorStatus', value)}
                                disabled={!canEditThisRow || !aforoData.aforador}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Seleccionar estado..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pendiente ">Pendiente </SelectItem>
                                    <SelectItem value="En proceso">En proceso</SelectItem>
                                    <SelectItem value="Incompleto">Incompleto</SelectItem>
                                    <SelectItem value="En revisión">En revisión</SelectItem>
                                </SelectContent>
                            </Select>
                           </div>
                          </TooltipTrigger>
                          {!aforoData.aforador &&
                              <TooltipContent>
                                  <p>Debe asignar un aforador primero.</p>
                              </TooltipContent>
                          }
                      </Tooltip>
                    </TooltipProvider>
                    {(aforoData.aforadorStatus === 'Incompleto') && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAforadorCommentModal(caseItem)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Ver/Editar motivo</p></TooltipContent>
                        </Tooltip>
                    )}
                    <LastUpdateTooltip lastUpdate={aforoData.aforadorStatusLastUpdate} caseCreation={caseItem.createdAt} />
                 </div>
              </TableCell>
               <TableCell>
                 <div className="flex items-center gap-2">
                   <span>{aforoData.revisorAsignado || 'Sin asignar'}</span>
                   <LastUpdateTooltip lastUpdate={aforoData.revisorAsignadoLastUpdate} caseCreation={caseItem.createdAt} />
                 </div>
              </TableCell>
               <TableCell>
                    <div className="flex items-center">
                        <Badge variant={getRevisorStatusBadgeVariant(aforoData.revisorStatus)}>{aforoData.revisorStatus || 'Pendiente'}</Badge>
                        <LastUpdateTooltip lastUpdate={aforoData.revisorStatusLastUpdate} caseCreation={caseItem.createdAt}/>
                    </div>
              </TableCell>
            </TableRow>
             {isExpanded && canExpandRow && (
                <TableRow className="bg-muted/30 hover:bg-muted/40">
                  <TableCell colSpan={13} className="p-0">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-end gap-2">
                          <div className="flex-grow">
                              <label className="text-xs font-medium text-muted-foreground">Modelo (Patrón)</label>
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn("w-full justify-between", !caseItem.declarationPattern && "text-muted-foreground")}
                                      disabled={!canEditThisRow || isPatternValidated && !allowPatternEdit}
                                      >
                                      {caseItem.declarationPattern
                                          ? tiposDeclaracion.find(
                                              (tipo) => tipo.value === caseItem.declarationPattern
                                          )?.value
                                          : "Seleccionar..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                      <Command>
                                          <CommandInput placeholder="Buscar por código..." />
                                          <CommandList>
                                              <CommandEmpty>No se encontró el modelo.</CommandEmpty>
                                              <CommandGroup>
                                                  {tiposDeclaracion.map((tipo) => (
                                                  <CommandItem
                                                      value={tipo.value}
                                                      key={tipo.value}
                                                      onSelect={() => {
                                                          handleAutoSave(caseItem.id, 'declarationPattern', tipo.value, true);
                                                          (document.activeElement as HTMLElement)?.blur();
                                                      }}
                                                  >
                                                      <Check className={cn("mr-2 h-4 w-4", tipo.value === caseItem.declarationPattern ? "opacity-100" : "opacity-0"
                                                      )} />
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
                          </div>
                          <Button 
                            onClick={() => handleValidatePattern(caseItem.id)}
                            disabled={isPatternValidated || !caseItem.declarationPattern || savingState[caseItem.id]}
                          >
                            <CheckSquare className="mr-2 h-4 w-4" /> Validar
                          </Button>
                      </div>
                       <div>
                        <label className="text-xs font-medium text-muted-foreground">Mercancía</label>
                        <Input 
                          defaultValue={caseItem.merchandise} 
                          onBlur={(e) => handleAutoSave(caseItem.id, 'merchandise', e.target.value)}
                          disabled={!canEditThisRow}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Asignar Aforador</label>
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <div className="w-full">
                                  <Button
                                      variant="outline"
                                      onClick={() => openAssignmentModal(caseItem, 'aforador')}
                                      disabled={!canEdit}
                                      className="w-full justify-between"
                                  >
                                      {aforoData.aforador || "Asignar..."}
                                      <User className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                  </Button>
                               </div>
                           </TooltipTrigger>
                        </Tooltip>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Asignar Revisor</label>
                        <Tooltip>
                           <TooltipTrigger asChild>
                               <div className="w-full">
                                <Button
                                    variant="outline"
                                    onClick={() => openAssignmentModal(caseItem, 'revisor')}
                                    disabled={!canEdit}
                                    className="w-full justify-between"
                                >
                                    {aforoData.revisorAsignado || "Asignar..."}
                                    <UserCheck className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                </Button>
                                </div>
                           </TooltipTrigger>
                        </Tooltip>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Total Posiciones</label>
                        <Input 
                          type="number"
                          defaultValue={aforoData.totalPosiciones} 
                          onBlur={(e) => handleAutoSave(caseItem.id, 'totalPosiciones', e.target.valueAsNumber)}
                           disabled={!canEditThisRow}
                        />
                      </div>
                       <div>
                        <label className="text-xs font-medium text-muted-foreground">Entregado a Aforo</label>
                         <DatePickerWithTime
                            date={(aforoData.entregadoAforoAt as Timestamp)?.toDate()}
                            onDateChange={() => {}} // This is now read-only
                            disabled={true}
                         />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
             )}
            </React.Fragment>
            )})}
        </TableBody>
      </Table>
    </div>
    </TooltipProvider>
    {selectedCaseForHistory && (
        <no existeHistoryModal
            isOpen={!!selectedCaseForHistory}
            onClose={() => setSelectedCaseForHistory(null)}
            caseData={selectedCaseForHistory}
        />
    )}
     {selectedCaseForAforadorComment && (
        <AforadorCommentModal
            isOpen={!!selectedCaseForAforadorComment}
            onClose={() => setSelectedCaseForAforadorComment(null)}
            worksheet={selectedCaseForAforadorComment as unknown as Worksheet}
        />
    )}
    {selectedCaseForIncident && (
        <IncidentReportModal
            isOpen={!!selectedCaseForIncident}
            onClose={() => setSelectedCaseForIncident(null)}
            caseData={selectedCaseForIncident}
        />
    )}
    {selectedIncidentForDetails && (
        <IncidentReportDetails
            caseData={selectedIncidentForDetails}
            onClose={() => setSelectedIncidentForDetails(null)}
        />
    )}
    {selectedWorksheet && (
        <WorksheetDetailModal
            isOpen={!!selectedWorksheet}
            onClose={() => setSelectedWorksheet(null)}
            worksheet={selectedWorksheet}
        />
    )}
    {assignmentModal.isOpen && (
        <AssignUserModal
            isOpen={assignmentModal.isOpen}
            onClose={() => setAssignmentModal({ isOpen: false, case: null, type: 'aforador' })}
            caseData={assignmentModal.case}
            assignableUsers={
              assignmentModal.type.includes('bulk')
                ? assignmentModal.type === 'bulk-aforador'
                  ? assignableUsers.filter(u => u.role === 'aforador' || u.role === 'coordinadora' || u.role === 'supervisor')
                  : assignableUsers.filter(u => u.roleTitle === 'agente aduanero' || (u.role === 'supervisor' && u.roleTitle === 'PSMT'))
                : assignmentModal.type === 'aforador'
                  ? assignableUsers.filter(u => u.role === 'aforador' || u.role === 'coordinadora' || u.role === 'supervisor')
                  : assignableUsers.filter(u => u.roleTitle === 'agente aduanero' || (u.role === 'supervisor' && u.roleTitle === 'PSMT'))
            }
            onAssign={(caseId, userName) => assignmentModal.type.includes('bulk') ? handleBulkAction(assignmentModal.type.split('-')[1] as 'aforador' | 'revisor', userName) : handleAssignUser(caseId, userName, assignmentModal.type as 'aforador' | 'revisor')}
            title={`Asignar ${assignmentModal.type.includes('bulk') ? (assignmentModal.type.split('-')[1] === 'aforador' ? 'Aforador Masivo' : 'Revisor Masivo') : (assignmentModal.type === 'aforador' ? 'Aforador' : 'Revisor')}`}
            description={assignmentModal.case ? `Seleccione un usuario para asignar al caso NE: ${assignmentModal.case.ne}` : `Seleccione un usuario para asignar a los ${selectedRows.length} casos seleccionados.`}
        />
    )}
     <Dialog open={statusModal.isOpen} onOpenChange={() => setStatusModal({isOpen: false, caseData: undefined})}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Asignar Estatus Masivo</DialogTitle>
                  <DialogDescription>
                    Seleccione el estatus a aplicar a los {selectedRows.length} casos seleccionados.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                 <Button onClick={() => handleBulkAction('aforadorStatus', 'Pendiente ')}>Aforador: Pendiente</Button>
                 <Button onClick={() => handleBulkAction('aforadorStatus', 'En proceso')}>Aforador: En Proceso</Button>
                 <Button onClick={() => handleBulkAction('aforadorStatus', 'En revisión')}>Aforador: En Revisión</Button>
                 <Button onClick={() => handleBulkAction('aforadorStatus', 'Incompleto')}>Aforador: Incompleto</Button>
                 <div className="col-span-2 h-px bg-border my-2"/>
                 <Button onClick={() => handleBulkAction('revisorStatus', 'Pendiente')}>Revisor: Pendiente</Button>
                 <Button onClick={() => handleBulkAction('revisorStatus', 'Aprobado')}>Revisor: Aprobado</Button>
                 <Button variant="destructive" onClick={() => handleBulkAction('revisorStatus', 'Rechazado')}>Revisor: Rechazado</Button>
                 <Button onClick={() => handleBulkAction('revisorStatus', 'Revalidación Solicitada')}>Revisor: Revalidación</Button>
                 <div className="col-span-2 h-px bg-border my-2"/>
                 <Button onClick={() => handleBulkAction('digitacionStatus', 'Pendiente de Digitación')}>Digitador: Pendiente</Button>
                 <Button onClick={() => handleBulkAction('digitacionStatus', 'En Proceso')}>Digitador: En Proceso</Button>
                 <Button onClick={() => handleBulkAction('digitacionStatus', 'Almacenado')}>Digitador: Almacenado</Button>
              </div>
          </DialogContent>
      </Dialog>
    {involvedUsersModal.isOpen && involvedUsersModal.caseData && (
        <InvolvedUsersModal
          isOpen={involvedUsersModal.isOpen}
          onClose={() => setInvolvedUsersModal({ isOpen: false, caseData: null })}
          caseData={involvedUsersModal.caseData}
          allUsers={assignableUsers}
        />
    )}
     <AlertDialog open={bulkActionResult.isOpen} onOpenChange={(isOpen) => setBulkActionResult(prev => ({...prev, isOpen}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <DialogTitle>Resultado del Envío Masivo</DialogTitle>
                <AlertDialogDescription>
                    <div className="space-y-4 max-h-60 overflow-y-auto">
                        {bulkActionResult.success.length > 0 && (
                            <div>
                                <p className="font-semibold text-green-600">Casos enviados a digitación exitosamente:</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {bulkActionResult.success.map(ne => <li key={ne}>{ne}</li>)}
                                </ul>
                            </div>
                        )}
                        {bulkActionResult.skipped.length > 0 && (
                             <div>
                                <p className="font-semibold text-amber-600">Casos omitidos (no cumplían los criterios):</p>
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
     <Dialog open={isDeathkeyModalOpen} onOpenChange={setIsDeathkeyModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Acción "Deathkey"</DialogTitle>
                <DialogDescription>
                    Esta acción reclasificará {selectedRows.length} caso(s) a "Reporte Corporativo", excluyéndolos de la lógica de Aforo.
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
                <Button variant="destructive" onClick={handleDeathkey} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Confirmar y Ejecutar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

```