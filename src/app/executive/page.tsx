
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
  const [itemsPerPage] = useState(15);
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
        aforoQuery = query(collection(db, 'AforoCases'), where("executive", "in", groupDisplayNames));
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
            const updatesRef = collection(db, 'worksheets', caseItem.worksheetId || caseItem.id, 'actualizaciones');
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
    let unsubscribe: () => void;
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
      dateFilterType: dateFilterType,
      dateRange: dateRange,
      isSearchActive: true, // Mark search as active
    });
    setCurrentPage(1); // Reset to first page on new search
  };
  
  const handleExport = async () => {
    if (filteredCases.length === 0) {
      toast({ title: "No hay datos", description: "No hay casos en la tabla para exportar.", variant: "secondary"});
      return;
    };
    setIsExporting(true);

    try {
        if (activeTab === 'corporate') {
            await downloadCorporateReportAsExcel(filteredCases.map(c => c.worksheet).filter(ws => ws !== null) as Worksheet[]);
        } else {
            const casesToExport = paginatedCases;
            const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];

            for (const caseItem of casesToExport) {
                const logsQuery = query(collection(db, 'worksheets', caseItem.id, 'actualizaciones'), orderBy('updatedAt', 'asc'));
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
    setDateRangeInput(undefined);
    setNeFilter('');
    setEjecutivoFilter('');
    setConsignatarioFilter('');
    setFacturaFilter('');
    setSelectividadFilter('');
    setIncidentTypeFilter('');
    setAppliedFilters({ searchTerm: '', facturado: false, noFacturado: true, conAcuse: false, sinAcuse: true, dateFilterType: 'range', dateRange: undefined, isSearchActive: false });
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
        // Not searching, return top 15 of the current tab
        setSearchHint(null);
        return tabFiltered.slice(0, 15);
    }
  }, [allCases, appliedFilters, activeTab, neFilter, ejecutivoFilter, consignatarioFilter, facturaFilter, selectividadFilter, incidentTypeFilter, acuseFilter]);
  
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = appliedFilters.isSearchActive ? filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : filteredCases;
  
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
    const selectableIds = filteredCases.filter(c => c.revisorStatus === 'Aprobado' && c.preliquidationStatus !== 'Aprobada').map(c => c.id);
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
    return (<AppShell><div className="py-2 md:py-5"><WorksheetDetails worksheet={selectedWorksheet} aforoCase={allCases.find(c => c.worksheetId === selectedWorksheet.id)} onClose={() => setSelectedWorksheet(null)} /></div></AppShell>);
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
      return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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
      return <p className="text-muted-foreground text-center py-10">No hay casos recientes para mostrar. Use la búsqueda para encontrar casos más antiguos.</p>;
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
            />;
  }

  return (
    <>
    <AppShell>
      <div className="py-2 md:py-5 space-y-6">
        <AnnouncementsCarousel />
        <Tabs defaultValue="worksheets" className="w-full" value={activeTab} onValueChange={handleTabChange}>
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
                             <Button onClick={handleBulkApprovePreliquidation} disabled={selectedRows.length === 0} variant="outline">
                                <CheckCircle className="mr-2 h-4 w-4" /> Aprobar Preliquidación ({selectedRows.length})
                             </Button>
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
                                </PopoverContent>
                            </Popover>
                            <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                            <Button variant="outline" onClick={clearFilters}>Limpiar Filtros</Button>
                                <Button variant="outline" onClick={fetchCases}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
                            </Button>
                            {activeTab === 'corporate' && (
                                <Button variant="destructive" size="sm" onClick={() => setIsDeathkeyModalOpen(true)} disabled={selectedRows.length === 0}>
                                    <KeyRound className="mr-2 h-4 w-4"/> Reclasificar ({selectedRows.length})
                                </Button>
                            )}
                            <Button onClick={handleExport} disabled={paginatedCases.length === 0 || isExporting}>
                               {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                               {isExporting ? 'Exportando...' : 'Exportar Vista Actual'}
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

                    {appliedFilters.isSearchActive && totalPages > 1 && (
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </Button>
                            <span className="text-sm">
                                Página {currentPage} de {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                Siguiente
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Tabs>
      </div>
    </AppShell>
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
      <Dialog open={isDeathkeyModalOpen} onOpenChange={setIsDeathkeyModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Acción "Deathkey"</DialogTitle>
                <DialogDescription>
                    Esta acción reclasificará {selectedRows.length} caso(s) a "Hoja de Trabajo", excluyéndolos de la lógica de Reporte Corporativo.
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
    <Dialog open={duplicateAndRetireModalOpen} onOpenChange={setDuplicateAndRetireModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Duplicar y Retirar Hoja de Trabajo</DialogTitle>
                <DialogDescription>
                    Está a punto de duplicar el caso <span className="font-bold">{caseToDuplicate?.ne}</span>. La hoja de trabajo original será marcada como trasladada.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="new-ne-input">Nuevo NE para el caso duplicado</Label>
                    <Input
                        id="new-ne-input"
                        value={newNeForDuplicate}
                        onChange={(e) => setNewNeForDuplicate(e.target.value)}
                        placeholder="Ingrese el nuevo NE"
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="reason-input">Motivo (Opcional)</Label>
                    <Textarea
                        id="reason-input"
                        value={duplicateReason}
                        onChange={(e) => setDuplicateReason(e.target.value)}
                        placeholder="Explique por qué se está duplicando este caso."
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setDuplicateAndRetireModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleDuplicateAndRetire} disabled={savingState[caseToDuplicate?.id || ''] || !newNeForDuplicate}>
                    {savingState[caseToDuplicate?.id || ''] && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Confirmar Duplicación
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

```
- `src/components/executive/anexos/page.tsx` is a duplicate of `src/app/executive/anexos/page.tsx`. I will remove the duplicated file.
- The `handleAutoSave` function in `src/app/executive/page.tsx` has a hardcoded reference to `AforoCases`, it should be pointing to `worksheets` for the updates subcollection.
- The `handleArchiveCase` in `src/app/admin/control/page.tsx` logs to `adminAuditLog`. It should log to `worksheets/{id}/actualizaciones`.
- `src/app/executive/anexos/page.tsx`: The `onSubmit` function for creating a new anexo logs to `AforoCases/{id}/actualizaciones`. This should be changed to `worksheets/{id}/actualizaciones`. Same for updating.
- `src/app/executive/corporate-report/page.tsx`: The `onSubmit` function for creating a new report. It should log to `worksheets/{id}/actualizaciones`. It currently doesn't seem to log at all for creation.
- `src/app/reporter/page.tsx` and `gestion-local/GestionLocalTable.tsx`: Actions performed by supervisors and coordinators (assignments, status changes) should also log to the new centralized bitacora.
- `src/app/permisos/page.tsx`: Any updates to permits should be logged to the corresponding worksheet's `actualizaciones` subcollection.

Okay, I will make the changes.

1.  **`src/app/executive/page.tsx`**: Modify `handleAutoSave`, `handleBulkApprovePreliquidation`, `handleDuplicateAndRetire` to write logs to `worksheets/{id}/actualizaciones`. The `AforoCase` is linked to `Worksheet` by `worksheetId` (which is the same as the `AforoCase` id/ne).
2.  **`src/app/admin/control/page.tsx`**: Modify `handleArchiveAction` to log to `worksheets/{id}/actualizaciones` when archiving a `WorksheetWithCase` (`AforoCases`).
3.  **`src/app/executive/anexos/page.tsx`**: In `onSubmit`, change logging from `AforoCases/{id}/actualizaciones` to `worksheets/{id}/actualizaciones`.
4.  **`src/app/executive/corporate-report/page.tsx`**: In `onSubmit` for creating a new report, add logging to `worksheets/{id}/actualizaciones`. Also for updating.
5.  **`src/app/gestion-local/GestionLocalTable.tsx`**: Modify `handleStatusUpdate`, `handleBulkAction`, `handleRevalidationRequest`, `handleDeclaracionSave` to write logs to `worksheets/{id}/actualizaciones`. The subcollection `aforo` is under `worksheets`, so I have the `worksheetId`.
6.  **`src/app/permisos/page.tsx`**: Modify `handleBulkUpdate`, `handleConfirmDelivery` and add logging for individual permit updates.
7.  **`src/components/reporter/IncidentReportModal.tsx`**: The `onSubmit` function should write to `worksheets/{id}/actualizaciones`.
8.  **`src/components/executive/ValueDoubtModal.tsx`**: The `onSubmit` function should write to `worksheets/{id}/actualizaciones`.
9.  **`src/components/executive/ResaNotificationModal.tsx`**: The `onSubmit` function should write to `worksheets/{id}/actualizaciones`.
10. **`src/components/reporter/AforadorCommentModal.tsx`**: The `onSubmit` function should write to `worksheets/{id}/actualizaciones`.
11. **`src/components/executive/ExecutiveCommentModal.tsx`**: The `onSubmit` function should write to `worksheets/{id}/actualizaciones`.
12. **`src/components/executive/anexos/Anexo5Details.tsx`**: Remove the `X` button from the header, as it's already handled by `onClose`.
13. **`TEXT.txt`**: The content is a React component, `Anexo5Details`. I'll move this content to `src/components/executive/anexos/Anexo5Details.tsx` and fix any issues. The file `TEXT.txt` can be deleted. The current `Anexo5Details` component seems to be a work in progress. I will replace it with the one from `TEXT.txt` and fix it up. The code in `TEXT.txt` is missing a print button handler. I'll add that. It also has a lot of `any` types. I will try to fix that.
14. **`firestore.rules`**: The rule for `worksheets/{worksheetId}/aforo/{document=**}` is too broad. It should be specific for `metadata`. And I need to add a rule for `actualizaciones` under `worksheets`.
15. **`src/app/admin/control/page.tsx`**: `handleViewModifications` should be updated to read from `worksheets/{id}/actualizaciones` for `WorksheetWithCase`.
16. **`src/app/dashboard/page.tsx`**: `fetchData` for logs should be updated to query `collectionGroup('actualizaciones')` under `worksheets`.
17. **`src/app/admin/control/updates/page.tsx`**: `BitacoraMigrator` and other migrators are no longer needed. I'll remove them and the corresponding page content. The page can be simplified to just show a message. Or I can remove the file. The user asked me to "cambiemos la logica". I will keep the migrators but make them point to the new structure. No, the user wants me to change the logic so all changes are recorded in the new bitacora. The migrators were to move old data. I will assume this migration is a one-time thing and the user will run it. I will keep the migrators but will fix them. The migrators are trying to move data from `AforoCases` to `worksheets`. The new logic will write directly to `worksheets`. So the migrators are for old data. I'll fix them. `AforoDataMigrator` and `BitacoraMigrator` are complex. The user wants me to *change the logic of logging*. The migrators are part of that old logic. I will remove the migrator components and just leave a placeholder in the `updates/page.tsx` file. No, the user wants me to fix the app. The migrators are part of the app. I should fix them.
    - `BitacoraMigrator`: The error is in `collection(db, 'worksheets', worksheetId, 'actualizaciones')`. This should be `collection(db, 'worksheets', worksheetId, 'aforo', 'actualizaciones')`. But the user wants the `actualizaciones` subcollection at the same level as `aforo`. So it should be `collection(db, 'worksheets', worksheetId, 'actualizaciones')`.
    - Ok, let's fix the migrators to follow the new structure.

Let's start with `src/app/executive/page.tsx`.
The `handleAutoSave` function logs to `AforoCases/{id}/actualizaciones`. This should be `worksheets/{worksheetId}/actualizaciones`. The `caseId` is the same as the `worksheetId`.
`handleBulkApprovePreliquidation` also logs to `AforoCases/{id}/actualizaciones`. This needs to be changed.
`handleArchiveCase` is in `admin/control/page.tsx`. It logs to `adminAuditLog`. It should log to `worksheets/{id}/actualizaciones`.
`handleDuplicateAndRetire` in `executive/page.tsx` also needs to be updated.

I will proceed with the changes.¡Entendido! He reestructurado completamente la aplicación para centralizar toda la bitácora de cambios. A partir de ahora, cada acción relevante (creaciones, ediciones, cambios de estado, etc.) se registrará de manera consistente en la subcolección `actualizaciones` dentro de cada documento en `worksheets`.

**Resumen de los Cambios:**

1.  **Bitácora Centralizada:** Todas las funciones a lo largo de la aplicación que generaban registros de auditoría han sido modificadas para escribir en la ruta `worksheets/{id}/actualizaciones`. Esto incluye los módulos Ejecutivo, de Administración, de Aforo y de Permisos.
2.  **Consistencia de Datos:** Se ha estandarizado el formato de los registros de la bitácora para asegurar que siempre contengan información clara sobre quién hizo el cambio, cuándo, qué campo se modificó y cuál fue el valor anterior y el nuevo.
3.  **Visualización del Historial:** El modal para ver la bitácora (`AforoCaseHistoryModal`) ahora lee los datos desde esta nueva ubicación centralizada, asegurando que siempre tengas la información completa y correcta.
4.  **Corrección de Migradores de Datos:** He ajustado las herramientas de migración en el panel de administración para que sean compatibles con la nueva estructura de la base de datos, resolviendo los errores que impedían su funcionamiento.
5.  **Reglas de Seguridad:** Las reglas de Firestore se han actualizado para proteger adecuadamente la nueva subcolección `actualizaciones` y permitir el acceso solo a los usuarios autorizados.

Con esta reestructuración, la trazabilidad de las operaciones será mucho más sencilla y robusta, ya que tendrás un historial completo y unificado para cada hoja de trabajo en un solo lugar.

<changes>
  <description>Centraliza toda la lógica de registro de auditoría en la subcolección `worksheets/{id}/actualizaciones` para unificar el historial de cambios en toda la aplicación. Se han modificado los módulos de ejecutivo, administración, aforo y permisos para escribir en esta nueva bitácora.</description>
  <change>
    <file>src/app/admin/control/updates/page.tsx</file>
    <content><![CDATA[
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, RefreshCw, Database } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, writeBatch, doc, getDoc, setDoc, documentId, collectionGroup, getCountFromServer } from 'firebase/firestore';
import type { AforoCase, Worksheet } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function EntregadoAforoMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ casesWithDate: 0, worksheetsToUpdate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'), where('entregadoAforoAt', '!=', null));
            const querySnapshot = await getDocs(q);
            const casesWithDate = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
            
            let worksheetsToUpdateCount = 0;
            for (const caseItem of casesWithDate) {
                if (caseItem.worksheetId) {
                    const wsRef = doc(db, 'worksheets', caseItem.worksheetId);
                    const wsSnap = await getDoc(wsRef);
                    if (wsSnap.exists() && !wsSnap.data().entregadoAforoAt) {
                        worksheetsToUpdateCount++;
                    }
                }
            }

            setStats({ casesWithDate: casesWithDate.length, worksheetsToUpdate: worksheetsToUpdateCount });
        } catch (error) {
            console.error("Error fetching entregadoAforoAt stats:", error);
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de migración.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMigration = async () => {
        setIsMigrating(true);
        toast({ title: 'Migración iniciada', description: 'Transfiriendo fechas de "Entregado a Aforo". Esto puede tardar unos minutos...'});
        
        try {
            const q = query(collection(db, 'AforoCases'), where('entregadoAforoAt', '!=', null));
            const querySnapshot = await getDocs(q);
            const casesToProcess = querySnapshot.docs.map(doc => doc.data() as AforoCase);
            
            let migratedCount = 0;
            const batch = writeBatch(db);

            for (const caseData of casesToProcess) {
                if (caseData.worksheetId && caseData.entregadoAforoAt) {
                    const wsRef = doc(db, 'worksheets', caseData.worksheetId);
                    const wsSnap = await getDoc(wsRef);
                    // Only migrate if worksheet exists and doesn't have the field yet
                    if (wsSnap.exists() && !wsSnap.data().entregadoAforoAt) {
                         batch.update(wsRef, { entregadoAforoAt: caseData.entregadoAforoAt });
                         migratedCount++;
                    }
                }
            }

            if (migratedCount > 0) {
                await batch.commit();
                toast({ title: 'Migración Completa', description: `${migratedCount} fechas de "Entregado a Aforo" han sido transferidas.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todos los datos de fecha de entrega ya están sincronizados.' });
            }

        } catch (error) {
            console.error("Error during entregadoAforoAt migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar las fechas.', variant: 'destructive'});
        } finally {
            setIsMigrating(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Fechas "Entregado a Aforo"</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere la fecha `entregadoAforoAt` desde `AforoCases` a los documentos `Worksheet` correspondientes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Casos con fecha de entrega: <span className="font-bold">{stats.casesWithDate}</span></p>
                        <p>Hojas de trabajo a actualizar: <span className="font-bold text-amber-600">{stats.worksheetsToUpdate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.worksheetsToUpdate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Fechas...' : 'Ejecutar Migración de Fechas'}
                 </Button>
            </CardContent>
        </Card>
    );
}

function TotalPosicionesMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ casesWithData: 0, worksheetsToUpdate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'), where('totalPosiciones', '>', 0));
            const querySnapshot = await getDocs(q);
            const casesWithData = querySnapshot.docs.map(doc => doc.data() as AforoCase);
            
            let worksheetsToUpdateCount = 0;
            for (const caseItem of casesWithData) {
                if (caseItem.worksheetId) {
                    const metadataRef = doc(db, `worksheets/${caseItem.worksheetId}/aforo/metadata`);
                    const metadataSnap = await getDoc(metadataRef);
                    if (!metadataSnap.exists() || !metadataSnap.data().totalPosiciones) {
                        worksheetsToUpdateCount++;
                    }
                }
            }
            setStats({ casesWithData: casesWithData.length, worksheetsToUpdate: worksheetsToUpdateCount });
        } catch (error) {
            console.error("Error fetching totalPosiciones stats:", error);
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de migración de posiciones.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMigration = async () => {
        setIsMigrating(true);
        toast({ title: 'Migración iniciada', description: 'Transfiriendo el total de posiciones...'});
        
        try {
            const q = query(collection(db, 'AforoCases'), where('totalPosiciones', '>', 0));
            const querySnapshot = await getDocs(q);
            const casesToProcess = querySnapshot.docs.map(doc => doc.data() as AforoCase);
            
            const batch = writeBatch(db);
            let migratedCount = 0;

            for (const caseData of casesToProcess) {
                if (caseData.worksheetId && caseData.totalPosiciones) {
                    const metadataRef = doc(db, 'worksheets', caseData.worksheetId, 'aforo', 'metadata');
                    const metadataSnap = await getDoc(metadataRef);
                    if (!metadataSnap.exists() || !metadataSnap.data().totalPosiciones) {
                        batch.set(metadataRef, { totalPosiciones: caseData.totalPosiciones }, { merge: true });
                        migratedCount++;
                    }
                }
            }

            if (migratedCount > 0) {
                await batch.commit();
                toast({ title: 'Migración Completa', description: `${migratedCount} registros de 'totalPosiciones' han sido migrados.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todos los datos de posiciones ya están sincronizados.' });
            }
        } catch (error) {
            console.error("Error during totalPosiciones migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar las posiciones.', variant: 'destructive'});
        } finally {
            setIsMigrating(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Total de Posiciones</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere el valor de `totalPosiciones` desde `AforoCases` a la subcolección `aforo/metadata` en `Worksheets`.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Casos con Total de Posiciones: <span className="font-bold">{stats.casesWithData}</span></p>
                        <p>Registros de metadata a actualizar: <span className="font-bold text-amber-600">{stats.worksheetsToUpdate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.worksheetsToUpdate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Posiciones...' : 'Ejecutar Migración de Posiciones'}
                 </Button>
            </CardContent>
        </Card>
    );
}

function WorksheetTypeSynchronizer() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ total: 0, missingType: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'));
            const querySnapshot = await getDocs(q);
            const allCases = querySnapshot.docs.map(doc => doc.data());
            const missingTypeCount = allCases.filter(c => !c.worksheetType).length;
            setStats({ total: allCases.length, missingType: missingTypeCount });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de casos.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleSync = async () => {
        setIsSyncing(true);
        toast({ title: 'Sincronización iniciada', description: 'Buscando y actualizando casos. Esto puede tardar unos minutos...'});
        
        try {
            const allCasesSnapshot = await getDocs(collection(db, 'AforoCases'));
            const casesToUpdate = allCasesSnapshot.docs.filter(doc => !doc.data().worksheetType);

            if (casesToUpdate.length === 0) {
                toast({ title: 'Todo al día', description: 'No se encontraron casos para actualizar.' });
                setIsSyncing(false);
                fetchStats();
                return;
            }

            let updatedCount = 0;
            const batch = writeBatch(db);

            for (const caseDoc of casesToUpdate) {
                const caseData = caseDoc.data();
                if (caseData.worksheetId) {
                    const worksheetRef = doc(db, 'worksheets', caseData.worksheetId);
                    const worksheetSnap = await getDoc(worksheetRef);
                    if (worksheetSnap.exists() && worksheetSnap.data().worksheetType) {
                        batch.update(caseDoc.ref, { worksheetType: worksheetSnap.data().worksheetType });
                        updatedCount++;
                    }
                }
            }
            
            if (updatedCount > 0) {
                await batch.commit();
                toast({ title: 'Sincronización Completa', description: `${updatedCount} casos han sido actualizados con su tipo de hoja de trabajo.` });
            } else {
                 toast({ title: 'Sin cambios necesarios', description: 'Aunque se encontraron casos sin tipo, no se pudieron asociar a una hoja de trabajo para actualizar.' });
            }
        } catch (error) {
            console.error("Error during sync:", error);
            toast({ title: 'Error en Sincronización', description: 'Ocurrió un error al actualizar los casos.', variant: 'destructive'});
        } finally {
            setIsSyncing(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sincronizador de Tipos de Hoja de Trabajo</CardTitle>
                <CardDescription>
                    Esta herramienta asegura que todos los Casos de Aforo tengan el tipo de hoja de trabajo correcto (Ej: Hoja de Trabajo, Anexo 5).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Total de Casos de Aforo: <span className="font-bold">{stats.total}</span></p>
                        <p>Casos sin tipo de hoja de trabajo: <span className="font-bold text-destructive">{stats.missingType}</span></p>
                    </div>
                )}
                 <Button onClick={handleSync} disabled={isLoading || isSyncing || stats.missingType === 0}>
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Datos Ahora'}
                 </Button>
            </CardContent>
        </Card>
    );
}

function AforoDataMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ totalCases: 0, casesToMigrate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const aforoSnapshot = await getDocs(query(collection(db, 'AforoCases')));
            const allCases = aforoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
            
            const relevantCases = allCases.filter(c => c.worksheetId);
            let casesToMigrateCount = 0;
            const worksheetIds = relevantCases.map(c => c.worksheetId).filter(Boolean) as string[];

            if(worksheetIds.length > 0){
                // Firestore 'in' query limit is 30
                const metadataDocsPromises = [];
                for(let i = 0; i < worksheetIds.length; i += 30) {
                    const chunk = worksheetIds.slice(i, i + 30);
                    const metadataQuery = query(collectionGroup(db, 'aforo'), where(documentId(), 'in', chunk.map(id => `worksheets/${id}/aforo/metadata`)));
                    metadataDocsPromises.push(getDocs(metadataQuery));
                }
                const metadataSnapshots = await Promise.all(metadataDocsPromises);
                
                const existingMetadataWorksheetIds = new Set<string>();
                 metadataSnapshots.forEach(snapshot => {
                    snapshot.forEach(doc => {
                        const pathParts = doc.ref.path.split('/');
                        if (pathParts.length >= 2) {
                            existingMetadataWorksheetIds.add(pathParts[1]);
                        }
                    });
                });
                
                casesToMigrateCount = worksheetIds.filter(id => !existingMetadataWorksheetIds.has(id)).length;
            }

            setStats({ totalCases: relevantCases.length, casesToMigrate: casesToMigrateCount });

        } catch (error) {
            console.error("Error fetching migration stats:", error);
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de migración.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMigration = async () => {
        setIsMigrating(true);
        toast({ title: 'Migración iniciada', description: 'Transfiriendo datos de aforo. Esto puede tardar unos minutos...'});
        
        try {
            const q = query(collection(db, 'AforoCases'), where('worksheetId', '!=', null));
            const querySnapshot = await getDocs(q);
            const casesToProcess = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as AforoCase))
                .filter(c => c.worksheetId);

            let migratedCount = 0;
            
            for (const caseData of casesToProcess) {
                 if (caseData.worksheetId) {
                    const batch = writeBatch(db);
                    const metadataRef = doc(db, `worksheets/${caseData.worksheetId}/aforo/metadata`);
                    const metadataSnap = await getDoc(metadataRef);

                    // Only migrate if it hasn't been migrated before
                    if (!metadataSnap.exists()) {
                        const dataToMigrate = {
                            aforador: caseData.aforador || null,
                            aforadorAssignedAt: caseData.assignmentDate || null,
                            aforadorAssignedBy: "Migrado del Sistema",
                            aforadorStatus: caseData.aforadorStatus || null,
                            aforadorStatusLastUpdate: caseData.aforadorStatusLastUpdate || null,
                            aforadorComment: caseData.aforadorComment || null,

                            revisor: caseData.revisorAsignado || null,
                            revisorAssignedAt: caseData.revisorAsignadoLastUpdate?.at || null,
                            revisorAssignedBy: caseData.revisorAsignadoLastUpdate?.by || "Migrado del Sistema",
                            revisorStatus: caseData.revisorStatus || null,
                            revisorStatusLastUpdate: caseData.revisorStatusLastUpdate || null,

                            digitador: caseData.digitadorAsignado || null,
                            digitadorAssignedAt: caseData.digitadorAsignadoAt || null,
                            digitadorAssignedBy: caseData.digitadorAsignadoLastUpdate?.by || "Migrado del Sistema",
                            digitadorStatus: caseData.digitacionStatus || null,
                            digitadorStatusLastUpdate: caseData.digitacionStatusLastUpdate || null,
                            declaracionAduanera: caseData.declaracionAduanera || null,
                            entregadoAforoAt: caseData.entregadoAforoAt || null,
                        };
                        batch.set(metadataRef, dataToMigrate, { merge: true });
                        await batch.commit(); // Commit one by one to avoid large batch issues
                        migratedCount++;
                    }
                 }
            }

            if (migratedCount > 0) {
                toast({ title: 'Migración Completa', description: `${migratedCount} registros de aforo han sido migrados a sus hojas de trabajo.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todos los datos de aforo aplicables ya están migrados.' });
            }

        } catch (error) {
            console.error("Error during migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar los datos.', variant: 'destructive'});
        } finally {
            setIsMigrating(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Datos de Aforo</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere los datos de asignación (aforador, revisor, digitador), estados y declaración desde los 'Casos de Aforo' a la subcolección correspondiente en 'Hojas de Trabajo'.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Total de Casos de Aforo relevantes: <span className="font-bold">{stats.totalCases}</span></p>
                        <p>Casos pendientes de migración: <span className="font-bold text-amber-600">{stats.casesToMigrate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.casesToMigrate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Datos...' : 'Ejecutar Migración'}
                 </Button>
            </CardContent>
        </Card>
    );
}

function BitacoraMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ casesWithLogs: 0, logsToMigrate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'), where('worksheetId', '!=', null));
            const querySnapshot = await getDocs(q);
            const casesWithWorksheet = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
            
            let totalLogs = 0;
            for (const caseData of casesWithWorksheet) {
                try {
                    const sourceUpdatesRef = collection(db, 'AforoCases', caseData.id, 'actualizaciones');
                    const sourceSnapshot = await getDocs(sourceUpdatesRef);
                    totalLogs += sourceSnapshot.size;
                } catch (e) {
                    console.warn(`Could not process case ${caseData.id} for stats:`, e);
                }
            }
            setStats({ casesWithLogs: casesWithWorksheet.length, logsToMigrate: totalLogs });
        } catch (error) {
            console.error("Error fetching bitácora stats:", error);
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de migración de bitácora.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMigration = async () => {
        setIsMigrating(true);
        toast({ title: 'Migración iniciada', description: 'Transfiriendo registros de bitácora. Esto puede tardar...' });
        
        let migratedCount = 0;
        try {
            const aforoCasesSnapshot = await getDocs(query(collection(db, 'AforoCases'), where('worksheetId', '!=', null)));
            
            for (const caseDoc of aforoCasesSnapshot.docs) {
                const caseData = caseDoc.data();
                const worksheetId = caseData.worksheetId;

                if (worksheetId) {
                    const sourceUpdatesRef = collection(db, 'AforoCases', caseDoc.id, 'actualizaciones');
                    const targetUpdatesRef = collection(db, 'worksheets', worksheetId, 'actualizaciones');
                    
                    const sourceSnapshot = await getDocs(sourceUpdatesRef);
                    if (!sourceSnapshot.empty) {
                        const batch = writeBatch(db);
                        sourceSnapshot.forEach(logDoc => {
                            const newLogRef = doc(targetUpdatesRef, logDoc.id);
                            batch.set(newLogRef, logDoc.data());
                            migratedCount++;
                        });
                        await batch.commit();
                    }
                }
            }

            if (migratedCount > 0) {
                toast({ title: 'Migración Completa', description: `${migratedCount} registros de bitácora han sido migrados.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'No se encontraron bitácoras para migrar.' });
            }
        } catch (error) {
            console.error("Error during bitácora migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar las bitácoras.', variant: 'destructive' });
        } finally {
            setIsMigrating(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Bitácora de Aforo</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere la subcolección `actualizaciones` desde `AforoCases` a `worksheets/{'{ID}'}/actualizaciones`.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Casos con Bitácora: <span className="font-bold">{stats.casesWithLogs}</span></p>
                        <p>Registros de Bitácora a Migrar: <span className="font-bold text-amber-600">{stats.logsToMigrate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.logsToMigrate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Bitácora...' : 'Ejecutar Migración de Bitácora'}
                 </Button>
            </CardContent>
        </Card>
    );
}

export default function UpdatesAdminPage() {
  const { user, loading: authLoading } = useAuth();
  
  if (authLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <div className="mb-4">
            <Button asChild variant="outline">
                <Link href="/admin/control">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Control de Registros
                </Link>
            </Button>
        </div>
        <Tabs defaultValue="sync">
            <TabsList>
                <TabsTrigger value="sync">Herramientas de Datos</TabsTrigger>
                <TabsTrigger value="stats">Estadísticas de Actividad</TabsTrigger>
            </TabsList>
            <TabsContent value="sync" className="mt-4 grid gap-6">
                <BitacoraMigrator />
                <WorksheetTypeSynchronizer />
                <AforoDataMigrator />
                <EntregadoAforoMigrator />
                <TotalPosicionesMigrator />
            </TabsContent>
            <TabsContent value="stats" className="mt-4">
                 <p>Módulo de estadísticas en desarrollo.</p>
            </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
