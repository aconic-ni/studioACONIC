
"use client";
import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FilePlus, Search, Edit, Eye, History, PlusSquare, UserCheck, Inbox, AlertTriangle, Download, ChevronsUpDown, Info, CheckCircle, CalendarRange, Calendar, CalendarDays, ShieldAlert, BookOpen, FileCheck2, MessageSquare, View, Banknote, Bell as BellIcon, RefreshCw, Send, StickyNote, Scale, Briefcase, KeyRound, Copy, Archive } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, updateDoc, writeBatch, addDoc, getDocs, collectionGroup, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Worksheet, AforoCase, AforadorStatus, AforoCaseStatus, DigitacionStatus, WorksheetWithCase, AforoCaseUpdate, PreliquidationStatus, IncidentType, LastUpdateInfo, ExecutiveComment, InitialDataContext, AppUser, SolicitudRecord, ExamDocument, FacturacionStatus } from '@/types';
import { isSameDay, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AforoCaseHistoryModal } from '@/components/reporter/AforoCaseHistoryModal';
import { IncidentReportModal } from '@/components/reporter/IncidentReportModal';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { ValueDoubtModal } from '@/components/executive/ValueDoubtModal';
import { WorksheetDetails } from '@/components/executive/WorksheetDetails';
import { ExecutiveCommentModal } from '@/components/executive/ExecutiveCommentModal';
import { QuickRequestModal } from '@/components/executive/QuickRequestModal';
import { PaymentRequestModal } from '@/components/executive/PaymentRequestModal';
import { PaymentListModal } from '@/components/executive/PaymentListModal';
import { AnnouncementsCarousel } from '@/components/executive/AnnouncementsCarousel';
import { AssignUserModal } from '@/components/reporter/AssignUserModal';
import { ResaNotificationModal } from '@/components/executive/ResaNotificationModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileCasesList } from '@/components/executive/MobileCasesList';
import { useAppContext } from '@/context/AppContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ViewIncidentsModal } from '@/components/executive/ViewIncidentsModal';
import { StatusProcessModal } from '@/components/executive/StatusProcessModal';
import { Textarea } from '@/components/ui/textarea';
import { ExecutiveCasesTable } from '@/components/executive/ExecutiveCasesTable';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ExecutiveFilters } from '@/components/executive/ExecutiveFilters';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type DateFilterType = 'range' | 'month' | 'today';
type TabValue = 'worksheets' | 'anexos' | 'corporate';

function ExecutivePageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { openAddProductModal, setInitialContextData, setIsMemorandumMode, caseToAssignAforador, setCaseToAssignAforador } = useAppContext();
  const isMobile = useIsMobile();
  const [allCases, setAllCases] = useState<WorksheetWithCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [modalState, setModalState] = useState({
    history: null as AforoCase | null,
    incident: null as AforoCase | null,
    valueDoubt: null as AforoCase | null,
    incidentDetails: null as AforoCase | null,
    worksheet: null as Worksheet | null,
    comment: null as AforoCase | null,
    quickRequest: null as WorksheetWithCase | null,
    payment: null as AforoCase | null,
    paymentList: null as AforoCase | null,
    resa: null as AforoCase | null,
    viewIncidents: null as AforoCase | null,
    process: null as AforoCase | null,
    archive: null as WorksheetWithCase | null,
    duplicate: null as WorksheetWithCase | null,
  });
  const [isRequestPaymentModalOpen, setIsRequestPaymentModalOpen] = useState(false);
  const [duplicateAndRetireModalOpen, setDuplicateAndRetireModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [facturadoFilter, setFacturadoFilter] = useState({ facturado: false, noFacturado: true });
  const [acuseFilter, setAcuseFilter] = useState({ conAcuse: false, sinAcuse: true });
  const [preliquidationFilter, setPreliquidationFilter] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [appliedFilters, setAppliedFilters] = useState({ searchTerm: '', facturado: false, noFacturado: true, conAcuse: false, sinAcuse: true, preliquidation: false, dateFilterType: 'range' as DateFilterType, dateRange: undefined as DateRange | undefined, isSearchActive: false });
  const [columnFilters, setColumnFilters] = useState({ ne: '', ejecutivo: '', consignatario: '', factura: '', selectividad: '', incidentType: '' });
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  const [pinInput, setPinInput] = useState('');
  const [newNeForDuplicate, setNewNeForDuplicate] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchHint, setSearchHint] = useState<{ foundIn: TabValue; label: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isDeathkeyModalOpen, setIsDeathkeyModalOpen] = useState(false);

  const urlTab = searchParams.get('tab') as TabValue | null;
  const activeTab = urlTab || 'worksheets';

  const handleTabChange = (value: string) => {
    router.push(`/executive?tab=${value as TabValue}`, { scroll: false });
    setCurrentPage(1);
    setSearchHint(null);
  };
  
  const fetchCases = useCallback(async () => {
    if (!user) return () => {};
    setIsLoading(true);
    let aforoQuery;
    const globalVisibilityRoles = ['admin', 'supervisor', 'coordinadora'];
    const groupVisibilityRoles = ['ejecutivo'];
    if (user.role && globalVisibilityRoles.includes(user.role)) { aforoQuery = query(collection(db, 'AforoCases')); } 
    else if (user.role && groupVisibilityRoles.includes(user.role) && user.visibilityGroup && user.visibilityGroup.length > 0) {
        const groupDisplayNames = Array.from(new Set([user.displayName, ...(user.visibilityGroup?.map(m => m.displayName) || [])])).filter(Boolean) as string[];
        aforoQuery = groupDisplayNames.length > 0 ? query(collection(db, 'AforoCases'), where("executive", "in", groupDisplayNames)) : query(collection(db, 'AforoCases'), where("executive", "==", user.displayName));
    } else if (user.displayName) { aforoQuery = query(collection(db, 'AforoCases'), where('executive', '==', user.displayName));} 
    else { setAllCases([]); setIsLoading(false); return () => {}; }

    const unsubscribe = onSnapshot(aforoQuery, async (aforoSnapshot) => {
        const aforoCasesData = aforoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        const [worksheetsSnap, examenesSnap, solicitudesSnap, memorandumSnap] = await Promise.all([ getDocs(collection(db, 'worksheets')), getDocs(collection(db, 'examenesPrevios')), getDocs(query(collection(db, "SolicitudCheques"), orderBy("savedAt", "desc"))), getDocs(query(collection(db, "Memorandum"), orderBy("savedAt", "desc")))]);
        const worksheetsMap = new Map(worksheetsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Worksheet]));
        const examenesMap = new Map(examenesSnap.docs.map(doc => [doc.id, doc.data() as any]));
        const allSolicitudes = new Map<string, SolicitudRecord[]>();
        [...solicitudesSnap.docs, ...memorandumSnap.docs].forEach(doc => { const data = doc.data() as SolicitudRecord; if(data.examNe) { const ne = data.examNe; if (!allSolicitudes.has(ne)) { allSolicitudes.set(ne, []); } allSolicitudes.get(ne)!.push({ solicitudId: doc.id, ...data }); }});
        const combinedDataPromises = aforoCasesData.map(async (caseItem) => {
            if (!caseItem.worksheetId) return { ...caseItem, worksheet: null, acuseLog: null };
            const updatesRef = collection(db, 'worksheets', caseItem.worksheetId, 'actualizaciones');
            const acuseQuery = query(updatesRef, where('newValue', '==', 'worksheet_received'), orderBy('updatedAt', 'desc'));
            const acuseSnapshot = await getDocs(acuseQuery);
            const acuseLog = acuseSnapshot.empty ? null : acuseSnapshot.docs[0].data() as AforoCaseUpdate;
            return { ...caseItem, worksheet: worksheetsMap.get(caseItem.worksheetId || '') || null, examenPrevio: examenesMap.get(caseItem.id) || null, pagos: allSolicitudes.get(caseItem.ne) || [], acuseLog: acuseLog,};
        });
        const combinedData = await Promise.all(combinedDataPromises);
        setAllCases(combinedData);
        setIsLoading(false);
    }, (error) => { toast({ title: "Error de Carga", description: "No se pudieron cargar los datos de los casos.", variant: "destructive" }); setIsLoading(false); });
    return () => unsubscribe();
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    let unsubscribe: (() => void) | undefined;
    fetchCases().then(unsub => { if(unsub) unsubscribe = unsub; });
    const fetchAssignableUsers = async () => {
        const usersQuery = query(collection(db, 'users'), where('role', 'in', ['aforador', 'coordinadora']));
        const querySnapshot = await getDocs(usersQuery);
        const users = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
        setAssignableUsers(users);
    };
    fetchAssignableUsers();
    return () => { if(unsubscribe) unsubscribe(); };
  }, [authLoading, user, router, fetchCases]);
  
  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any, isTriggerFromFieldUpdate: boolean = false) => {
    if (!user || !user.displayName) { toast({ title: "No autenticado", variant: 'destructive' }); return; }
    const originalCase = allCases.find(c => c.id === caseId);
    if (!originalCase || !originalCase.worksheetId) return;
    const oldValue = originalCase[field as keyof AforoCase];
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    const worksheetDocRef = doc(db, 'worksheets', originalCase.worksheetId);
    const updatesSubcollectionRef = collection(worksheetDocRef, 'actualizaciones');
    const batch = writeBatch(db);
    try {
        const updateData: { [key: string]: any } = { [field]: value };
        if (field === 'facturado' && value === true) updateData.facturadoAt = Timestamp.now();
        if (field.toLowerCase().includes('status')) updateData[`${''}${field}LastUpdate`] = { by: user.displayName, at: Timestamp.now() }
        batch.update(doc(db, 'AforoCases', caseId), updateData);
        const updateLog: AforoCaseUpdate = { updatedAt: Timestamp.now(), updatedBy: user.displayName, field: field as keyof AforoCase, oldValue: oldValue ?? null, newValue: value,};
        batch.set(doc(updatesSubcollectionRef), updateLog);
        await batch.commit();
        if(!isTriggerFromFieldUpdate) toast({ title: "Guardado Automático", description: `El campo se ha actualizado.` });
    } catch (error) { toast({ title: "Error", description: `No se pudo guardar el cambio.`, variant: "destructive" });
    } finally { setSavingState(prev => ({ ...prev, [caseId]: false })); }
  }, [user, allCases, toast]);
  
  const handleArchiveCase = async () => {
    if (!user || user.role !== 'admin' || !user.email || !modalState.archive) { toast({ title: "Acción no permitida", variant: "destructive" }); setModalState(prev => ({...prev, archive: null})); return; }
    setSavingState(prev => ({ ...prev, [modalState.archive!.id]: true }));
    const batch = writeBatch(db);
    batch.update(doc(db, "AforoCases", modalState.archive.id), { isArchived: true });
    if (modalState.archive.worksheetId) {
      batch.update(doc(db, "worksheets", modalState.archive.worksheetId), { isArchived: true });
      const logRef = doc(collection(doc(db, "worksheets", modalState.archive.worksheetId), "actualizaciones"));
      batch.set(logRef, { updatedAt: serverTimestamp(), updatedBy: user.email, field: 'isArchived', oldValue: false, newValue: true, comment: 'Caso archivado por administrador.' });
    }
    try {
      await batch.commit();
      toast({ title: "Caso Archivado", description: "El caso ha sido movido al archivo." });
      setModalState(prev => ({...prev, archive: null}));
    } catch (error) { toast({ title: "Error", description: "No se pudo archivar el caso.", variant: "destructive" });
    } finally { setSavingState(prev => ({ ...prev, [modalState.archive!.id]: false })); }
  };

  const filteredCases = useMemo(() => {
    let tabFiltered = allCases.filter(c => !c.isArchived);
    if (activeTab === 'worksheets') tabFiltered = tabFiltered.filter(c => c.worksheet?.worksheetType === 'hoja_de_trabajo' || c.worksheet?.worksheetType === undefined);
    else if (activeTab === 'anexos') tabFiltered = tabFiltered.filter(c => c.worksheet?.worksheetType === 'anexo_5' || c.worksheet?.worksheetType === 'anexo_7');
    else if (activeTab === 'corporate') tabFiltered = tabFiltered.filter(c => c.worksheet?.worksheetType === 'corporate_report');
    if (!appliedFilters.isSearchActive) return tabFiltered.slice(0, 15);
    
    let finalFiltered = tabFiltered;
    if (appliedFilters.searchTerm) finalFiltered = finalFiltered.filter(c => c.ne.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) || c.consignee.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()));
    if (appliedFilters.noFacturado && !appliedFilters.facturado) finalFiltered = finalFiltered.filter(c => !c.facturado);
    else if (appliedFilters.facturado && !appliedFilters.noFacturado) finalFiltered = finalFiltered.filter(c => c.facturado === true);
    if (appliedFilters.conAcuse && !appliedFilters.sinAcuse) finalFiltered = finalFiltered.filter(c => c.entregadoAforoAt);
    else if (appliedFilters.sinAcuse && !appliedFilters.conAcuse) finalFiltered = finalFiltered.filter(c => !c.entregadoAforoAt);
    if (appliedFilters.preliquidation) {
      finalFiltered = finalFiltered.filter(c => {
          const aforoData = (c as any).aforo || c;
          return aforoData.revisorStatus === 'Aprobado' && aforoData.preliquidationStatus !== 'Aprobada';
      });
    }
    if (appliedFilters.dateRange?.from) {
        const start = startOfDay(appliedFilters.dateRange.from);
        const end = appliedFilters.dateRange.to ? endOfDay(appliedFilters.dateRange.to) : endOfDay(start);
        finalFiltered = finalFiltered.filter(item => item.createdAt?.toDate() >= start && item.createdAt?.toDate() <= end);
    }
    
    const getIncidentTypeDisplay = (c: AforoCase) => {
      const types = [];
      if (c.incidentType === 'Rectificacion') types.push('Rectificación');
      if (c.hasValueDoubt) types.push('Duda de Valor');
      return types.length > 0 ? types.join(' / ') : 'N/A';
    };

    const { ne, ejecutivo, consignatario, factura, selectividad, incidentType } = columnFilters;
    if (ne) finalFiltered = finalFiltered.filter(c => c.ne.toLowerCase().includes(ne.toLowerCase()));
    if (ejecutivo) finalFiltered = finalFiltered.filter(c => c.executive.toLowerCase().includes(ejecutivo.toLowerCase()));
    if (consignatario) finalFiltered = finalFiltered.filter(c => c.consignee.toLowerCase().includes(consignatario.toLowerCase()));
    if (factura) { const lowerCaseFilter = factura.toLowerCase(); finalFiltered = finalFiltered.filter(c => { const facturas = c.worksheet?.worksheetType === 'corporate_report' ? (c.worksheet.documents?.filter(d => d.type === 'FACTURA').map(d => d.number) || []) : (c.facturaNumber ? c.facturaNumber.split(';').map(f => f.trim()) : []); return facturas.some(f => f.toLowerCase().includes(lowerCaseFilter));}); }
    if (selectividad) finalFiltered = finalFiltered.filter(c => (c.selectividad || 'N/A').toLowerCase().includes(selectividad.toLowerCase()));
    if (incidentType) finalFiltered = finalFiltered.filter(c => getIncidentTypeDisplay(c).toLowerCase().includes(incidentType.toLowerCase()));
    
    if (finalFiltered.length === 0 && appliedFilters.searchTerm) {
        const term = appliedFilters.searchTerm.toLowerCase();
        const otherTabs: TabValue[] = ['worksheets', 'anexos', 'corporate'].filter(t => t !== activeTab);
        for (const tab of otherTabs) {
          let hintFiltered: WorksheetWithCase[];
          if (tab === 'worksheets') hintFiltered = allCases.filter(c => !c.isArchived && (c.worksheet?.worksheetType === 'hoja_de_trabajo' || c.worksheet?.worksheetType === undefined) && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          else if (tab === 'anexos') hintFiltered = allCases.filter(c => !c.isArchived && (c.worksheet?.worksheetType === 'anexo_5' || c.worksheet?.worksheetType === 'anexo_7') && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          else hintFiltered = allCases.filter(c => !c.isArchived && c.worksheet?.worksheetType === 'corporate_report' && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          if (hintFiltered.length > 0) { setSearchHint({ foundIn: tab, label: tab === 'worksheets' ? 'Hojas de Trabajo' : tab === 'anexos' ? 'Anexos' : 'Reportes Corporativos' }); break; } 
          else { setSearchHint(null); }
        }
      } else { setSearchHint(null); }

    return finalFiltered;
  }, [allCases, appliedFilters, activeTab, columnFilters, acuseFilter]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = appliedFilters.isSearchActive ? filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : filteredCases;
  
  const caseActions = {
    handleViewWorksheet: (c: AforoCase) => setModalState(prev => ({...prev, worksheet: c.worksheet as Worksheet})),
    setSelectedCaseForQuickRequest: (c: WorksheetWithCase) => setModalState(prev => ({...prev, quickRequest: c})),
    setSelectedCaseForPayment: (c: AforoCase) => setModalState(prev => ({...prev, payment: c})),
    setSelectedCaseForPaymentList: (c: AforoCase) => setModalState(prev => ({...prev, paymentList: c})),
    setSelectedCaseForResa: (c: AforoCase) => setModalState(prev => ({...prev, resa: c})),
    setSelectedCaseForIncident: (c: AforoCase) => setModalState(prev => ({...prev, incident: c})),
    setSelectedCaseForValueDoubt: (c: AforoCase) => setModalState(prev => ({...prev, valueDoubt: c})),
    setSelectedCaseForHistory: (c: AforoCase) => setModalState(prev => ({...prev, history: c})),
    setSelectedIncidentForDetails: (c: AforoCase) => setModalState(prev => ({...prev, incidentDetails: c})),
    setSelectedCaseForComment: (c: AforoCase) => setModalState(prev => ({...prev, comment: c})),
    handleSearchPrevio: (ne: string) => router.push(`/database?ne=${ne}`),
    setCaseToArchive: (c: WorksheetWithCase) => setModalState(prev => ({...prev, archive: c})),
    setCaseToDuplicate: (c: WorksheetWithCase) => setModalState(prev => ({...prev, duplicate: c})),
    setDuplicateAndRetireModalOpen: setDuplicateAndRetireModalOpen,
    setSelectedCaseForProcess: (c: AforoCase) => setModalState(prev => ({...prev, process: c})),
  };

  const handleDuplicateAndRetire = async () => {
    const caseItem = modalState.duplicate;
    if (!user || !user.displayName || !caseItem || !caseItem.worksheet) { return; }
    const newNe = newNeForDuplicate.trim().toUpperCase();
    if (!newNe || !duplicateReason) { toast({title:'Error', description:'Nuevo NE y motivo son requeridos', variant:'destructive'}); return; }

    setSavingState(prev => ({...prev, [caseItem.id]: true}));
    const batch = writeBatch(db);
    const newCaseRef = doc(db,'AforoCases',newNe);
    const newWorksheetRef=doc(db,'worksheets',newNe);

    try {
        const [newCaseSnap, newWorksheetSnap] = await Promise.all([getDoc(newCaseRef), getDoc(newWorksheetRef)]);
        if (newCaseSnap.exists() || newWorksheetSnap.exists()) {
            toast({ title: "Duplicado", description: `Ya existe un registro con el NE ${newNe}.`, variant: "destructive" });
            setSavingState(prev => ({...prev, [caseItem.id]: false}));
            return;
        }

        const creationTimestamp=Timestamp.now();
        const createdByInfo={by:user.displayName,at:creationTimestamp};
        const {id:oldId, ne:oldNe, createdAt:oldCreatedAt, lastUpdatedAt:oldLastUpdatedAt, ...worksheetToCopy}=caseItem.worksheet;
        const newWorksheetData:Worksheet={...worksheetToCopy, id:newNe, ne:newNe, createdAt:creationTimestamp, createdBy:user.email!, lastUpdatedAt:creationTimestamp};
        batch.set(newWorksheetRef, newWorksheetData);
        
        const newCaseData:Omit<AforoCase,'id'>={ne:newNe,executive:caseItem.executive,consignee:caseItem.consignee,facturaNumber:caseItem.facturaNumber,declarationPattern:caseItem.declarationPattern,merchandise:caseItem.merchandise,createdBy:user.uid,createdAt:creationTimestamp,aforador:'',assignmentDate:null,aforadorStatus:'Pendiente ',aforadorStatusLastUpdate:createdByInfo,revisorStatus:'Pendiente',revisorStatusLastUpdate:createdByInfo,preliquidationStatus:'Pendiente',preliquidationStatusLastUpdate:createdByInfo,digitacionStatus:'Pendiente',digitacionStatusLastUpdate:createdByInfo,incidentStatus:'Pendiente',incidentStatusLastUpdate:createdByInfo,revisorAsignado:'',revisorAsignadoLastUpdate:createdByInfo,digitadorAsignado:'',digitadorAsignadoLastUpdate:createdByInfo,worksheetId:newNe,entregadoAforoAt:null,isArchived:false,executiveComments:[{id:uuidv4(),author:user.displayName!,text:`Duplicado del NE: ${caseItem.ne}. Motivo: ${duplicateReason}`,createdAt:creationTimestamp}]};
        batch.set(newCaseRef, newCaseData);
        batch.update(doc(db,'AforoCases',caseItem.id),{digitacionStatus:'TRASLADADO',isArchived:true});
        
        const originalUpdatesRef=collection(db,'worksheets',caseItem.id,'actualizaciones');
        const updateLog:AforoCaseUpdate={updatedAt:Timestamp.now(),updatedBy:user!.displayName!,field:'digitacionStatus',oldValue:caseItem.digitacionStatus,newValue:'TRASLADADO',comment:`Caso trasladado al nuevo NE: ${newNe}. Motivo: ${duplicateReason}`};
        batch.set(doc(originalUpdatesRef),updateLog);
        
        const newUpdatesRef=collection(db,'worksheets',newNe,'actualizaciones');
        const newCaseLog:AforoCaseUpdate={updatedAt:creationTimestamp,updatedBy:user!.displayName!,field:'creation',oldValue:null,newValue:`duplicated_from_${caseItem.ne}`,comment:`Caso duplicado desde ${caseItem.ne}. Motivo: ${duplicateReason}`};
        batch.set(doc(newUpdatesRef),newCaseLog);
        
        await batch.commit();
        toast({title:'Éxito', description:`El caso ${caseItem.ne} fue duplicado a ${newNe} y retirado.`});
        setDuplicateAndRetireModalOpen(false);
    } catch(e) {
        toast({title:'Error',description:'No se pudo duplicar el caso.',variant:'destructive'})
    } finally {
        setSavingState(prev => ({...prev, [caseItem.id]: false}));
    }
  };

  const handleDeathkey = async () => {
    if (pinInput !== "192438") { toast({ title: "PIN Incorrecto", variant: "destructive" }); return; }
    if (selectedRows.length === 0 || !user || !user.displayName) return;
    setIsLoading(true);
    const batch = writeBatch(db);
    for (const caseId of selectedRows) {
        const caseItem = filteredCases.find(c => c.id === caseId);
        if (caseItem && caseItem.worksheetId) {
            const worksheetRef = doc(db, 'worksheets', caseItem.worksheetId);
            batch.update(worksheetRef, { worksheetType: 'corporate_report' });
            const updatesSubcollectionRef = collection(worksheetRef, 'actualizaciones');
            const updateLog: AforoCaseUpdate = {updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'worksheetType', oldValue: 'hoja_de_trabajo', newValue: 'corporate_report', comment: 'Caso reclasificado a Reporte Corporativo via Deathkey.'};
            batch.set(doc(updatesSubcollectionRef), updateLog);
        }
    }
    try {
        await batch.commit();
        toast({ title: "Éxito", description: `${selectedRows.length} casos han sido reclasificados.` });
        setSelectedRows([]);
        setIsDeathkeyModalOpen(false);
        setPinInput('');
    } catch (error) {
        toast({ title: "Error", description: "No se pudieron reclasificar los casos.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setFacturadoFilter({ facturado: false, noFacturado: true });
    setAcuseFilter({ conAcuse: false, sinAcuse: true });
    setPreliquidationFilter(false);
    setDateRangeInput(undefined);
    setAppliedFilters({ searchTerm: '', facturado: false, noFacturado: true, conAcuse: false, sinAcuse: true, preliquidation: false, dateFilterType: 'range', dateRange: undefined, isSearchActive: false });
    setCurrentPage(1);
    setSearchHint(null);
  };

  const handleOpenPaymentRequest = () => {
    const initialData: InitialDataContext = {
      ne: `SOL-${new Date().getTime()}`,
      manager: user?.displayName || 'N/A',
      date: new Date(),
      recipient: 'Contabilidad',
      isMemorandum: false,
    };
    setInitialContextData(initialData);
    setIsRequestPaymentModalOpen(true);
  };
  
  const approvePreliquidation = (caseId: string) => {
    handleAutoSave(caseId, 'preliquidationStatus', 'Aprobada');
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

  return (
    <>
      <AppShell>
        <div className="py-2 md:py-5 space-y-6">
          <AnnouncementsCarousel />
          <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl"><Inbox/> Panel Ejecutivo</CardTitle>
                        <CardDescription>Seguimiento de operaciones, desde la hoja de trabajo hasta la facturación.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="lg" variant="secondary" className="h-12 text-md">
                                    <Banknote className="mr-2 h-5 w-5" /> Solicitud de Pago General
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Está seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción iniciará una solicitud de pago no vinculada a un Número de Entrada (NE) específico. Se generará un ID único en su lugar.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleOpenPaymentRequest}>Sí, continuar</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="lg" variant="default" className="h-12 text-md"><Edit className="mr-2 h-5 w-5" />Crear Registro</Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuLabel>Tipo de Documento</DropdownMenuLabel><DropdownMenuSeparator />
                                <DropdownMenuItem asChild><Link href="/executive/worksheet"><FilePlus className="mr-2 h-4 w-4" /> Hoja de Trabajo</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/executive/corporate-report"><Briefcase className="mr-2 h-4 w-4" /> Reporte Consignatario</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/executive/anexos?type=anexo_5"><StickyNote className="mr-2 h-4 w-4" /> Anexo 5</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/executive/anexos?type=anexo_7"><StickyNote className="mr-2 h-4 w-4" /> Anexo 7</Link></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ExecutiveFilters
                    activeTab={activeTab as TabValue}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    facturadoFilter={facturadoFilter}
                    setFacturadoFilter={setFacturadoFilter}
                    acuseFilter={acuseFilter}
                    setAcuseFilter={setAcuseFilter}
                    preliquidationFilter={preliquidationFilter}
                    setPreliquidationFilter={setPreliquidationFilter}
                    dateFilterType={dateFilterType}
                    setDateFilterType={setDateFilterType}
                    dateRangeInput={dateRangeInput}
                    setDateRangeInput={setDateRangeInput}
                    setAppliedFilters={setAppliedFilters}
                    setCurrentPage={setCurrentPage}
                    isExporting={isExporting}
                    allCasesCount={allCases.length}
                    searchHint={searchHint}
                    clearFilters={clearFilters}
                />
                <Tabs defaultValue={activeTab} className="w-full mt-4" onValueChange={handleTabChange}>
                  <TabsList>
                      <TabsTrigger value="worksheets">Hojas de Trabajo</TabsTrigger>
                      <TabsTrigger value="anexos">Anexos</TabsTrigger>
                      <TabsTrigger value="corporate">Reportes Corporativos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="worksheets" className="mt-6">
                    <ExecutiveCasesTable
                      cases={paginatedCases}
                      savingState={savingState}
                      onAutoSave={handleAutoSave}
                      approvePreliquidation={approvePreliquidation}
                      caseActions={caseActions}
                      selectedRows={selectedRows}
                      onSelectRow={setSelectedRows}
                      onSelectAllRows={() => {}} // Placeholder, adjust as needed
                      columnFilters={columnFilters}
                      setColumnFilters={setColumnFilters}
                      handleSendToFacturacion={handleSendToFacturacion}
                      onSearch={handleSearch}
                    />
                  </TabsContent>
                  <TabsContent value="anexos" className="mt-6">
                    <ExecutiveCasesTable
                      cases={paginatedCases}
                      savingState={savingState}
                      onAutoSave={handleAutoSave}
                      approvePreliquidation={approvePreliquidation}
                      caseActions={caseActions}
                      selectedRows={selectedRows}
                      onSelectRow={setSelectedRows}
                      onSelectAllRows={() => {}}
                      columnFilters={columnFilters}
                      setColumnFilters={setColumnFilters}
                      handleSendToFacturacion={handleSendToFacturacion}
                      onSearch={handleSearch}
                    />
                  </TabsContent>
                  <TabsContent value="corporate" className="mt-6">
                    <ExecutiveCasesTable
                      cases={paginatedCases}
                      savingState={savingState}
                      onAutoSave={handleAutoSave}
                      approvePreliquidation={approvePreliquidation}
                      caseActions={caseActions}
                      selectedRows={selectedRows}
                      onSelectRow={setSelectedRows}
                      onSelectAllRows={() => {}}
                      columnFilters={columnFilters}
                      setColumnFilters={setColumnFilters}
                      handleSendToFacturacion={handleSendToFacturacion}
                      onSearch={handleSearch}
                    />
                  </TabsContent>
                </Tabs>
            </CardContent>
          </Card>
        </div>
      </AppShell>
      {modalState.history && (<AforoCaseHistoryModal isOpen={!!modalState.history} onClose={() => setModalState(p => ({...p, history: null}))} caseData={modalState.history} />)}
      {modalState.incident && (<IncidentReportModal isOpen={!!modalState.incident} onClose={() => setModalState(p => ({...p, incident: null}))} caseData={modalState.incident} />)}
      {modalState.valueDoubt && (<ValueDoubtModal isOpen={!!modalState.valueDoubt} onClose={() => setModalState(p => ({...p, valueDoubt: null}))} caseData={modalState.valueDoubt} />)}
      {modalState.comment && (<ExecutiveCommentModal isOpen={!!modalState.comment} onClose={() => setModalState(p => ({...p, comment: null}))} caseData={modalState.comment} />)}
      {modalState.quickRequest && (<QuickRequestModal isOpen={!!modalState.quickRequest} onClose={() => setModalState(p => ({...p, quickRequest: null}))} caseWithWorksheet={modalState.quickRequest} />)}
      {modalState.payment && (<PaymentRequestModal isOpen={!!modalState.payment} onClose={() => setModalState(p => ({...p, payment: null}))} caseData={modalState.payment} />)}
      {isRequestPaymentModalOpen && (<PaymentRequestModal isOpen={isRequestPaymentModalOpen} onClose={() => setIsRequestPaymentModalOpen(false)} caseData={null} />)}
      {modalState.paymentList && (<PaymentListModal isOpen={!!modalState.paymentList} onClose={() => setModalState(p => ({...p, paymentList: null}))} caseData={modalState.paymentList} />)}
      {modalState.resa && (<ResaNotificationModal isOpen={!!modalState.resa} onClose={() => setModalState(p => ({...p, resa: null}))} caseData={modalState.resa} />)}
      {caseToAssignAforador && (<AssignUserModal isOpen={!!caseToAssignAforador} onClose={() => setCaseToAssignAforador(null)} caseData={caseToAssignAforador} assignableUsers={assignableUsers} onAssign={() => {}} title="Asignar Aforador (PSMT)" description={`Como el consignatario es PSMT, debe asignar un aforador para el caso NE: ${caseToAssignAforador.ne}.`}/>)}
      {modalState.viewIncidents && (<ViewIncidentsModal isOpen={!!modalState.viewIncidents} onClose={() => setModalState(p => ({...p, viewIncidents: null}))} onSelectRectificacion={() => { setModalState(p => ({...p, incidentDetails: p.viewIncidents, viewIncidents: null})); }} onSelectDudaValor={() => { setModalState(p => ({...p, valueDoubt: p.viewIncidents, viewIncidents: null})); }} />)}
      {modalState.process && (<StatusProcessModal isOpen={!!modalState.process} onClose={() => setModalState(p => ({...p, process: null}))} caseData={modalState.process} />)}
      <AlertDialog open={!!modalState.archive} onOpenChange={(isOpen) => !isOpen && setModalState(p => ({...p, archive: null}))}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Está seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción archivará el caso y no será visible en las listas principales.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleArchiveCase}>Sí, Archivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={duplicateAndRetireModalOpen} onOpenChange={setDuplicateAndRetireModalOpen}><DialogContent><DialogHeader><DialogTitle>Duplicar y Retirar Caso</DialogTitle><DialogDescription>Se creará un nuevo caso con un NE nuevo, y el caso original ({modalState.duplicate?.ne}) será retirado (archivado y marcado como trasladado).</DialogDescription></DialogHeader><div className="py-4 space-y-4"><div><Label htmlFor="new-ne">Nuevo NE</Label><Input id="new-ne" value={newNeForDuplicate} onChange={e => setNewNeForDuplicate(e.target.value)} placeholder="Ingrese el nuevo NE" /></div><div><Label htmlFor="reason">Motivo</Label><Textarea id="reason" value={duplicateReason} onChange={e => setDuplicateReason(e.target.value)} placeholder="Explique brevemente el motivo de la duplicación" /></div></div><DialogFooter><Button variant="outline" onClick={() => setDuplicateAndRetireModalOpen(false)}>Cancelar</Button><Button onClick={handleDuplicateAndRetire} disabled={savingState[modalState.duplicate?.id || '']}>Duplicar y Retirar</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isDeathkeyModalOpen} onOpenChange={setIsDeathkeyModalOpen}><DialogContent><DialogHeader><DialogTitle>Confirmar Acción "Deathkey"</DialogTitle><DialogDescription>Esta acción reclasificará {selectedRows.length} caso(s) a "Reporte Corporativo", excluyéndolos de la lógica de Aforo. Es irreversible. Ingrese el PIN para confirmar.</DialogDescription></DialogHeader><div className="py-4 space-y-2"><Label htmlFor="pin-input" className="flex items-center gap-2"><KeyRound/>PIN de Seguridad</Label><Input id="pin-input" type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN de 6 dígitos"/></div><DialogFooter><Button variant="outline" onClick={() => setIsDeathkeyModalOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={handleDeathkey} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirmar y Ejecutar</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
}

export default function ExecutivePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <ExecutivePageContent />
        </Suspense>
    );
}

```