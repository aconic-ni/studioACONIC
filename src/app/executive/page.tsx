
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
import { format, toDate, isSameDay, startOfDay, endOfDay, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { AforoCaseHistoryModal } from '@/components/reporter/AforoCaseHistoryModal';
import { IncidentReportModal } from '@/components/reporter/IncidentReportModal';
import { Badge } from '@/components/ui/badge';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { ManageDocumentsModal } from '@/components/executive/ManageDocumentsModal';
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
  const isMobile = useIsMobile();
  const { openAddProductModal, setInitialContextData, setIsMemorandumMode, caseToAssignAforador, setCaseToAssignAforador } = useAppContext();
  const [allCases, setAllCases] = useState<WorksheetWithCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);

  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForIncident, setSelectedCaseForIncident] = useState<AforoCase | null>(null);
  const [selectedCaseForValueDoubt, setSelectedCaseForValueDoubt] = useState<AforoCase | null>(null);
  const [selectedIncidentForDetails, setSelectedIncidentForDetails] = useState<AforoCase | null>(null);
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);
  const [selectedCaseForComment, setSelectedCaseForComment] = useState<AforoCase | null>(null);
  const [selectedCaseForQuickRequest, setSelectedCaseForQuickRequest] = useState<WorksheetWithCase | null>(null);
  const [selectedCaseForPayment, setSelectedCaseForPayment] = useState<AforoCase | null>(null);
  const [selectedCaseForPaymentList, setSelectedCaseForPaymentList] = useState<AforoCase | null>(null);
  const [selectedCaseForResa, setSelectedCaseForResa] = useState<AforoCase | null>(null);
  const [isRequestPaymentModalOpen, setIsRequestPaymentModalOpen] = useState(false);
  const [selectedCaseForViewIncidents, setSelectedCaseForViewIncidents] = useState<AforoCase | null>(null);
  const [caseToArchive, setCaseToArchive] = useState<WorksheetWithCase | null>(null);
  const [selectedCaseForProcess, setSelectedCaseForProcess] = useState<AforoCase | null>(null);
  const [isDeathkeyModalOpen, setIsDeathkeyModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  
  const [duplicateAndRetireModalOpen, setDuplicateAndRetireModalOpen] = useState(false);
  const [caseToDuplicate, setCaseToDuplicate] = useState<WorksheetWithCase | null>(null);
  const [newNeForDuplicate, setNewNeForDuplicate] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  
  const [facturadoFilter, setFacturadoFilter] = useState({ facturado: false, noFacturado: true });
  const [acuseFilter, setAcuseFilter] = useState({ conAcuse: false, sinAcuse: true });
  const [preliquidationFilter, setPreliquidationFilter] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  const urlTab = searchParams.get('tab') as TabValue | null;
  const activeTab = urlTab || 'worksheets';
  
  const [searchHint, setSearchHint] = useState<{ foundIn: TabValue; label: string } | null>(null);


  const handleTabChange = (value: string) => {
    const tabValue = value as TabValue;
    router.push(`/executive?tab=${tabValue}`, { scroll: false });
    setCurrentPage(1); // Reset page on tab change
    setSearchHint(null);
  };
  
  const [appliedFilters, setAppliedFilters] = useState({
    searchTerm: '',
    facturado: false,
    noFacturado: true,
    conAcuse: false,
    sinAcuse: true,
    preliquidation: false,
    dateFilterType: 'range' as DateFilterType,
    dateRange: undefined as DateRange | undefined,
    isSearchActive: false, 
  });
  
  const [neFilter, setNeFilter] = useState('');
  const [ejecutivoFilter, setEjecutivoFilter] = useState('');
  const [consignatarioFilter, setConsignatarioFilter] = useState('');
  const [facturaFilter, setFacturaFilter] = useState('');
  const [selectividadFilter, setSelectividadFilter] = useState('');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('');

  // Pagination and selection state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

   const fetchCases = useCallback(async () => {
    if (!user) return () => {};
    setIsLoading(true);
    
    let aforoQuery;
    const globalVisibilityRoles = ['admin', 'supervisor', 'coordinadora'];
    const groupVisibilityRoles = ['ejecutivo'];

    if (user.role && globalVisibilityRoles.includes(user.role)) {
      aforoQuery = query(collection(db, 'AforoCases'));
    } else if (user.role && groupVisibilityRoles.includes(user.role) && user.visibilityGroup && user.visibilityGroup.length > 0) {
        const groupDisplayNames = Array.from(new Set([user.displayName, ...(user.visibilityGroup?.map(m => m.displayName) || [])])).filter(Boolean) as string[];
         if (groupDisplayNames.length > 0) {
            aforoQuery = query(collection(db, 'AforoCases'), where("executive", "in", groupDisplayNames));
        } else {
            aforoQuery = query(collection(db, 'AforoCases'), where("executive", "==", user.displayName));
        }
    } else if (user.displayName) {
        aforoQuery = query(collection(db, 'AforoCases'), where('executive', '==', user.displayName));
    } else {
        setAllCases([]);
        setIsLoading(false);
        return () => {};
    }


    const unsubscribe = onSnapshot(aforoQuery, async (aforoSnapshot) => {
        const aforoCasesData = aforoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        
        const [worksheetsSnap, examenesSnap, solicitudesSnap, memorandumSnap] = await Promise.all([
            getDocs(collection(db, 'worksheets')),
            getDocs(collection(db, 'examenesPrevios')),
            getDocs(query(collection(db, "SolicitudCheques"), orderBy("savedAt", "desc"))),
            getDocs(query(collection(db, "Memorandum"), orderBy("savedAt", "desc"))),
        ]);

        const worksheetsMap = new Map(worksheetsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Worksheet]));
        const examenesMap = new Map(examenesSnap.docs.map(doc => [doc.id, doc.data() as any]));
        
        const allSolicitudes = new Map<string, SolicitudRecord[]>();
        [...solicitudesSnap.docs, ...memorandumSnap.docs].forEach(doc => {
            const data = doc.data() as SolicitudRecord;
            if(data.examNe) {
                const ne = data.examNe;
                if (!allSolicitudes.has(ne)) {
                    allSolicitudes.set(ne, []);
                }
                allSolicitudes.get(ne)!.push({ solicitudId: doc.id, ...data });
            }
        });
        
        const combinedDataPromises = aforoCasesData.map(async (caseItem) => {
            if (!caseItem.worksheetId) {
                return { ...caseItem, worksheet: null, acuseLog: null };
            }
            const updatesRef = collection(db, 'worksheets', caseItem.worksheetId, 'actualizaciones');
            const acuseQuery = query(updatesRef, where('newValue', '==', 'worksheet_received'), orderBy('updatedAt', 'desc'));
            const acuseSnapshot = await getDocs(acuseQuery);
            const acuseLog = acuseSnapshot.empty ? null : acuseSnapshot.docs[0].data() as AforoCaseUpdate;

            return {
                ...caseItem,
                worksheet: worksheetsMap.get(caseItem.worksheetId || '') || null,
                examenPrevio: examenesMap.get(caseItem.id) || null,
                pagos: allSolicitudes.get(caseItem.ne) || [],
                acuseLog: acuseLog,
            };
        });

        const combinedData = await Promise.all(combinedDataPromises);
        
        setAllCases(combinedData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching aforo cases:", error);
        toast({ title: "Error de Carga", description: "No se pudieron cargar los datos de los casos.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
}, [user, toast]);
  

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    fetchCases().then(unsub => {
        if(unsub) unsubscribe = unsub;
    });

    const fetchAssignableUsers = async () => {
        const usersQuery = query(collection(db, 'users'), where('role', 'in', ['aforador', 'coordinadora']));
        const querySnapshot = await getDocs(usersQuery);
        const users = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
        setAssignableUsers(users);
    };
    fetchAssignableUsers();

    return () => {
        if(unsubscribe) unsubscribe();
    };
  }, [fetchCases]);
  
  const handleAssignAforador = async (caseId: string, aforadorName: string) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }
    const caseDocRef = doc(db, 'AforoCases', caseId);
    try {
        await updateDoc(caseDocRef, { 
            aforador: aforadorName,
            assignmentDate: Timestamp.now(),
            aforadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });
        toast({ title: 'Aforador Asignado', description: `${aforadorName} ha sido asignado al caso.` });
        setCaseToAssignAforador(null);
    } catch (error) {
        console.error('Error assigning aforador:', error);
        toast({ title: 'Error', description: 'No se pudo asignar el aforador.', variant: 'destructive' });
    }
  };

  const handleArchiveCase = async () => {
    if (!user || user.role !== 'admin' || !user.email || !caseToArchive) {
      toast({ title: "Acción no permitida", variant: "destructive" });
      setCaseToArchive(null);
      return;
    }
  
    setSavingState(prev => ({ ...prev, [caseToArchive.id]: true }));
    const batch = writeBatch(db);
  
    const aforoCaseRef = doc(db, "AforoCases", caseToArchive.id);
    batch.update(aforoCaseRef, { isArchived: true });
  
    if (caseToArchive.worksheetId) {
      const worksheetRef = doc(db, "worksheets", caseToArchive.worksheetId);
      batch.update(worksheetRef, { isArchived: true });

      const logRef = doc(collection(worksheetRef, "actualizaciones"));
      const logData = {
          updatedAt: serverTimestamp(),
          updatedBy: user.email,
          field: 'isArchived',
          oldValue: false,
          newValue: true,
          comment: 'Caso archivado por administrador.'
      };
      batch.set(logRef, logData);
    }
  
    try {
      await batch.commit();
      toast({ title: "Caso Archivado", description: "El caso ha sido movido al archivo." });
      setCaseToArchive(null); // Close the dialog
    } catch (error) {
      console.error("Error archiving case:", error);
      toast({ title: "Error", description: "No se pudo archivar el caso.", variant: "destructive" });
    } finally {
      setSavingState(prev => ({ ...prev, [caseToArchive.id]: false }));
    }
  };


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
        if (field === 'facturado' && value === true) {
            updateData.facturadoAt = Timestamp.now();
        }

        if (field.toLowerCase().includes('status')) {
          const lastUpdateField = `${''}${field}LastUpdate` as keyof AforoCase;
          updateData[lastUpdateField] = { by: user.displayName, at: Timestamp.now() }
        }

        batch.update(doc(db, 'AforoCases', caseId), updateData);

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
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
}, [user, allCases, toast]);

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

    setAppliedFilters({
      searchTerm,
      ...facturadoFilter,
      ...acuseFilter,
      preliquidation: preliquidationFilter,
      dateFilterType: dateFilterType,
      dateRange: dateRange,
      isSearchActive: true,
    });
    setCurrentPage(1);
  };
  
  const handleExport = async () => {
    if (filteredCases.length === 0) {
      toast({ title: "No hay datos", description: "No hay casos en la tabla para exportar.", variant: "secondary"});
      return;
    };
    if (!db) return;
    setIsExporting(true);

    try {
        if (activeTab === 'corporate') {
            await downloadCorporateReportAsExcel(filteredCases.map(c => c.worksheet).filter(ws => ws !== null) as Worksheet[]);
        } else {
            const casesToExport = paginatedCases;
            const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];

            for (const caseItem of casesToExport) {
                if (!caseItem.worksheetId) continue;
                const logsQuery = query(collection(db, 'worksheets', caseItem.worksheetId, 'actualizaciones'), orderBy('updatedAt', 'asc'));
                const logSnapshot = await getDocs(logsQuery);
                logSnapshot.forEach(logDoc => {
                    auditLogs.push({
                        ...(logDoc.data() as AforoCaseUpdate),
                        caseNe: caseItem.ne
                    });
                });
            }
            await downloadExecutiveReportAsExcel(casesToExport, auditLogs);
        }
    } catch (e) {
        console.error("Error exporting data: ", e);
        toast({ title: "Error de Exportación", description: "No se pudieron obtener todos los detalles para el reporte.", variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
};

  const handleViewWorksheet = async (caseItem: AforoCase) => {
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
  
  const handleViewIncidents = (caseItem: AforoCase) => {
    const hasRectificacion = caseItem.incidentType === 'Rectificacion';
    const hasDuda = caseItem.hasValueDoubt;

    if (hasRectificacion && hasDuda) {
        setSelectedCaseForViewIncidents(caseItem);
    } else if (hasRectificacion) {
        setSelectedIncidentForDetails(caseItem);
    } else if (hasDuda) {
        setSelectedCaseForValueDoubt(caseItem);
    } else {
        toast({ title: "Sin Incidencias", description: "Este caso no tiene incidencias reportadas.", variant: "default" });
    }
  }


  const handleSearchPrevio = (ne: string) => {
    router.push(`/database?ne=${ne}`);
  };


  const clearFilters = () => {
    setSearchTerm('');
    setFacturadoFilter({ facturado: false, noFacturado: true });
    setAcuseFilter({ conAcuse: false, sinAcuse: true });
    setPreliquidationFilter(false);
    setDateRangeInput(undefined);
    setNeFilter('');
    setEjecutivoFilter('');
    setConsignatarioFilter('');
    setFacturaFilter('');
    setSelectividadFilter('');
    setIncidentTypeFilter('');
    setAppliedFilters({ searchTerm: '', facturado: false, noFacturado: true, conAcuse: false, sinAcuse: true, preliquidation: false, dateFilterType: 'range', dateRange: undefined, isSearchActive: false });
    setCurrentPage(1);
    setSearchHint(null);
  };
  
  const handleSendToFacturacion = async (caseId: string) => {
    if (!user || !user.displayName) return;

    setSavingState(prev => ({...prev, [caseId]: true}));
    
    const caseDocRef = doc(db, 'AforoCases', caseId);
    try {
        await updateDoc(caseDocRef, {
            facturacionStatus: 'Enviado a Facturacion',
            enviadoAFacturacionAt: Timestamp.now(),
            facturadorAsignado: 'Alvaro Gonzalez',
            facturadorAsignadoAt: Timestamp.now(),
        });
        toast({ title: 'Enviado a Facturación', description: 'El caso ha sido remitido al módulo de facturación y asignado a Alvaro Gonzalez.' });
    } catch (e) {
        toast({ title: 'Error', description: 'No se pudo enviar el caso a facturación.', variant: 'destructive'});
    } finally {
        setSavingState(prev => ({...prev, [caseId]: false}));
    }
  }

  const getIncidentTypeDisplay = (c: AforoCase) => {
    const types = [];
    if (c.incidentType === 'Rectificacion') types.push('Rectificación');
    if (c.hasValueDoubt) types.push('Duda de Valor');
    return types.length > 0 ? types.join(' / ') : 'N/A';
  };


  const filteredCases = useMemo(() => {
    let baseCases = allCases.slice().sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    
    let filtered = baseCases.filter(c => !c.isArchived);

    // Initial filter by tab
    let tabFiltered;
    if (activeTab === 'worksheets') {
        tabFiltered = filtered.filter(c => c.worksheet?.worksheetType === 'hoja_de_trabajo' || c.worksheet?.worksheetType === undefined);
    } else if (activeTab === 'anexos') {
        tabFiltered = filtered.filter(c => c.worksheet?.worksheetType === 'anexo_5' || c.worksheet?.worksheetType === 'anexo_7');
    } else { // corporate
        tabFiltered = filtered.filter(c => c.worksheet?.worksheetType === 'corporate_report');
    }

    if (appliedFilters.isSearchActive) {
      let finalFiltered = tabFiltered;

      // Apply text and status filters
      if (appliedFilters.searchTerm) {
          finalFiltered = finalFiltered.filter(c =>
            c.ne.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
            c.consignee.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase())
          );
      }
      if (appliedFilters.noFacturado && !appliedFilters.facturado) {
          finalFiltered = finalFiltered.filter(c => !c.facturado);
      } else if (appliedFilters.facturado && !appliedFilters.noFacturado) {
          finalFiltered = finalFiltered.filter(c => c.facturado === true);
      }
      if (appliedFilters.conAcuse && !appliedFilters.sinAcuse) {
          finalFiltered = finalFiltered.filter(c => c.entregadoAforoAt);
      } else if (appliedFilters.sinAcuse && !appliedFilters.conAcuse) {
          finalFiltered = finalFiltered.filter(c => !c.entregadoAforoAt);
      }
       if (appliedFilters.preliquidation) {
        finalFiltered = finalFiltered.filter(c => {
          const aforoData = (c as any).aforo || c;
          return aforoData.revisorStatus === 'Aprobado' && aforoData.preliquidationStatus !== 'Aprobada';
        });
      }
      // Apply date filter
      if (appliedFilters.dateRange?.from) {
          const start = startOfDay(appliedFilters.dateRange.from);
          const end = appliedFilters.dateRange.to ? endOfDay(appliedFilters.dateRange.to) : endOfDay(appliedFilters.dateRange.from);
          finalFiltered = finalFiltered.filter(item => {
              const itemDate = item.createdAt?.toDate();
              return itemDate && itemDate >= start && itemDate <= end;
          });
      }
      
      // Column filters
      if (neFilter) finalFiltered = finalFiltered.filter(c => c.ne.toLowerCase().includes(neFilter.toLowerCase()));
      if (ejecutivoFilter) finalFiltered = finalFiltered.filter(c => c.executive.toLowerCase().includes(ejecutivoFilter.toLowerCase()));
      if (consignatarioFilter) finalFiltered = finalFiltered.filter(c => c.consignee.toLowerCase().includes(consignatarioFilter.toLowerCase()));
      if (facturaFilter) {
        const lowerCaseFilter = facturaFilter.toLowerCase();
        finalFiltered = finalFiltered.filter(c => {
          const facturas = c.worksheet?.worksheetType === 'corporate_report' 
            ? (c.worksheet.documents?.filter(d => d.type === 'FACTURA').map(d => d.number) || [])
            : (c.facturaNumber ? c.facturaNumber.split(';').map(f => f.trim()) : []);
          return facturas.some(f => f.toLowerCase().includes(lowerCaseFilter));
        });
      }
      if (selectividadFilter) finalFiltered = finalFiltered.filter(c => (c.selectividad || 'N/A').toLowerCase().includes(selectividadFilter.toLowerCase()));
      if (incidentTypeFilter) finalFiltered = finalFiltered.filter(c => getIncidentTypeDisplay(c).toLowerCase().includes(incidentTypeFilter.toLowerCase()));
      
      // --- New Search Hint Logic ---
      if (finalFiltered.length === 0 && appliedFilters.searchTerm) {
        const term = appliedFilters.searchTerm.toLowerCase();
        const otherTabs: TabValue[] = ['worksheets', 'anexos', 'corporate'].filter(t => t !== activeTab);
        
        for (const tab of otherTabs) {
          let hintFiltered: WorksheetWithCase[];
          if (tab === 'worksheets') {
              hintFiltered = filtered.filter(c => (c.worksheet?.worksheetType === 'hoja_de_trabajo' || c.worksheet?.worksheetType === undefined) && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          } else if (tab === 'anexos') {
              hintFiltered = filtered.filter(c => (c.worksheet?.worksheetType === 'anexo_5' || c.worksheet?.worksheetType === 'anexo_7') && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          } else { // corporate
              hintFiltered = filtered.filter(c => c.worksheet?.worksheetType === 'corporate_report' && (c.ne.toLowerCase().includes(term) || c.consignee.toLowerCase().includes(term)));
          }
          if (hintFiltered.length > 0) {
            setSearchHint({ foundIn: tab, label: tab === 'worksheets' ? 'Hojas de Trabajo' : tab === 'anexos' ? 'Anexos' : 'Reportes Corporativos' });
            break; // Stop at the first hint found
          } else {
            setSearchHint(null);
          }
        }
      } else {
        setSearchHint(null);
      }
      
      return finalFiltered;
    } else {
        // Not searching, return top results of the current tab
        setSearchHint(null);
        return tabFiltered;
    }
  }, [allCases, appliedFilters, activeTab, neFilter, ejecutivoFilter, consignatarioFilter, facturaFilter, selectividadFilter, incidentTypeFilter, acuseFilter]);
  
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = useMemo(() => {
    if (!appliedFilters.isSearchActive) {
      return filteredCases.slice(0, 20);
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCases.slice(startIndex, endIndex);
  }, [filteredCases, currentPage, itemsPerPage, appliedFilters.isSearchActive]);

  
  const approvePreliquidation = (caseId: string) => {
    handleAutoSave(caseId, 'preliquidationStatus', 'Aprobada');
  };
  
  const handleBulkApprovePreliquidation = async () => {
    if (!user || selectedRows.length === 0) return;
    const batch = writeBatch(db);
    selectedRows.forEach(id => {
      const caseItem = allCases.find(c => c.id === id);
      if (!caseItem?.worksheetId) return;

      const aforoCaseRef = doc(db, 'AforoCases', id);
      const updatesSubcollectionRef = collection(db, 'worksheets', caseItem.worksheetId, 'actualizaciones');
      
      batch.update(aforoCaseRef, { preliquidationStatus: 'Aprobada', preliquidationStatusLastUpdate: { by: user.displayName, at: Timestamp.now() } });
      
      const updateLog: AforoCaseUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.displayName || 'sistema',
        field: 'preliquidationStatus',
        oldValue: 'Pendiente',
        newValue: 'Aprobada',
        comment: 'Aprobación masiva de preliquidación'
      };
      batch.set(doc(updatesSubcollectionRef), updateLog);
    });
    await batch.commit();
    toast({ title: 'Éxito', description: `${selectedRows.length} preliquidaciones aprobadas.` });
    setSelectedRows([]);
  };

  const handleSelectAllForPreliquidation = () => {
    const selectableIds = filteredCases.filter(c => ((c as any).aforo || c).revisorStatus === 'Aprobado' && ((c as any).aforo || c).preliquidationStatus !== 'Aprobada').map(c => c.id);
    if (selectedRows.length === selectableIds.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(selectableIds);
    }
  };
  
  const handleDeathkey = async () => {
    if (pinInput !== "192438") {
        toast({ title: "PIN Incorrecto", variant: "destructive" });
        return;
    }
    if (selectedRows.length === 0) return;

    setIsLoading(true);
    const batch = writeBatch(db);

    for (const caseId of selectedRows) {
        const caseItem = filteredCases.find(c => c.id === caseId);
        if (caseItem && caseItem.worksheetId) {
            const worksheetRef = doc(db, 'worksheets', caseItem.worksheetId);
            batch.update(worksheetRef, { worksheetType: 'hoja_de_trabajo' });

            const updatesSubcollectionRef = collection(worksheetRef, 'actualizaciones');
            const updateLog: AforoCaseUpdate = {
                updatedAt: Timestamp.now(),
                updatedBy: user?.displayName || 'Sistema',
                field: 'worksheetType',
                oldValue: 'corporate_report',
                newValue: 'hoja_de_trabajo',
                comment: 'Caso reclasificado a Hoja de Trabajo via Deathkey.'
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

  const handleDuplicateAndRetire = async () => {
    if (!user || !user.displayName || !caseToDuplicate || !caseToDuplicate.worksheet) {
        toast({title: 'Error', description: 'No se puede procesar la solicitud. Faltan datos.', variant: 'destructive'});
        return;
    }
    const newNe = newNeForDuplicate.trim().toUpperCase();
    if (!newNe) {
        toast({title: 'Error', description: 'El nuevo NE no puede estar vacío.', variant: 'destructive'});
        return;
    }

    setSavingState(prev => ({...prev, [caseToDuplicate.id]: true}));
    
    const originalCaseRef = doc(db, 'AforoCases', caseToDuplicate.id);
    const newCaseRef = doc(db, 'AforoCases', newNe);
    const newWorksheetRef = doc(db, 'worksheets', newNe);
    
    const batch = writeBatch(db);

    try {
        const [newCaseSnap, newWorksheetSnap] = await Promise.all([getDoc(newCaseRef), getDoc(newWorksheetRef)]);
        if (newCaseSnap.exists() || newWorksheetSnap.exists()) {
            toast({ title: "Duplicado", description: `Ya existe un registro con el NE ${newNe}.`, variant: "destructive" });
            setSavingState(prev => ({...prev, [caseToDuplicate.id]: false}));
            return;
        }
        
        const creationTimestamp = Timestamp.now();
        const createdByInfo = { by: user.displayName, at: creationTimestamp };

        // 1. Create new worksheet - reset relevant fields
        const { id: oldId, ne: oldNe, createdAt: oldCreatedAt, lastUpdatedAt: oldLastUpdatedAt, ...worksheetToCopy } = caseToDuplicate.worksheet;
        const newWorksheetData: Worksheet = {
            ...worksheetToCopy,
            id: newNe,
            ne: newNe,
            createdAt: creationTimestamp,
            createdBy: user.email!,
            lastUpdatedAt: creationTimestamp,
        };
        batch.set(newWorksheetRef, newWorksheetData);
        
        // 2. Create new case - reset all statuses and dates
        const newCaseData: Omit<AforoCase, 'id'> = {
            ne: newNe,
            executive: caseToDuplicate.executive,
            consignee: caseToDuplicate.consignee,
            facturaNumber: caseToDuplicate.facturaNumber,
            declarationPattern: caseToDuplicate.declarationPattern,
            merchandise: caseToDuplicate.merchandise,
            createdBy: user.uid,
            createdAt: creationTimestamp,
            aforador: '',
            assignmentDate: null,
            aforadorStatus: 'Pendiente ',
            aforadorStatusLastUpdate: createdByInfo,
            revisorStatus: 'Pendiente',
            revisorStatusLastUpdate: createdByInfo,
            preliquidationStatus: 'Pendiente',
            preliquidationStatusLastUpdate: createdByInfo,
            digitacionStatus: 'Pendiente',
            digitacionStatusLastUpdate: createdByInfo,
            incidentStatus: 'Pendiente',
            incidentStatusLastUpdate: createdByInfo,
            revisorAsignado: '',
            revisorAsignadoLastUpdate: createdByInfo,
            digitadorAsignado: '',
            digitadorAsignadoLastUpdate: createdByInfo,
            worksheetId: newNe,
            entregadoAforoAt: null,
            isArchived: false,
            executiveComments: [{id: uuidv4(), author: user.displayName, text: `Duplicado del NE: ${caseToDuplicate.ne}. Motivo: ${duplicateReason}`, createdAt: creationTimestamp}],
        };
        batch.set(newCaseRef, newCaseData);

        // 3. Update old case
        batch.update(originalCaseRef, { digitacionStatus: 'TRASLADADO', isArchived: true });
        
        // 4. Log the action on the old case's worksheet
        const originalUpdatesRef = collection(db, 'worksheets', caseToDuplicate.id, 'actualizaciones');
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'digitacionStatus',
            oldValue: caseToDuplicate.digitacionStatus,
            newValue: 'TRASLADADO',
            comment: `Caso trasladado al nuevo NE: ${newNe}. Motivo: ${duplicateReason}`
        };
        batch.set(doc(originalUpdatesRef), updateLog);

        // 5. Log creation on new case's worksheet
        const newUpdatesRef = collection(db, 'worksheets', newNe, 'actualizaciones');
        const newCaseLog: AforoCaseUpdate = {
            updatedAt: creationTimestamp,
            updatedBy: user.displayName,
            field: 'creation',
            oldValue: null,
            newValue: `duplicated_from_${caseToDuplicate.ne}`,
            comment: `Caso duplicado desde ${caseToDuplicate.ne}. Motivo: ${duplicateReason}`
        };
        batch.set(doc(newUpdatesRef), newCaseLog);


        await batch.commit();
        toast({title: 'Operación Exitosa', description: `El caso ${caseToDuplicate.ne} ha sido duplicado a ${newNe} y retirado.`});
        setDuplicateAndRetireModalOpen(false);
    } catch(e) {
        console.error("Error duplicating and retiring", e);
        toast({title: 'Error', description: 'No se pudo completar la operación.', variant: 'destructive'});
    } finally {
        setSavingState(prev => ({...prev, [caseToDuplicate.id]: false}));
    }
  };

  const handleOpenPaymentRequest = () => {
    const initialData: InitialDataContext = {
        ne: `SOL-${format(new Date(), 'ddMMyy-HHmmss')}`,
        manager: user?.displayName || 'Usuario Desconocido',
        date: new Date(),
        recipient: '',
        isMemorandum: false,
    };
    setInitialContextData(initialData);
    setIsRequestPaymentModalOpen(true);
  };


  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Usuario';

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (selectedIncidentForDetails) {
    return (<AppShell><div className="py-2 md:py-5"><IncidentReportDetails caseData={selectedIncidentForDetails} onClose={() => setSelectedIncidentForDetails(null)} /></div></AppShell>);
  }
  if (selectedWorksheet) {
    return (<AppShell><div className="py-2 md:py-5"><WorksheetDetails worksheet={selectedWorksheet as WorksheetWithCase} onClose={() => setSelectedWorksheet(null)} /></div></AppShell>);
  }
  
  const caseActions = {
    handleViewWorksheet,
    setSelectedCaseForQuickRequest,
    setSelectedCaseForPayment,
    setSelectedCaseForPaymentList,
    setSelectedCaseForResa,
    setSelectedCaseForIncident,
    setSelectedCaseForValueDoubt,
    setSelectedCaseForHistory,
    setSelectedIncidentForDetails,
    setSelectedCaseForComment,
    handleSearchPrevio,
    setCaseToArchive,
    setCaseToDuplicate,
    setDuplicateAndRetireModalOpen,
    setSelectedCaseForProcess,
  };

  const renderTable = () => {
      if (isLoading) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      }
      if (filteredCases.length === 0 && appliedFilters.isSearchActive) {
        return (
        <div className="text-center py-10">
          <p className="text-muted-foreground">No se encontraron casos con los filtros actuales.</p>
          {searchHint && (
            <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Se encontró una coincidencia en la pestaña de <span className="font-semibold">{searchHint.label}</span>.
              </p>
              <Button onClick={() => handleTabChange(searchHint.foundIn)} className="mt-2" size="sm">
                Ir a {searchHint.label}
              </Button>
            </div>
          )}
        </div>
      );
      }
      if (filteredCases.length === 0 && !appliedFilters.isSearchActive) {
        return <p className="text-muted-foreground text-center py-10">No hay casos recientes para mostrar. Use la búsqueda para encontrar casos más antiguos.</p>
      }
  
      if (isMobile) {
        return <MobileCasesList cases={paginatedCases} savingState={savingState} onAutoSave={handleAutoSave} approvePreliquidation={approvePreliquidation} caseActions={caseActions} />;
      }
  
      return <ExecutiveCasesTable 
                cases={paginatedCases} 
                savingState={savingState}
                onAutoSave={handleAutoSave}
                approvePreliquidation={approvePreliquidation}
                caseActions={caseActions}
                selectedRows={selectedRows}
                onSelectRow={setSelectedRows}
                onSelectAllRows={handleSelectAllForPreliquidation}
                neFilter={neFilter} setNeFilter={setNeFilter}
                ejecutivoFilter={ejecutivoFilter} setEjecutivoFilter={setEjecutivoFilter}
                consignatarioFilter={consignatarioFilter} setConsignatarioFilter={setConsignatarioFilter}
                facturaFilter={facturaFilter} setFacturaFilter={setFacturaFilter}
                selectividadFilter={selectividadFilter} setSelectividadFilter={setSelectividadFilter}
                incidentTypeFilter={incidentTypeFilter} setIncidentTypeFilter={setIncidentTypeFilter}
                handleSendToFacturacion={handleSendToFacturacion}
                onSearch={handleSearch}
              />;
  }
  return (
    <>
    <AppShell>
      <div className="py-2 md:py-5 space-y-6">
        <AnnouncementsCarousel />
        <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
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
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción iniciará una solicitud de pago no vinculada a un Número de Entrada (NE) específico. Se generará un ID único en su lugar.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleOpenPaymentRequest}>Sí, continuar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="lg" variant="default" className="h-12 text-md">
                                    <Edit className="mr-2 h-5 w-5" />Crear Registro
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Tipo de Documento</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href="/executive/worksheet">
                                            <FilePlus className="mr-2 h-4 w-4" /> Hoja de Trabajo
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/executive/corporate-report">
                                            <Briefcase className="mr-2 h-4 w-4" /> Reporte Consignatario
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/executive/anexos?type=anexo_5">
                                            <StickyNote className="mr-2 h-4 w-4" /> Anexo 5
                                        </Link>
                                    </DropdownMenuItem>
                                     <DropdownMenuItem asChild>
                                         <Link href="/executive/anexos?type=anexo_7">
                                            <StickyNote className="mr-2 h-4 w-4" /> Anexo 7
                                         </Link>
                                     </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                        </div>
                    </div>
                    <div className="border-t pt-4 mt-2">
                       <TabsList>
                            <TabsTrigger value="worksheets">Hojas de Trabajo</TabsTrigger>
                            <TabsTrigger value="anexos">Anexos</TabsTrigger>
                            <TabsTrigger value="corporate">Reportes Corporativos</TabsTrigger>
                        </TabsList>
                    </div>
                </CardHeader>
                 <CardContent>
                    {/* Filtering UI - Common for all tabs */}
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
                                      <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={facturadoFilter.noFacturado} onCheckedChange={(checked) => setFacturadoFilter(f => ({...f, noFacturado: !!checked}))}/>No Facturados</label>
                                      <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={facturadoFilter.facturado} onCheckedChange={(checked) => setFacturadoFilter(f => ({...f, facturado: !!checked}))}/>Facturados</label>
                                    </div>
                                    <div className="grid gap-2 mt-2 pt-2 border-t">
                                      <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={acuseFilter.sinAcuse} onCheckedChange={(checked) => setAcuseFilter(f => ({...f, sinAcuse: !!checked}))}/>Sin Acuse</label>
                                      <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={acuseFilter.conAcuse} onCheckedChange={(checked) => setAcuseFilter(f => ({...f, conAcuse: !!checked}))}/>Con Acuse</label>
                                    </div>
                                     <div className="grid gap-2 mt-2 pt-2 border-t">
                                      <label className="flex items-center gap-2 text-sm font-normal text-amber-600"><Checkbox checked={preliquidationFilter} onCheckedChange={(checked) => setPreliquidationFilter(!!checked)}/>Pendiente Preliquidación</label>
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
                    
                    <TabsContent value="worksheets" className="mt-6">{renderTable()}</TabsContent>
                    <TabsContent value="anexos" className="mt-6">{renderTable()}</TabsContent>
                    <TabsContent value="corporate" className="mt-6">{renderTable()}</TabsContent>
                </CardContent>
            </Card>
        </Tabs>
      </div>
    </AppShell>
    {selectedCaseForDocs && (<ManageDocumentsModal isOpen={!!selectedCaseForDocs} onClose={() => setSelectedCaseForDocs(null)} caseData={selectedCaseForDocs} />)}
    {selectedCaseForHistory && (<AforoCaseHistoryModal isOpen={!!selectedCaseForHistory} onClose={() => setSelectedCaseForHistory(null)} caseData={selectedCaseForHistory} />)}
    {selectedCaseForIncident && (<IncidentReportModal isOpen={!!selectedCaseForIncident} onClose={() => setSelectedCaseForIncident(null)} caseData={selectedCaseForIncident} />)}
    {selectedCaseForValueDoubt && (<ValueDoubtModal isOpen={!!selectedCaseForValueDoubt} onClose={() => setSelectedCaseForValueDoubt(null)} caseData={selectedCaseForValueDoubt} />)}
    {selectedCaseForComment && (<ExecutiveCommentModal isOpen={!!selectedCaseForComment} onClose={() => setSelectedCaseForComment(null)} caseData={selectedCaseForComment} />)}
    {selectedCaseForQuickRequest && (<QuickRequestModal isOpen={!!selectedCaseForQuickRequest} onClose={() => setSelectedCaseForQuickRequest(null)} caseWithWorksheet={selectedCaseForQuickRequest} />)}
    {selectedCaseForPayment && (<PaymentRequestModal isOpen={!!selectedCaseForPayment} onClose={() => setSelectedCaseForPayment(null)} caseData={selectedCaseForPayment} />)}
    {isRequestPaymentModalOpen && (<PaymentRequestModal isOpen={isRequestPaymentModalOpen} onClose={() => setIsRequestPaymentModalOpen(false)} caseData={null} />)}
    {selectedCaseForPaymentList && (<PaymentListModal isOpen={!!selectedCaseForPaymentList} onClose={() => setSelectedCaseForPaymentList(null)} caseData={selectedCaseForPaymentList} />)}
    {selectedCaseForResa && (<ResaNotificationModal isOpen={!!selectedCaseForResa} onClose={() => setSelectedCaseForResa(null)} caseData={selectedCaseForResa} />)}
    {caseToAssignAforador && (
        <AssignUserModal
            isOpen={!!caseToAssignAforador}
            onClose={() => setCaseToAssignAforador(null)}
            caseData={caseToAssignAforador}
            assignableUsers={assignableUsers}
            onAssign={handleAssignAforador}
            title="Asignar Aforador (PSMT)"
            description={`Como el consignatario es PSMT, debe asignar un aforador para el caso NE: ${caseToAssignAforador.ne}.`}
        />
     )}
     {selectedCaseForViewIncidents && (
        <ViewIncidentsModal
            isOpen={!!selectedCaseForViewIncidents}
            onClose={() => setSelectedCaseForViewIncidents(null)}
            onSelectRectificacion={() => {
                setSelectedIncidentForDetails(selectedCaseForViewIncidents);
                setSelectedCaseForViewIncidents(null);
            }}
            onSelectDudaValor={() => {
                setSelectedCaseForValueDoubt(selectedCaseForViewIncidents);
                setSelectedCaseForViewIncidents(null);
            }}
        />
     )}
     {selectedCaseForProcess && (
        <StatusProcessModal 
            isOpen={!!selectedCaseForProcess}
            onClose={() => setSelectedCaseForProcess(null)}
            caseData={selectedCaseForProcess}
        />
     )}
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
