
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
import type { Worksheet, AforoData, AforadorStatus, noexisteStatus, DigitacionStatus, WorksheetWithCase, AforoUpdate, PreliquidationStatus, IncidentType, LastUpdateInfo, ExecutiveComment, InitialDataContext, AppUser, SolicitudRecord, ExamDocument, FacturacionStatus } from '@/types';
import { format, toDate, isSameDay, startOfDay, endOfDay, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { AforoHistoryModal } from '@/components/reporter/AforoHistoryModal';
import { IncidentReportModal } from '@/components/reporter/IncidentReportModal';
import { Badge } from '@/components/ui/badge';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { ValueDoubtModal } from '@/components/executive/ValueDoubtModal';
import { DatePickerWithTime } from '@/components/reports/DatePickerWithTime';
import { Checkbox } from '@/components/ui/checkbox';
import { downloadExecutiveReportAsExcel } from '@/lib/fileExporter';
import { downloadCorporateReportAsExcel } from '@/lib/fileExporterCorporateReport';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
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
import { StatusBadges } from '@/components/executive/StatusBadges';
import { useAppContext } from '@/context/AppContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ViewIncidentsModal } from '@/components/executive/ViewIncidentsModal';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusProcessModal } from '@/components/executive/StatusProcessModal';
import { Textarea } from '@/components/ui/textarea';
import { ExecutiveCasesTable } from '@/components/executive/ExecutiveCasesTable';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type DateFilterType = 'range' | 'month' | 'today';

const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, 'label': 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

type TabValue = 'worksheets' | 'anexos' | 'corporate';

function ExecutivePageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { openAddProductModal, setInitialContextData, setIsMemorandumMode, caseToAssignAforador, setCaseToAssignAforador } = useAppContext();
  const [allCases, setAllCases] = useState<WorksheetWithCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [modalState, setModalState] = useState<{
    history: null | AforoData;
    incident: null | AforoData;
    valueDoubt: null | AforoData;
    incidentDetails: null | AforoData;
    worksheet: null | Worksheet;
    comment: null | AforoData;
    quickRequest: null | WorksheetWithCase;
    payment: null | AforoData;
    paymentList: null | AforoData;
    resa: null | AforoData;
    viewIncidents: null | AforoData;
    process: null | AforoData;
    archive: null | WorksheetWithCase;
  }>({
    history: null,
    incident: null,
    valueDoubt: null,
    incidentDetails: null,
    worksheet: null,
    comment: null,
    quickRequest: null,
    payment: null,
    paymentList: null,
    resa: null,
    viewIncidents: null,
    process: null,
    archive: null,
  });
  const [caseToDuplicate, setCaseToDuplicate] = useState<WorksheetWithCase | null>(null);
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
  const [newNeForDuplicate, setNewNeForDuplicate] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [searchHint, setSearchHint] = useState<{ foundIn: TabValue; label: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isDeathkeyModalOpen, setIsDeathkeyModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

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

    let worksheetsQuery: Query;
    const globalVisibilityRoles = ['admin', 'supervisor', 'coordinadora'];

    if (user.role && globalVisibilityRoles.includes(user.role)) {
        worksheetsQuery = query(collection(db, 'worksheets'), orderBy('createdAt', 'desc'));
    } else if (user.role === 'ejecutivo') {
        const groupDisplayNames = Array.from(new Set([user.displayName, ...(user.visibilityGroup?.map(m => m.displayName) || [])])).filter(Boolean) as string[];
        if (groupDisplayNames.length > 0) {
            worksheetsQuery = query(collection(db, 'worksheets'), where('executive', 'in', groupDisplayNames), orderBy('createdAt', 'desc'));
        } else {
            setAllCases([]);
            setIsLoading(false);
            return () => {};
        }
    } else {
        setAllCases([]);
        setIsLoading(false);
        return () => {};
    }

    const unsubscribe = onSnapshot(worksheetsQuery, async (wsSnapshot) => {
        const worksheetsData = wsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Worksheet));
        const aforoMetadataMap = new Map<string, AforoData>();

        const worksheetIds = worksheetsData.map(ws => ws.id);
        if (worksheetIds.length > 0) {
            for (let i = 0; i < worksheetIds.length; i += 30) {
                const chunk = worksheetIds.slice(i, i + 30);
                const aforoQuery = query(collectionGroup(db, 'aforo'), where(documentId(), 'in', chunk.map(id => `worksheets/${id}/aforo/metadata`)));
                const aforoSnapshot = await getDocs(aforoQuery);
                aforoSnapshot.forEach(doc => {
                    aforoMetadataMap.set(doc.ref.parent.parent!.id, doc.data() as AforoData);
                });
            }
        }
        
        const combinedDataPromises = worksheetsData.map(async (ws) => {
            const aforoData = aforoMetadataMap.get(ws.id) || null;
            const updatesRef = collection(db, 'worksheets', ws.id, 'actualizaciones');
            const acuseQuery = query(updatesRef, where('newValue', '==', 'worksheet_received'), orderBy('updatedAt', 'desc'));
            const acuseSnapshot = await getDocs(acuseQuery);
            const acuseLog = acuseSnapshot.empty ? null : acuseSnapshot.docs[0].data() as AforoUpdate;

            return {
                ...aforoData,
                ...ws,
                id: ws.id,
                worksheet: ws,
                aforo: aforoData,
                acuseLog: acuseLog,
            };
        });

        const combinedData = (await Promise.all(combinedDataPromises)) as WorksheetWithCase[];
        setAllCases(combinedData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching cases:", error);
        toast({ title: "Error de Carga", description: "No se pudieron cargar los datos de los casos.", variant: "destructive" });
        setIsLoading(false);
    });

    return unsubscribe;
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
  
  const handleAssignAforador = async (caseId: string, aforadorName: string) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }
    const aforoMetadataRef = doc(db, 'worksheets', caseId, 'aforo', 'metadata');
    try {
        await setDoc(aforoMetadataRef, { 
            aforador: aforadorName,
            assignmentDate: Timestamp.now(),
            aforadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        }, { merge: true });
        toast({ title: 'Aforador Asignado', description: `${aforadorName} ha sido asignado al caso.` });
        setCaseToAssignAforador(null);
    } catch (error) {
        console.error('Error assigning aforador:', error);
        toast({ title: 'Error', description: 'No se pudo asignar el aforador.', variant: 'destructive' });
    }
  };
  
  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoData, value: any, isTriggerFromFieldUpdate: boolean = false) => {
    if (!user || !user.displayName) { toast({ title: "No autenticado", variant: 'destructive' }); return; }
    const originalCase = allCases.find(c => c.id === caseId);
    if (!originalCase || !originalCase.worksheetId) return;
    const oldValue = originalCase[field as keyof AforoData];
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    const aforoMetadataRef = doc(db, 'worksheets', originalCase.worksheetId, 'aforo', 'metadata');
    const updatesSubcollectionRef = collection(db, 'worksheets', originalCase.worksheetId, 'actualizaciones');
    const batch = writeBatch(db);
    try {
        const updateData: { [key: string]: any } = { [field]: value };
        if (field === 'facturado' && value === true) updateData.facturadoAt = Timestamp.now();
        if (field.toLowerCase().includes('status')) updateData[`${''}${field}LastUpdate`] = { by: user.displayName, at: Timestamp.now() }
        batch.set(aforoMetadataRef, updateData, { merge: true });
        const updateLog: AforoUpdate = { updatedAt: Timestamp.now(), updatedBy: user.displayName, field: field as keyof AforoData, oldValue: oldValue ?? null, newValue: value,};
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
    const worksheetRef = doc(db, "worksheets", modalState.archive.id);
    batch.update(worksheetRef, { isArchived: true });
    
    const logRef = doc(collection(worksheetRef, "actualizaciones"));
    batch.set(logRef, { updatedAt: serverTimestamp(), updatedBy: user.email, field: 'isArchived', oldValue: false, newValue: true, comment: 'Caso archivado por administrador.' });
    
    try {
      await batch.commit();
      toast({ title: "Caso Archivado", description: "El caso ha sido movido al archivo." });
      setModalState(prev => ({...prev, archive: null}));
    } catch (error) { toast({ title: "Error", description: "No se pudo archivar el caso.", variant: "destructive" });
    } finally { setSavingState(prev => ({ ...prev, [modalState.archive!.id]: false })); }
  };

  const handleDuplicateAndRetire = async () => {
    if (!user || !user.displayName || !caseToDuplicate || !caseToDuplicate.worksheet) {
        toast({title: 'Error', description: 'No se puede procesar la solicitud. Faltan datos.', variant: 'destructive'});
        return;
    }
    const newNe = newNeForDuplicate.trim().toUpperCase();
    if (!newNe || !duplicateReason) { toast({ title: 'Error', description: 'Nuevo NE y motivo son requeridos', variant: 'destructive' }); return; }
    
    setSavingState(prev => ({ ...prev, [caseToDuplicate.id]: true }));
    
    const newWorksheetRef = doc(db, 'worksheets', newNe);
    const originalWorksheetRef = doc(db, 'worksheets', caseToDuplicate.id);

    try {
        const newWsSnap = await getDoc(newWorksheetRef);
        if (newWsSnap.exists()) {
            toast({ title: "Duplicado", description: `Ya existe un registro con el NE ${newNe}.`, variant: 'destructive' });
            setSavingState(prev => ({ ...prev, [caseToDuplicate.id]: false }));
            return;
        }

        const batch = writeBatch(db);
        const creationTimestamp = Timestamp.now();
        const createdByInfo = { by: user.displayName, at: creationTimestamp };
        const { id: oldId, ne: oldNe, createdAt: oldCreatedAt, lastUpdatedAt: oldLastUpdatedAt, ...worksheetToCopy } = caseToDuplicate.worksheet;
        
        const newWorksheetData: Worksheet = { ...worksheetToCopy, id: newNe, ne: newNe, createdAt: creationTimestamp, createdBy: user.email!, lastUpdatedAt: creationTimestamp };
        batch.set(newWorksheetRef, newWorksheetData);
        
        const newAforoMetaRef = doc(newWorksheetRef, 'aforo', 'metadata');
        const newCaseData: Omit<AforoData, 'id'> = { ne: newNe, executive: caseToDuplicate.executive, consignee: caseToDuplicate.consignee, facturaNumber: caseToDuplicate.facturaNumber, declarationPattern: caseToDuplicate.declarationPattern, merchandise: caseToDuplicate.merchandise, createdBy: user.uid, createdAt: creationTimestamp, aforador: '', assignmentDate: null, aforadorStatus: 'Pendiente ', aforadorStatusLastUpdate: createdByInfo, revisorStatus: 'Pendiente', revisorStatusLastUpdate: createdByInfo, preliquidationStatus: 'Pendiente', preliquidationStatusLastUpdate: createdByInfo, digitacionStatus: 'Pendiente', digitacionStatusLastUpdate: createdByInfo, incidentStatus: 'Pendiente', incidentStatusLastUpdate: createdByInfo, revisorAsignado: '', revisorAsignadoLastUpdate: createdByInfo, digitadorAsignado: '', digitadorAsignadoLastUpdate: createdByInfo, worksheetId: newNe, entregadoAforoAt: null, isArchived: false, executiveComments: [{ id: uuidv4(), author: user.displayName, text: `Duplicado del NE: ${caseToDuplicate.ne}. Motivo: ${duplicateReason}`, createdAt: creationTimestamp }] };
        batch.set(newAforoMetaRef, newCaseData);

        const originalAforoMetaRef = doc(originalWorksheetRef, 'aforo', 'metadata');
        batch.update(originalAforoMetaRef, { digitacionStatus: 'TRASLADADO', isArchived: true });

        const originalUpdatesRef = collection(originalWorksheetRef, 'actualizaciones');
        const updateLog: AforoUpdate = { updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'digitacionStatus', oldValue: caseToDuplicate.aforo?.digitacionStatus, newValue: 'TRASLADADO', comment: `Caso trasladado al nuevo NE: ${newNe}. Motivo: ${duplicateReason}` };
        batch.set(doc(originalUpdatesRef), updateLog);
        
        const newUpdatesRef = collection(newWorksheetRef, 'actualizaciones');
        const newCaseLog: AforoUpdate = { updatedAt: creationTimestamp, updatedBy: user.displayName, field: 'creation', oldValue: null, newValue: `duplicated_from_${caseToDuplicate.ne}`, comment: `Caso duplicado desde ${caseToDuplicate.ne}. Motivo: ${duplicateReason}` };
        batch.set(doc(newUpdatesRef), newCaseLog);

        await batch.commit();
        toast({ title: 'Éxito', description: `El caso ${caseToDuplicate.ne} fue duplicado a ${newNe} y retirado.` });
        setDuplicateAndRetireModalOpen(false);

    } catch (e) {
        toast({ title: 'Error', description: 'No se pudo duplicar el caso.', variant: 'destructive' });
    } finally {
        if(caseToDuplicate) setSavingState(prev => ({...prev, [caseToDuplicate.id]: false }));
    }
  };

  const handleDeathkey = async () => {
    if (pinInput !== "192438") {
        toast({ title: "PIN Incorrecto", variant: "destructive" });
        return;
    }
    if (selectedRows.length === 0 || !user || !user.displayName) return;

    setIsLoading(true);
    const batch = writeBatch(db);

    for (const caseId of selectedRows) {
        const caseItem = allCases.find(c => c.id === caseId);
        if (caseItem && caseItem.worksheetId) {
            const worksheetRef = doc(db, 'worksheets', caseItem.worksheetId);
            batch.update(worksheetRef, { worksheetType: 'corporate_report' });

            const updatesSubcollectionRef = collection(worksheetRef, 'actualizaciones');
            const updateLog: AforoUpdate = {
                updatedAt: Timestamp.now(),
                updatedBy: user.displayName,
                field: 'worksheetType',
                oldValue: caseItem.worksheet?.worksheetType || 'hoja_de_trabajo',
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
    } catch (error) {
        console.error("Error with Deathkey action:", error);
        toast({ title: "Error", description: "No se pudieron reclasificar los casos.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleSendToFacturacion = async (caseId: string) => {
    if (!user || !user.displayName) return;
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    const aforoMetadataRef = doc(db, 'worksheets', caseId, 'aforo', 'metadata');
    try {
      await setDoc(aforoMetadataRef, {
        facturacionStatus: 'Enviado a Facturacion',
        enviadoAFacturacionAt: Timestamp.now(),
        facturadorAsignado: 'Alvaro Gonzalez',
        facturadorAsignadoAt: Timestamp.now(),
      }, { merge: true });
      toast({ title: 'Enviado a Facturación', description: 'El caso ha sido remitido al módulo de facturación y asignado a Alvaro Gonzalez.' });
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo enviar el caso a facturación.', variant: 'destructive' });
    } finally {
      setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  };

  const filteredCases = useMemo(() => {
    let baseCases = allCases.slice().sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    
    let filtered = baseCases.filter(c => !c.isArchived);
    let tabFiltered;
    if (activeTab === 'worksheets') { tabFiltered = filtered.filter(c => c.worksheet?.worksheetType === 'hoja_de_trabajo' || c.worksheet?.worksheetType === undefined); } 
    else if (activeTab === 'anexos') { tabFiltered = filtered.filter(c => c.worksheet?.worksheetType === 'anexo_5' || c.worksheet?.worksheetType === 'anexo_7'); } 
    else if (activeTab === 'corporate') { tabFiltered = filtered.filter(c => c.worksheet?.worksheetType === 'corporate_report'); } 
    else { tabFiltered = filtered }
    
    if (appliedFilters.isSearchActive) {
      let finalFiltered = tabFiltered;
      if (appliedFilters.searchTerm) finalFiltered = finalFiltered.filter(c => c.ne.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) || c.consignee.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()));
      if (appliedFilters.noFacturado && !appliedFilters.facturado) finalFiltered = finalFiltered.filter(c => !c.facturado);
      else if (appliedFilters.facturado && !appliedFilters.noFacturado) finalFiltered = finalFiltered.filter(c => c.facturado === true);
      if (appliedFilters.conAcuse && !appliedFilters.sinAcuse) finalFiltered = finalFiltered.filter(c => c.entregadoAforoAt);
      else if (appliedFilters.sinAcuse && !appliedFilters.conAcuse) finalFiltered = finalFiltered.filter(c => !c.entregadoAforoAt);
      
      if (appliedFilters.dateRange?.from) { finalFiltered = finalFiltered.filter(item => item.createdAt?.toDate() >= appliedFilters.dateRange!.from! && item.createdAt?.toDate() <= (appliedFilters.dateRange!.to ? appliedFilters.dateRange!.to : appliedFilters.dateRange!.from!)); }
      
      const { ne, ejecutivo, consignatario, factura, selectividad, incidentType } = columnFilters;
      if (ne) finalFiltered = finalFiltered.filter(c => c.ne.toLowerCase().includes(ne.toLowerCase()));
      if (ejecutivo) finalFiltered = finalFiltered.filter(c => c.executive.toLowerCase().includes(ejecutivo.toLowerCase()));
      if (consignatario) finalFiltered = finalFiltered.filter(c => c.consignee.toLowerCase().includes(consignatario.toLowerCase()));
      if (factura) { finalFiltered = finalFiltered.filter(c => (c.facturaNumber || '').toLowerCase().includes(factura.toLowerCase())); }
      if (selectividad) finalFiltered = finalFiltered.filter(c => (c.selectividad || '').toLowerCase().includes(selectividad.toLowerCase()));
      if (incidentType) { finalFiltered = finalFiltered.filter(c => getIncidentTypeDisplay(c).toLowerCase().includes(incidentType.toLowerCase())); }
      
      if (finalFiltered.length === 0 && appliedFilters.searchTerm) {
        const term = appliedFilters.searchTerm.toLowerCase();
        const otherTabs: TabValue[] = ['worksheets', 'anexos', 'corporate'].filter(t => t !== activeTab);
        for (const tab of otherTabs) {
          let hintFiltered: WorksheetWithCase[] = [];
          if (tab === 'worksheets') hintFiltered = filtered.filter(c => !c.isArchived && (c.worksheet?.worksheetType === 'hoja_de_trabajo' || c.worksheet?.worksheetType === undefined) && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          else if (tab === 'anexos') hintFiltered = filtered.filter(c => !c.isArchived && (c.worksheet?.worksheetType === 'anexo_5' || c.worksheet?.worksheetType === 'anexo_7') && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          else hintFiltered = filtered.filter(c => !c.isArchived && c.worksheet?.worksheetType === 'corporate_report' && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          if (hintFiltered.length > 0) { setSearchHint({ foundIn: tab, label: tab === 'worksheets' ? 'Hojas de Trabajo' : tab === 'anexos' ? 'Anexos' : 'Reportes Corporativos' }); break; } 
          else { setSearchHint(null); }
        }
      } else { setSearchHint(null); }
      return finalFiltered;
    }
    
    setSearchHint(null);
    return tabFiltered.slice(0, 15);
  }, [allCases, appliedFilters, activeTab, columnFilters, acuseFilter]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = appliedFilters.isSearchActive ? filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : filteredCases;
  
  const caseActions = {
    handleViewWorksheet: (c: AforoData) => {
        if (!c.worksheetId) {
            toast({ title: "Error", description: "Este caso no tiene una hoja de trabajo asociada.", variant: "destructive" });
            return;
        }
        const ws = allCases.find(cs => cs.id === c.id)?.worksheet;
        if (ws) {
            setModalState(prev => ({...prev, worksheet: ws}));
        } else {
            toast({ title: "Error", description: "No se pudo encontrar la hoja de trabajo.", variant: "destructive" });
        }
    },
    setSelectedCaseForQuickRequest: (c: WorksheetWithCase) => setModalState(prev => ({...prev, quickRequest: c})),
    setSelectedCaseForPayment: (c: AforoData) => {
        const initialData: InitialDataContext = {
            ne: c.ne,
            reference: c.worksheet?.reference || undefined,
            manager: user?.displayName || 'N/A',
            date: new Date(),
            recipient: 'Contabilidad',
            isMemorandum: false,
            consignee: c.consignee,
            declaracionAduanera: c.declaracionAduanera,
            caseId: c.id
        };
        setInitialContextData(initialData);
        openAddProductModal();
    },
    setSelectedCaseForPaymentList: (c: AforoData) => setModalState(prev => ({...prev, paymentList: c})),
    setSelectedCaseForResa: (c: AforoData) => setModalState(prev => ({...prev, resa: c})),
    setSelectedCaseForIncident: (c: AforoData) => setModalState(prev => ({...prev, incident: c})),
    setSelectedCaseForValueDoubt: (c: AforoData) => setModalState(prev => ({...prev, valueDoubt: c})),
    setSelectedCaseForHistory: (c: AforoData) => setModalState(prev => ({...prev, history: c})),
    handleViewIncidents: (c: AforoData) => {
        const hasRectificacion = c.incidentType === 'Rectificacion';
        const hasDuda = c.hasValueDoubt;
        if (hasRectificacion && hasDuda) {
            setModalState(prev => ({...prev, viewIncidents: c}));
        } else if (hasRectificacion) {
            setModalState(prev => ({...prev, incidentDetails: c}));
        } else if (hasDuda) {
            setModalState(prev => ({...prev, valueDoubt: c}));
        } else {
            toast({ title: "Sin Incidencias", description: "Este caso no tiene incidencias reportadas.", variant: "default" });
        }
    },
    setSelectedCaseForComment: (c: AforoData) => setModalState(prev => ({...prev, comment: c})),
    handleSearchPrevio: (ne: string) => router.push(`/database?ne=${ne}`),
    setCaseToArchive: (c: WorksheetWithCase) => setModalState(prev => ({...prev, archive: c})),
    setCaseToDuplicate,
    setDuplicateAndRetireModalOpen,
    setSelectedCaseForProcess: (c: AforoData) => setModalState(prev => ({...prev, process: c})),
  };

  const handleSearch = () => {
    let dateRange: DateRange | undefined = dateRangeInput;
    if (dateFilterType === 'month') {
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0);
        dateRange = { from: start, to: end };
    } else if (dateFilterType === 'today') {
        const today = new Date();
        dateRange = { from: today, to: today };
    }

    setAppliedFilters({ searchTerm, ...facturadoFilter, ...acuseFilter, preliquidation: preliquidationFilter, dateFilterType, dateRange, isSearchActive: true });
    setCurrentPage(1);
  };
  const clearFilters = () => {
    setSearchTerm('');
    setFacturadoFilter({ facturado: false, noFacturado: true });
    setAcuseFilter({ conAcuse: false, sinAcuse: true });
    setPreliquidationFilter(false);
    setDateRangeInput(undefined);
    setColumnFilters({ ne: '', ejecutivo: '', consignatario: '', factura: '', selectividad: '', incidentType: '' });
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
    openAddProductModal();
  };
  const approvePreliquidation = (caseId: string) => { handleAutoSave(caseId, 'preliquidationStatus', 'Aprobada'); };
  const getIncidentTypeDisplay = (c: AforoData) => {
    const types = [];
    if (c.incidentType === 'Rectificacion') types.push('Rectificación');
    if (c.hasValueDoubt) types.push('Duda de Valor');
    return types.length > 0 ? types.join(' / ') : 'N/A';
  };
  
  const handleSelectAllForPreliquidation = () => {
    const selectableIds = filteredCases.filter(c => c.aforo?.revisorStatus === 'Aprobado' && c.aforo.preliquidationStatus !== 'Aprobada').map(c => c.id);
    if (selectedRows.length === selectableIds.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(selectableIds);
    }
  };
  
  

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (modalState.incidentDetails) {
      return <AppShell><div className="py-2 md:py-5"><IncidentReportDetails caseData={modalState.incidentDetails as any} onClose={() => setModalState(prev => ({...prev, incidentDetails: null}))}/></div></AppShell>;
  }
  if (modalState.worksheet) {
      return <AppShell><div className="py-2 md:py-5"><WorksheetDetails worksheet={modalState.worksheet as WorksheetWithCase} onClose={() => setModalState(prev => ({...prev, worksheet: null}))}/></div></AppShell>;
  }

  const handleExport = async () => {
    if (filteredCases.length === 0) {
        toast({ title: "No hay datos", description: "No hay casos en la tabla para exportar.", variant: "secondary" });
        return;
    }
    setIsExporting(true);

    try {
        if (activeTab === 'corporate') {
            await downloadCorporateReportAsExcel(filteredCases.map(c => c.worksheet).filter(ws => ws !== null) as Worksheet[]);
        } else {
            const auditLogs: (AforoUpdate & { caseNe: string })[] = [];

            for (const caseItem of paginatedCases) {
                if (!caseItem.worksheetId) continue;
                const logsQuery = query(collection(db, 'worksheets', caseItem.worksheetId, 'actualizaciones'), orderBy('updatedAt', 'asc'));
                const logSnapshot = await getDocs(logsQuery);
                logSnapshot.forEach(logDoc => {
                    auditLogs.push({
                        ...(logDoc.data() as AforoUpdate),
                        caseNe: caseItem.ne
                    });
                });
            }
            await downloadExecutiveReportAsExcel(paginatedCases, auditLogs);
        }
    } catch (e) {
        console.error("Error exporting data: ", e);
        toast({ title: "Error de Exportación", description: "No se pudieron obtener todos los detalles para el reporte.", variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
  };


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
                    <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
                         <TabsList className="mb-4">
                           <TabsTrigger value="worksheets">Hojas de Trabajo</TabsTrigger>
                           <TabsTrigger value="anexos">Anexos</TabsTrigger>
                           <TabsTrigger value="corporate">Reportes Corporativos</TabsTrigger>
                         </TabsList>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input placeholder="Buscar por NE o Consignatario..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                                <div className="flex items-center flex-wrap gap-4">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-[200px] justify-start"><ChevronsUpDown className="mr-2 h-4 w-4"/> Filtrar Visibilidad</Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-2" align="end">
                                            <div className="grid gap-2">
                                              <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={facturadoFilter.noFacturado} onCheckedChange={(checked) => setFacturadoFilter(f => ({ ...f, noFacturado: !!checked }))} />No Facturados</label>
                                              <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={facturadoFilter.facturado} onCheckedChange={(checked) => setFacturadoFilter(f => ({ ...f, facturado: !!checked }))} />Facturados</label>
                                            </div>
                                            <div className="grid gap-2 mt-2 pt-2 border-t">
                                                <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={acuseFilter.sinAcuse} onCheckedChange={(checked) => setAcuseFilter(f => ({ ...f, sinAcuse: !!checked }))} />Sin Acuse</label>
                                                <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={acuseFilter.conAcuse} onCheckedChange={(checked) => setAcuseFilter(f => ({ ...f, conAcuse: !!checked }))} />Con Acuse</label>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                                    <Button variant="outline" onClick={clearFilters}>Limpiar Filtros</Button>
                                     <Button variant="outline" onClick={fetchCases}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
                                    </Button>
                                    <Button onClick={handleExport} disabled={allCases.length === 0 || isExporting}>
                                       {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                       {isExporting ? 'Exportando...' : 'Exportar'}
                                    </Button>
                                </div>
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
                        </div>
                        <TabsContent value="worksheets" className="mt-6">
                            <ExecutiveCasesTable cases={paginatedCases} savingState={savingState} onAutoSave={handleAutoSave} approvePreliquidation={approvePreliquidation} caseActions={caseActions} selectedRows={selectedRows} onSelectRow={setSelectedRows} onSelectAllRows={handleSelectAllForPreliquidation} columnFilters={columnFilters} setColumnFilters={setColumnFilters} handleSendToFacturacion={handleSendToFacturacion} onSearch={handleSearch} getIncidentTypeDisplay={getIncidentTypeDisplay} />
                        </TabsContent>
                        <TabsContent value="anexos" className="mt-6">
                            <ExecutiveCasesTable cases={paginatedCases} savingState={savingState} onAutoSave={handleAutoSave} approvePreliquidation={approvePreliquidation} caseActions={caseActions} selectedRows={selectedRows} onSelectRow={setSelectedRows} onSelectAllRows={handleSelectAllForPreliquidation} columnFilters={columnFilters} setColumnFilters={setColumnFilters} handleSendToFacturacion={handleSendToFacturacion} onSearch={handleSearch} getIncidentTypeDisplay={getIncidentTypeDisplay}/>
                        </TabsContent>
                        <TabsContent value="corporate" className="mt-6">
                            <ExecutiveCasesTable cases={paginatedCases} savingState={savingState} onAutoSave={handleAutoSave} approvePreliquidation={approvePreliquidation} caseActions={caseActions} selectedRows={selectedRows} onSelectRow={setSelectedRows} onSelectAllRows={handleSelectAllForPreliquidation} columnFilters={columnFilters} setColumnFilters={setColumnFilters} handleSendToFacturacion={handleSendToFacturacion} onSearch={handleSearch} getIncidentTypeDisplay={getIncidentTypeDisplay}/>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
      </AppShell>
    {modalState.history && (<AforoHistoryModal isOpen={!!modalState.history} onClose={() => setModalState(p => ({...p, history: null}))} caseData={modalState.history} />)}
    {modalState.incident && (<IncidentReportModal isOpen={!!modalState.incident} onClose={() => setModalState(p => ({...p, incident: null}))} caseData={modalState.incident as any} />)}
    {modalState.valueDoubt && (<ValueDoubtModal isOpen={!!modalState.valueDoubt} onClose={() => setModalState(p => ({...p, valueDoubt: null}))} caseData={modalState.valueDoubt as any} />)}
    {modalState.comment && (<ExecutiveCommentModal isOpen={!!modalState.comment} onClose={() => setModalState(p => ({...p, comment: null}))} caseData={modalState.comment as any} />)}
    {modalState.quickRequest && (<QuickRequestModal isOpen={!!modalState.quickRequest} onClose={() => setModalState(p => ({...p, quickRequest: null}))} caseWithWorksheet={modalState.quickRequest} />)}
    {modalState.payment && (<PaymentRequestModal isOpen={!!modalState.payment} onClose={() => setModalState(p => ({...p, payment: null}))} caseData={modalState.payment as any} />)}
    {isRequestPaymentModalOpen && (<PaymentRequestModal isOpen={isRequestPaymentModalOpen} onClose={() => setIsRequestPaymentModalOpen(false)} caseData={null} />)}
    {modalState.paymentList && (<PaymentListModal isOpen={!!modalState.paymentList} onClose={() => setModalState(p => ({...p, paymentList: null}))} caseData={modalState.paymentList as any} />)}
    {modalState.resa && (<ResaNotificationModal isOpen={!!modalState.resa} onClose={() => setModalState(p => ({...p, resa: null}))} caseData={modalState.resa as any} />)}
    {caseToAssignAforador && (<AssignUserModal isOpen={!!caseToAssignAforador} onClose={() => setCaseToAssignAforador(null)} caseData={caseToAssignAforador as any} assignableUsers={assignableUsers} onAssign={handleAssignAforador} title="Asignar Aforador (PSMT)" description={`Como el consignatario es PSMT, debe asignar un aforador para el caso NE: ${caseToAssignAforador.ne}.`}/>)}
    {modalState.viewIncidents && (<ViewIncidentsModal isOpen={!!modalState.viewIncidents} onClose={() => setModalState(p => ({...p, viewIncidents: null}))} onSelectRectificacion={() => { setModalState(p => ({...p, incidentDetails: p.viewIncidents, viewIncidents: null})); }} onSelectDudaValor={() => { setModalState(p => ({...p, valueDoubt: p.viewIncidents, viewIncidents: null})); }} />)}
    {modalState.process && (<StatusProcessModal isOpen={!!modalState.process} onClose={() => setModalState(p => ({...p, process: null}))} caseData={modalState.process as any} />)}
    <AlertDialog open={!!modalState.archive} onOpenChange={(isOpen) => !isOpen && setModalState(p => ({...p, archive: null}))}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Está seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción archivará el caso y no será visible en las listas principales.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleArchiveCase}>Sí, Archivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={duplicateAndRetireModalOpen} onOpenChange={setDuplicateAndRetireModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Duplicar y Retirar Caso</DialogTitle>
                <DialogDescription>
                    Se creará un nuevo caso con un NE nuevo, y el caso original ({caseToDuplicate?.ne}) será retirado (archivado y marcado como trasladado).
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div><Label htmlFor="new-ne">Nuevo NE</Label><Input id="new-ne" value={newNeForDuplicate} onChange={e => setNewNeForDuplicate(e.target.value)} placeholder="Ingrese el nuevo NE" /></div>
                <div><Label htmlFor="reason">Motivo</Label><Textarea id="reason" value={duplicateReason} onChange={e => setDuplicateReason(e.target.value)} placeholder="Explique brevemente el motivo de la duplicación" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDuplicateAndRetireModalOpen(false)}>Cancelar</Button><Button onClick={handleDuplicateAndRetire} disabled={savingState[caseToDuplicate?.id || '']}>Duplicar y Retirar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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
