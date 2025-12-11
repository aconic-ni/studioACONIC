"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc, addDoc, getDocs, writeBatch, getCountFromServer, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, AforadorStatus, Worksheet, DigitacionStatus, PreliquidationStatus, LastUpdateInfo, WorksheetWithCase, AforoCaseUpdate } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, History, Edit, User, PlusSquare, FileText, Info, Send, AlertTriangle, CheckSquare, ChevronsUpDown, Check, ChevronDown, ChevronRight, BookOpen, Search, MessageSquare, FileSignature, Repeat, Eye, Users, Scale, UserCheck, Shield, ShieldCheck, FileDigit, Truck, Anchor, Plane } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, toDate, isSameDay, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AforoCaseHistoryModal } from './AforoCaseHistoryModal';
import { AforadorCommentModal } from './AforadorCommentModal';
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
import { WorksheetDetailModal } from './WorksheetDetailModal';
import { ScrollArea } from '../ui/scroll-area';
import { Anexo5Details } from '../executive/anexos/Anexo5Details';


interface DailyAforoCasesTableProps {
  filters: {
    ne?: string;
    consignee?: string;
    dateRange?: DateRange;
    dateFilterType: 'range' | 'month' | 'today';
    showPendingOnly?: boolean;
  };
  setAllFetchedCases: (cases: WorksheetWithCase[]) => void;
  displayCases: WorksheetWithCase[];
}

const formatDate = (date: Date | Timestamp | null | undefined, includeTime: boolean = true): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    if (d instanceof Date && !isNaN(d.getTime())) {
        const formatString = includeTime ? 'dd/MM/yy HH:mm' : 'dd/MM/yy';
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


export function DailyAforoCasesTable({ filters, setAllFetchedCases, displayCases }: DailyAforoCasesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForAforadorComment, setSelectedCaseForAforadorComment] = useState<AforoCase | null>(null);
  const [selectedCaseForIncident, setSelectedCaseForIncident] = useState<AforoCase | null>(null);
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);
  const [selectedIncidentForDetails, setSelectedIncidentForDetails] = useState<AforoCase | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<{ isOpen: boolean; case: AforoCase | null; type: 'aforador' | 'revisor' }>({ isOpen: false, case: null, type: 'aforador' });
  const [involvedUsersModal, setInvolvedUsersModal] = useState<{ isOpen: boolean; caseData: AforoCase | null }>({ isOpen: false, caseData: null });
  const [caseAuditLogs, setCaseAuditLogs] = useState<Map<string, AforoCaseUpdate[]>>(new Map());
  const [bulkActionResult, setBulkActionResult] = useState<{ isOpen: boolean, success: string[], skipped: string[] }>({ isOpen: false, success: [], skipped: [] });


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
  
  const handleValidatePattern = useCallback(async (caseId: string) => {
    if (!user || !user.displayName) return;

    setSavingState(prev => ({ ...prev, [caseId]: true }));
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    
    try {
      const batch = writeBatch(db);
      
      batch.update(caseDocRef, { isPatternValidated: true });

      const validationLog: AforoCaseUpdate = {
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
    } catch (error) {
      console.error("Error validating pattern:", error);
      toast({ title: "Error", description: "No se pudo validar el patrón.", variant: "destructive" });
    } finally {
       setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, toast]);

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

    selectedRows.forEach(caseId => {
      const caseDocRef = doc(db, 'AforoCases', caseId);
      const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
      const updateLog: AforoCaseUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.displayName,
        field: 'document_update',
        oldValue: null,
        newValue: 'worksheet_received',
        comment: comment
      };
      batch.set(doc(updatesSubcollectionRef), updateLog);
    });

    try {
      await batch.commit();
      toast({
        title: "Acuse Masivo Exitoso",
        description: `${selectedRows.length} caso(s) han sido actualizados en la bitácora.`
      });
      setSelectedRows([]);
    } catch (error) {
      console.error("Error with bulk acknowledge:", error);
      toast({ title: "Error", description: "No se pudo registrar el acuse masivo.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const handleAcknowledgeWorksheet = async (caseId: string) => {
    if (!user || !user.displayName) return;
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    try {
        const logEntry: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'document_update',
            oldValue: null,
            newValue: 'worksheet_received',
            comment: `El supervisor ${user.displayName} confirma la recepción de la hoja de trabajo.`
        };
        await addDoc(updatesSubcollectionRef, logEntry);
        toast({ title: "Acuse Registrado", description: "Se ha registrado la recepción de la hoja de trabajo en la bitácora." });
    } catch (error) {
        console.error("Error acknowledging worksheet:", error);
        toast({ title: "Error", description: "No se pudo registrar el acuse.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
  
    const fetchAssignableUsers = async () => {
        const usersMap = new Map<string, AppUser>();
        const rolesToFetch = ['aforador', 'coordinadora', 'supervisor', 'digitador'];
        const agentRoleTitle = 'agente aduanero';
        const psmtSupervisorTitle = 'PSMT';


        const roleQueries = rolesToFetch.map(role => query(collection(db, 'users'), where('role', '==', role)));
        roleQueries.push(query(collection(db, 'users'), where('roleTitle', '==', agentRoleTitle)));
        
        try {
            const querySnapshots = await Promise.all(roleQueries.map(q => getDocs(q)));
            querySnapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const userData = { uid: doc.id, ...doc.data() } as AppUser;
                    if (!usersMap.has(userData.uid) && userData.displayName) {
                         // Condition to add to revisor list
                        if (userData.roleTitle === agentRoleTitle || (userData.role === 'supervisor' && userData.roleTitle === psmtSupervisorTitle)) {
                           usersMap.set(userData.uid, userData);
                        }
                        // General condition for other roles
                        else if (rolesToFetch.includes(userData.role as string)) {
                           usersMap.set(userData.uid, userData);
                        }
                    }
                });
            });
            setAssignableUsers(Array.from(usersMap.values()));
        } catch (e) {
            console.error("Failed to fetch assignable users: ", e);
        }
    };

    fetchAssignableUsers();
    
    let qCases;
    const isPsmtSupervisor = user.role === 'supervisor' && user.roleTitle === 'PSMT';
    
    if (isPsmtSupervisor) {
      qCases = query(collection(db, "AforoCases"), where('consignee', '==', 'PSMT NICARAGUA, SOCIEDAD ANONIMA'), orderBy('createdAt', 'desc'));
    } else {
      qCases = query(collection(db, "AforoCases"), orderBy('createdAt', 'desc'));
    }
    
    const unsubscribe = onSnapshot(qCases, async (aforoSnapshot) => {
        const aforoCasesData: AforoCase[] = aforoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        
        const worksheetsSnap = await getDocs(collection(db, 'worksheets'));
        const worksheetsMap = new Map(worksheetsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Worksheet]));

        const combinedData = aforoCasesData
            .map(caseItem => ({
                ...caseItem,
                worksheet: worksheetsMap.get(caseItem.worksheetId || '') || null,
            }))
             .filter(c => 
                c.worksheet?.worksheetType === 'hoja_de_trabajo' || 
                c.worksheet?.worksheetType === undefined
            );
            
        const auditLogPromises = combinedData.map(async (caseItem) => {
            const updatesRef = collection(db, 'AforoCases', caseItem.id, 'actualizaciones');
            const updatesSnapshot = await getDocs(query(updatesRef, orderBy('updatedAt', 'desc')));
            return {
                caseId: caseItem.id,
                logs: updatesSnapshot.docs.map(doc => doc.data() as AforoCaseUpdate)
            };
        });
        
        const auditLogsResults = await Promise.all(auditLogPromises);
        const newAuditLogs = new Map<string, AforoCaseUpdate[]>();
        auditLogsResults.forEach(result => {
            newAuditLogs.set(result.caseId, result.logs);
        });
        setCaseAuditLogs(newAuditLogs);

        let filtered = combinedData;
        if (filters.ne) {
          filtered = filtered.filter(c => c.ne.toUpperCase().includes(filters.ne!.toUpperCase()));
        }
        if (filters.consignee) {
          filtered = filtered.filter(c => c.consignee.toLowerCase().includes(filters.consignee!.toLowerCase()));
        }
        if (filters.dateRange?.from) {
          const start = filters.dateRange.from;
          const end = endOfDay(filters.dateRange.to || filters.dateRange.from);
          filtered = filtered.filter(c => {
            const caseDate = (c.createdAt as Timestamp)?.toDate();
            return caseDate && caseDate >= start && caseDate <= end;
          });
        }
      
        setAllFetchedCases(filtered);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching cases:", error);
        toast({ title: "Error de Carga", description: "No se pudieron cargar los casos. Verifique los índices de Firestore.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, filters, setAllFetchedCases, toast]);
  
  const handleRequestRevalidation = async (caseItem: AforoCase) => {
     if (!user || !user.displayName) return;
     
     const newStatus: AforoCaseStatus = 'Revalidación Solicitada';
     const caseDocRef = doc(db, 'AforoCases', caseItem.id);
     const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

     try {
        await updateDoc(caseDocRef, { 
            revisorStatus: newStatus,
            revisorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });
        
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'status_change',
            oldValue: caseItem.revisorStatus || 'Pendiente',
            newValue: newStatus,
            comment: "El aforador/admin solicita revalidación del caso.",
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        toast({ title: "Solicitud Enviada", description: "Se ha solicitado la revalidación al agente." });
     } catch(e) {
        console.error(e);
        toast({title: "Error", description: "No se pudo solicitar la revalidación", variant: "destructive"});
     }
  }

  const handleAssignToDigitization = async (caseItem: AforoCase, force: boolean = false) => {
    if (!user || !user.displayName) return;
    
    // PSMT Supervisor Logic for single case
    const isPsmtCase = caseItem.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA";
    const isPsmtSupervisor = user.role === 'supervisor' && user.roleTitle === 'PSMT';
    const acuseLog = caseAuditLogs.get(caseItem.id)?.find(log => log.newValue === 'worksheet_received');
    
    if (isPsmtSupervisor && isPsmtCase && acuseLog && !force) {
        // Automatically approve and send
        setIsLoading(true);
        const batch = writeBatch(db);
        const caseDocRef = doc(db, 'AforoCases', caseItem.id);
        const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        batch.update(caseDocRef, {
            revisorStatus: 'Aprobado',
            preliquidationStatus: 'Aprobada',
            digitacionStatus: 'Pendiente de Digitación',
            revisorStatusLastUpdate: userInfo,
            preliquidationStatusLastUpdate: userInfo,
            digitacionStatusLastUpdate: userInfo,
        });

        // Add logs for each auto-approval
        const logComment = "Aprobación y envío automático para caso PSMT con acuse.";
        batch.set(doc(updatesSubcollectionRef), { updatedAt: now, updatedBy: user.displayName, field: 'revisorStatus', oldValue: caseItem.revisorStatus, newValue: 'Aprobado', comment: logComment });
        batch.set(doc(updatesSubcollectionRef), { updatedAt: now, updatedBy: user.displayName, field: 'preliquidationStatus', oldValue: caseItem.preliquidationStatus, newValue: 'Aprobada', comment: logComment });
        batch.set(doc(updatesSubcollectionRef), { updatedAt: now, updatedBy: user.displayName, field: 'digitacionStatus', oldValue: caseItem.digitacionStatus, newValue: 'Pendiente de Digitación', comment: logComment });

        try {
            await batch.commit();
            toast({ title: 'Proceso PSMT Acelerado', description: `Caso ${caseItem.ne} aprobado y enviado a digitación.` });
        } catch(e) { console.error(e); toast({ title: "Error en flujo PSMT", variant: "destructive"}); } 
        finally { setIsLoading(false); }
        return;
    }

    // Standard logic
    if (caseItem.revisorStatus !== 'Aprobado') {
        toast({ title: "Acción no permitida", description: "El caso debe estar aprobado por el revisor.", variant: "destructive" });
        return;
    }
     if (caseItem.preliquidationStatus !== 'Aprobada') {
        toast({ title: "Acción no permitida", description: "La preliquidación debe estar aprobada por el ejecutivo.", variant: "destructive" });
        return;
    }
    
    const isGeneralSupervisor = user.role === 'supervisor' && user.roleTitle !== 'PSMT';

    if (isGeneralSupervisor && isPsmtCase) {
        toast({ title: "Acción no permitida", description: "No puede enviar casos de PSMT a digitación.", variant: "destructive" });
        return;
    }
    if (isPsmtSupervisor && !isPsmtCase) {
        toast({ title: "Acción no permitida", description: "Solo puede enviar casos de PSMT a digitación.", variant: "destructive" });
        return;
    }

    const newStatus: DigitacionStatus = 'Pendiente de Digitación';
    const caseDocRef = doc(db, 'AforoCases', caseItem.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    try {
        await updateDoc(caseDocRef, { 
            digitacionStatus: newStatus,
            digitacionStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });
        
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'digitacionStatus',
            oldValue: caseItem.digitacionStatus || 'N/A',
            newValue: newStatus,
            comment: "Caso aprobado y asignado a digitación.",
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        toast({ title: "Asignado a Digitación", description: `El caso NE ${caseItem.ne} está listo para ser digitado.` });
     } catch(e) {
        console.error(e);
        toast({title: "Error", description: "No se pudo asignar el caso a digitación.", variant: "destructive"});
     }
  };

  const handleSendSelectedToDigitization = async () => {
    if (!user?.displayName || selectedRows.length === 0) return;

    const allSelectedArePsmt = selectedRows.every(id => displayCases.find(c => c.id === id)?.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA");

    if (allSelectedArePsmt) {
        // If ALL selected are PSMT, run the special PSMT flow for those with acuse
        const successCases: string[] = [];
        const skippedCases: string[] = [];
        const batch = writeBatch(db);
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        for (const caseId of selectedRows) {
            const caseItem = displayCases.find(c => c.id === caseId);
            if (!caseItem) continue;
            
            const acuseLog = caseAuditLogs.get(caseId)?.find(log => log.newValue === 'worksheet_received');
            if (acuseLog) {
                const caseDocRef = doc(db, 'AforoCases', caseId);
                const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
                batch.update(caseDocRef, {
                    revisorStatus: 'Aprobado',
                    preliquidationStatus: 'Aprobada',
                    digitacionStatus: 'Pendiente de Digitación',
                    revisorStatusLastUpdate: userInfo,
                    preliquidationStatusLastUpdate: userInfo,
                    digitacionStatusLastUpdate: userInfo,
                });
                const logComment = `Envío masivo: Aprobación y envío automático para caso PSMT con acuse.`;
                batch.set(doc(updatesSubcollectionRef), { updatedAt: now, updatedBy: user.displayName, field: 'revisorStatus', oldValue: caseItem.revisorStatus, newValue: 'Aprobado', comment: logComment });
                batch.set(doc(updatesSubcollectionRef), { updatedAt: now, updatedBy: user.displayName, field: 'preliquidationStatus', oldValue: caseItem.preliquidationStatus, newValue: 'Aprobada', comment: logComment });
                batch.set(doc(updatesSubcollectionRef), { updatedAt: now, updatedBy: user.displayName, field: 'digitacionStatus', oldValue: caseItem.digitacionStatus, newValue: 'Pendiente de Digitación', comment: logComment });
                successCases.push(caseItem.ne);
            } else {
                skippedCases.push(caseItem.ne);
            }
        }
        
        if (successCases.length > 0) {
            await batch.commit();
        }
        setBulkActionResult({ isOpen: true, success: successCases, skipped: skippedCases });
        setSelectedRows([]);

    } else {
        // If it's a mixed selection, only process non-PSMT cases that are ready.
        const nonPsmtReadyCases = selectedRows
            .map(id => displayCases.find(c => c.id === id))
            .filter(c => c && c.consignee.toUpperCase().trim() !== "PSMT NICARAGUA, SOCIEDAD ANONIMA" && c.revisorStatus === 'Aprobado' && c.preliquidationStatus === 'Aprobada');
        
        const skippedPsmtCases = selectedRows
            .map(id => displayCases.find(c => c.id === id))
            .filter(c => c && c.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA")
            .map(c => c!.ne);

        if (nonPsmtReadyCases.length === 0) {
            setBulkActionResult({ isOpen: true, success: [], skipped: skippedPsmtCases });
            return;
        }

        const batch = writeBatch(db);
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        nonPsmtReadyCases.forEach(caseItem => {
             const caseDocRef = doc(db, 'AforoCases', caseItem!.id);
             const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
             batch.update(caseDocRef, { digitacionStatus: 'Pendiente de Digitación', digitacionStatusLastUpdate: userInfo });
             const logComment = `Envío masivo a digitación.`;
             batch.set(doc(updatesSubcollectionRef), { updatedAt: now, updatedBy: user.displayName, field: 'digitacionStatus', oldValue: caseItem!.digitacionStatus, newValue: 'Pendiente de Digitación', comment: logComment });
        });

        await batch.commit();
        setBulkActionResult({ isOpen: true, success: nonPsmtReadyCases.map(c => c!.ne), skipped: skippedPsmtCases });
        setSelectedRows([]);
    }
  };


  const handleSearchPrevio = (ne: string) => {
    router.push(`/database?ne=${ne}`);
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
    if (selectedRows.length === displayCases.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(displayCases.map(c => c.id));
    }
  };

  const toggleRowSelection = (caseId: string) => {
    setSelectedRows(prev => 
      prev.includes(caseId) ? prev.filter(id => id !== caseId) : [...prev, caseId]
    );
  };


  const openHistoryModal = (caseItem: AforoCase) => setSelectedCaseForHistory(caseItem);
  const openAforadorCommentModal = (caseItem: AforoCase) => setSelectedCaseForAforadorComment(caseItem);
  const openIncidentModal = (caseItem: AforoCase) => setSelectedCaseForIncident(caseItem);
  const openObservationModal = (caseItem: AforoCase) => {
    if (caseItem) {
        openAforadorCommentModal(caseItem);
    }
  };
  const openAssignmentModal = (caseItem: AforoCase, type: 'aforador' | 'revisor') => setAssignmentModal({ isOpen: true, case: caseItem, type });
  
  const handleViewWorksheet = async (caseItem: AforoCase) => {
    if (!caseItem.worksheetId) {
        toast({ title: "Error", description: "Este caso no tiene una hoja de trabajo asociada.", variant: "destructive" });
        return;
    }
    const worksheetDocRef = doc(db, 'worksheets', caseItem.worksheetId);
    const docSnap = await getDoc(worksheetDocRef);
    if (docSnap.exists()) {
        setSelectedWorksheet(docSnap.data() as Worksheet);
    } else {
        toast({ title: "Error", description: "No se pudo encontrar la hoja de trabajo.", variant: "destructive" });
    }
  };
  
  const getRevisorStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) { case 'Aprobado': return 'default'; case 'Rechazado': return 'destructive'; case 'Revalidación Solicitada': return 'secondary'; default: return 'outline'; }
  };
  const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) { case 'En revisión': return 'default'; case 'Incompleto': return 'destructive'; case 'En proceso': return 'secondary'; case 'Pendiente ': return 'destructive'; default: return 'outline'; }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Cargando registros de aforo...</p>
      </div>
    );
  }

  if (displayCases.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No hay casos pendientes</h3>
        <p className="mt-1 text-muted-foreground">No hay casos de aforo que cumplan con los filtros actuales.</p>
      </div>
    );
  }
  
  const canEdit = user?.role === 'admin' || user?.role === 'coordinadora' || user?.role === 'supervisor';
  const isDigitador = user?.role === 'aforador';
  
  if (isMobile) {
    return (
        <div className="space-y-4">
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={collapseAllRows} className="h-8 w-8"><ChevronsUpDown className="h-4 w-4" /></Button>
                {canEdit && <Button variant="outline" size="sm" onClick={handleBulkAcknowledge} disabled={selectedRows.length === 0}>Acuse Masivo ({selectedRows.length})</Button>}
                {canEdit && <Button variant="secondary" size="sm" onClick={handleSendSelectedToDigitization} disabled={selectedRows.length === 0}>Enviar a Digitación ({selectedRows.length})</Button>}
            </div>
            {displayCases.map(caseItem => (
                <MobileAforoCard
                    key={caseItem.id}
                    caseItem={caseItem}
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
                    handleAcknowledgeWorksheet={handleAcknowledgeWorksheet}
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
          {canEdit && <Button variant="outline" size="sm" onClick={handleBulkAcknowledge} disabled={selectedRows.length === 0}>Enviar Acuse ({selectedRows.length})</Button>}
          {canEdit && <Button variant="secondary" size="sm" onClick={handleSendSelectedToDigitization} disabled={selectedRows.length === 0}>Enviar a Digitación ({selectedRows.length})</Button>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"><Checkbox checked={selectedRows.length > 0 && selectedRows.length === displayCases.length} onCheckedChange={toggleSelectAll}/></TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Insignias</TableHead>
            <TableHead>Ejecutivo</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Aforador</TableHead>
            <TableHead>Fecha Asignación</TableHead>
            <TableHead>Estatus Aforador</TableHead>
            <TableHead>Revisor Asignado</TableHead>
            <TableHead>Estatus Revisor</TableHead>
            <TableHead>Preliquidación</TableHead>
            <TableHead>Digitador Asignado</TableHead>
            <TableHead>Estado Digitación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayCases.map((caseItem) => {
            const isExpanded = expandedRows.has(caseItem.id);
            const daysUntilDue = caseItem.resaDueDate ? differenceInDays(caseItem.resaDueDate.toDate(), new Date()) : null;
            const isResaCritical = daysUntilDue !== null && daysUntilDue < -15;

            const rowClass = cn(
              savingState[caseItem.id] && "bg-amber-100",
              isResaCritical ? "bg-red-200 hover:bg-red-200/80" : (caseItem.incidentReported ? "bg-red-100 hover:bg-red-100/80" : (caseItem.aforadorStatus === 'Pendiente ' ? "bg-red-50 hover:bg-red-100/60" : ""))
            );
            
            const canEditThisRow = canEdit || (user?.role === 'aforador' && user?.displayName === caseItem.aforador);
            const canExpandRow = user?.role === 'aforador' || canEdit;
            const isPatternValidated = caseItem.isPatternValidated === true;
            const allowPatternEdit = caseItem.revisorStatus === 'Rechazado';

            const acuseLog = caseAuditLogs.get(caseItem.id)?.find(log => log.newValue === 'worksheet_received');

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
                        {caseItem.worksheetId && (
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
                        { (user?.role === 'aforador' || user?.role === 'admin') && caseItem.revisorStatus === 'Rechazado' && (
                           <DropdownMenuItem onSelect={() => handleRequestRevalidation(caseItem)}>
                               <Repeat className="mr-2 h-4 w-4" /> Solicitar Revalidación
                           </DropdownMenuItem>
                        )}
                         { (canEdit) && caseItem.revisorStatus === 'Aprobado' && (
                           <DropdownMenuItem onSelect={() => handleAssignToDigitization(caseItem)} disabled={caseItem.preliquidationStatus !== 'Aprobada'}>
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
                  <StatusBadges caseData={caseItem} acuseLog={acuseLog} />
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
                  <span>{caseItem.aforador || 'Sin asignar'}</span>
                  <LastUpdateTooltip lastUpdate={caseItem.aforadorStatusLastUpdate} caseCreation={caseItem.createdAt} />
                </div>
              </TableCell>
              <TableCell>
                {formatDate(caseItem.assignmentDate)}
              </TableCell>
              <TableCell>
                 <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                                value={caseItem.aforadorStatus ?? ''}
                                onValueChange={(value: AforadorStatus) => handleAutoSave(caseItem.id, 'aforadorStatus', value)}
                                disabled={!canEditThisRow || !caseItem.aforador}
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
                          {!caseItem.aforador &&
                              <TooltipContent>
                                  <p>Debe asignar un aforador primero.</p>
                              </TooltipContent>
                          }
                      </Tooltip>
                    </TooltipProvider>
                    {(caseItem.aforadorStatus === 'Incompleto') && (
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
                    <LastUpdateTooltip lastUpdate={caseItem.aforadorStatusLastUpdate} caseCreation={caseItem.createdAt} />
                 </div>
              </TableCell>
               <TableCell>
                 <div className="flex items-center gap-2">
                   <span>{caseItem.revisorAsignado || 'Sin asignar'}</span>
                   <LastUpdateTooltip lastUpdate={caseItem.revisorAsignadoLastUpdate} caseCreation={caseItem.createdAt} />
                 </div>
              </TableCell>
               <TableCell>
                    <div className="flex items-center">
                        <Badge variant={getRevisorStatusBadgeVariant(caseItem.revisorStatus)}>{caseItem.revisorStatus || 'Pendiente'}</Badge>
                        <LastUpdateTooltip lastUpdate={caseItem.revisorStatusLastUpdate} caseCreation={caseItem.createdAt}/>
                    </div>
              </TableCell>
              <TableCell>
                    <Badge variant={caseItem.preliquidationStatus === 'Aprobada' ? 'default' : 'outline'}>{caseItem.preliquidationStatus || 'Pendiente'}</Badge>
              </TableCell>
            </TableRow>
             {isExpanded && canExpandRow && (
                <TableRow className="bg-muted/30 hover:bg-muted/40">
                  <TableCell colSpan={15} className="p-0">
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
                                      disabled={!canEditThisRow || (isPatternValidated && !allowPatternEdit)}
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
                                                      <Check className={cn("mr-2 h-4 w-4", tipo.value === caseItem.declarationPattern ? "opacity-100" : "opacity-0")} />
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
                            disabled={!caseItem.declarationPattern || (isPatternValidated && !allowPatternEdit) || savingState[caseItem.id]}
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
                                      disabled={!canEdit || !isPatternValidated}
                                      className="w-full justify-between"
                                  >
                                      {caseItem.aforador || "Asignar..."}
                                      <User className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                  </Button>
                               </div>
                           </TooltipTrigger>
                           {!isPatternValidated &&
                            <TooltipContent>
                                <p>Debe validar el Modelo (Patrón) antes de asignar un aforador.</p>
                            </TooltipContent>
                           }
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
                                    disabled={!canEdit || !caseItem.totalPosiciones}
                                    className="w-full justify-between"
                                >
                                    {caseItem.revisorAsignado || "Asignar..."}
                                    <UserCheck className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                </Button>
                                </div>
                           </TooltipTrigger>
                           {!caseItem.totalPosiciones &&
                                <TooltipContent>
                                    <p>Debe ingresar el Total de Posiciones para poder asignar un revisor.</p>
                                </TooltipContent>
                           }
                        </Tooltip>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Total Posiciones</label>
                        <Input 
                          type="number"
                          defaultValue={caseItem.totalPosiciones} 
                          onBlur={(e) => handleAutoSave(caseItem.id, 'totalPosiciones', e.target.valueAsNumber)}
                           disabled={!canEditThisRow}
                        />
                      </div>
                       <div>
                        <label className="text-xs font-medium text-muted-foreground">Entregado a Aforo</label>
                         <DatePickerWithTime
                            date={(caseItem.entregadoAforoAt as Timestamp)?.toDate()}
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
        <AforoCaseHistoryModal
            isOpen={!!selectedCaseForHistory}
            onClose={() => setSelectedCaseForHistory(null)}
            caseData={selectedCaseForHistory}
        />
    )}
     {selectedCaseForAforadorComment && (
        <AforadorCommentModal
            isOpen={!!selectedCaseForAforadorComment}
            onClose={() => setSelectedCaseForAforadorComment(null)}
            caseData={selectedCaseForAforadorComment}
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
    {assignmentModal.isOpen && assignmentModal.case && (
        <AssignUserModal
            isOpen={assignmentModal.isOpen}
            onClose={() => setAssignmentModal({ isOpen: false, case: null, type: 'aforador' })}
            caseData={assignmentModal.case}
            assignableUsers={
                assignmentModal.type === 'aforador'
                    ? assignableUsers.filter(u => u.role === 'aforador' || u.role === 'coordinadora' || u.role === 'supervisor')
                    : assignableUsers.filter(u => u.roleTitle === 'agente aduanero' || (u.role === 'supervisor' && u.roleTitle === 'PSMT'))
            }
            onAssign={(caseId, userName) => handleAssignUser(caseId, userName, assignmentModal.type)}
            title={`Asignar ${assignmentModal.type === 'aforador' ? 'Aforador' : 'Revisor'}`}
            description={`Seleccione un usuario para asignar al caso NE: ${assignmentModal.case.ne}`}
        />
    )}
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
                <AlertDialogTitle>Resultado del Envío Masivo</AlertDialogTitle>
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
    </>
  );
}
