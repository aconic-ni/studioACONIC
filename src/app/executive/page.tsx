
"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FilePlus, Search, Edit, Eye, History, PlusSquare, UserCheck, Inbox, AlertTriangle, Download, ChevronsUpDown, Info, CheckCircle, CalendarRange, Calendar, CalendarDays, ShieldAlert, BookOpen, FileCheck2, MessageSquare, View, Banknote, Bell as BellIcon, RefreshCw, Send, StickyNote, Scale, Briefcase } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, updateDoc, writeBatch, addDoc, getDocs, collectionGroup } from 'firebase/firestore';
import type { Worksheet, AforoCase, AforadorStatus, AforoCaseStatus, DigitacionStatus, WorksheetWithCase, AforoCaseUpdate, PreliquidationStatus, IncidentType, LastUpdateInfo, ExecutiveComment, InitialDataContext, AppUser, SolicitudRecord, ExamDocument, FacturacionStatus } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, toDate, isSameDay, startOfDay, endOfDay, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { AforoCaseHistoryModal } from '@/components/reporter/AforoCaseHistoryModal';
import { IncidentReportModal } from '@/components/reporter/IncidentReportModal';
import { Badge } from '@/components/ui/badge';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { ManageDocumentsForm } from '@/components/executive/ManageDocumentsForm';
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
import { MobileCaseCard } from '@/components/executive/MobileCaseCard';
import { StatusBadges } from '@/components/executive/StatusBadges';
import { useAppContext } from '@/context/AppContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ViewIncidentsModal } from '@/components/executive/ViewIncidentsModal';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusProcessModal } from '@/components/executive/StatusProcessModal';


type DateFilterType = 'range' | 'month' | 'today';

const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, 'label': 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const formatDate = (date: Date | Timestamp | null | undefined, includeTime: boolean = true): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : toDate(date);
    const formatString = includeTime ? "dd/MM/yy HH:mm" : "dd/MM/yy";
    return format(d, formatString, { locale: es });
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


export default function ExecutivePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
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
  const [selectedCaseForDocs, setSelectedCaseForDocs] = useState<AforoCase | null>(null);
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



  const [searchTerm, setSearchTerm] = useState('');
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  
  // States for filter inputs
  const [facturadoFilter, setFacturadoFilter] = useState({ facturado: false, noFacturado: true });
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activeTab, setActiveTab] = useState('worksheets');


  // State for applied filters that trigger re-fetch
  const [appliedFilters, setAppliedFilters] = useState({
    searchTerm: '',
    facturado: false,
    noFacturado: true,
    dateFilterType: 'range' as DateFilterType,
    dateRange: undefined as DateRange | undefined,
  });
  
  const [neFilter, setNeFilter] = useState('');
  const [ejecutivoFilter, setEjecutivoFilter] = useState('');
  const [consignatarioFilter, setConsignatarioFilter] = useState('');
  const [facturaFilter, setFacturaFilter] = useState('');
  const [selectividadFilter, setSelectividadFilter] = useState('');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('');


  useEffect(() => {
    if (!authLoading && (!user || !['ejecutivo', 'coordinadora', 'admin', 'supervisor'].includes(user.role || ''))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

   const fetchCases = useCallback(async () => {
    if (!user) return () => {};
    setIsLoading(true);
    
    const globalVisibilityRoles = ['admin', 'supervisor'];
    const groupVisibilityRoles = ['ejecutivo', 'coordinadora'];
    let aforoQuery;

    if (user.role && globalVisibilityRoles.includes(user.role)) {
      aforoQuery = query(collection(db, 'AforoCases'));
    } else if (user.role && groupVisibilityRoles.includes(user.role)) {
      const groupDisplayNames = Array.from(new Set([user.displayName, ...(user.visibilityGroup?.map(m => m.displayName) || [])])).filter(Boolean) as string[];
             if (groupDisplayNames.length > 0) {
                aforoQuery = query(collection(db, 'AforoCases'), where("executive", "in", groupDisplayNames));
            } else {
                aforoQuery = query(collection(db, 'AforoCases'), where('executive', '==', user.displayName));
            }
    } else {
      aforoQuery = query(collection(db, 'AforoCases'), where('executive', '==', user.displayName));
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
            const updatesRef = collection(db, 'AforoCases', caseItem.id, 'actualizaciones');
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
    }
  
    const logRef = doc(collection(db, "adminAuditLog"));
    const logData = {
      collection: 'AforoCases/worksheets',
      docId: caseToArchive.id,
      adminId: user.uid,
      adminEmail: user.email,
      timestamp: serverTimestamp(),
      action: 'update',
      changes: [{ field: 'isArchived', oldValue: false, newValue: true }]
    };
    batch.set(logRef, logData);
  
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
        if (field === 'facturado' && value === true) {
            updateData.facturadoAt = Timestamp.now();
        }

        if (field.toLowerCase().includes('status')) {
          const lastUpdateField = `${''}${field}LastUpdate` as keyof AforoCase;
          updateData[lastUpdateField] = { by: user.displayName, at: Timestamp.now() }
        }

        batch.update(caseDocRef, updateData);

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
      dateFilterType: dateFilterType,
      dateRange: dateRange,
    });
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
            const casesWithDetails: (AforoCase & { dispatchCustoms?: string })[] = [];
            const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];

            for (const caseItem of filteredCases) {
                let caseDetails: AforoCase & { dispatchCustoms?: string } = { ...caseItem };

                if (caseItem.worksheetId) {
                    const wsDocRef = doc(db, 'worksheets', caseItem.worksheetId);
                    const wsSnap = await getDoc(wsDocRef);
                    if (wsSnap.exists()) {
                        caseDetails.dispatchCustoms = (wsSnap.data() as Worksheet).dispatchCustoms;
                    }
                }
                casesWithDetails.push(caseDetails);

                const logsQuery = query(collection(db, 'AforoCases', caseItem.id, 'actualizaciones'), orderBy('updatedAt', 'asc'));
                const logSnapshot = await getDocs(logsQuery);
                logSnapshot.forEach(logDoc => {
                    auditLogs.push({
                        ...(logDoc.data() as AforoCaseUpdate),
                        caseNe: caseItem.ne
                    });
                });
            }
            await downloadExecutiveReportAsExcel(casesWithDetails, auditLogs);
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
        setSelectedWorksheet(docSnap.data() as Worksheet);
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
    setDateRangeInput(undefined);
    setNeFilter('');
    setEjecutivoFilter('');
    setConsignatarioFilter('');
    setFacturaFilter('');
    setSelectividadFilter('');
    setIncidentTypeFilter('');
    setAppliedFilters({ searchTerm: '', facturado: false, noFacturado: true, dateFilterType: 'range', dateRange: undefined });
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
    let filtered = allCases;
    
    if (activeTab === 'worksheets') {
      filtered = filtered.filter(c => c.worksheet?.worksheetType === 'hoja_de_trabajo' || c.worksheet?.worksheetType === undefined);
    } else if (activeTab === 'anexos') {
      filtered = filtered.filter(c => c.worksheet?.worksheetType === 'anexo_5' || c.worksheet?.worksheetType === 'anexo_7');
    } else if (activeTab === 'corporate') {
      filtered = filtered.filter(c => c.worksheet?.worksheetType === 'corporate_report');
    }

    filtered = filtered.filter(c => !c.isArchived);
    
    if (appliedFilters.searchTerm) {
        filtered = filtered.filter(c =>
          c.ne.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
          c.consignee.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase())
        );
    }
    
    if (appliedFilters.noFacturado && !appliedFilters.facturado) {
        filtered = filtered.filter(c => !c.facturado);
    } else if (appliedFilters.facturado && !appliedFilters.noFacturado) {
        filtered = filtered.filter(c => c.facturado === true);
    }

    if (appliedFilters.dateFilterType === 'today') {
        const today = new Date();
        const todaysCases = new Map<string, WorksheetWithCase>();
        
        allCases.forEach(c => {
            if (c.createdAt && isSameDay(c.createdAt.toDate(), today)) {
                todaysCases.set(c.id, c);
            }
            if (!c.facturado) {
                todaysCases.set(c.id, c);
            }
            if (c.facturadoAt && isSameDay(c.facturadoAt.toDate(), today)) {
                todaysCases.set(c.id, c);
            }
        });
        filtered = Array.from(todaysCases.values()).filter(c => !c.isArchived);

    } else if (appliedFilters.dateRange?.from) {
        const start = startOfDay(appliedFilters.dateRange.from);
        const end = appliedFilters.dateRange.to ? endOfDay(appliedFilters.dateRange.to) : endOfDay(appliedFilters.dateRange.from);
        
        filtered = filtered.filter(c => {
            if (!c.createdAt) return false;
            const createdAtDate = c.createdAt.toDate();
            return createdAtDate >= start && createdAtDate <= end;
        });
    }

    // Apply column filters
    if (neFilter) filtered = filtered.filter(c => c.ne.toLowerCase().includes(neFilter.toLowerCase()));
    if (ejecutivoFilter) filtered = filtered.filter(c => c.executive.toLowerCase().includes(ejecutivoFilter.toLowerCase()));
    if (consignatarioFilter) filtered = filtered.filter(c => c.consignee.toLowerCase().includes(consignatarioFilter.toLowerCase()));
    if (facturaFilter) {
      const lowerCaseFilter = facturaFilter.toLowerCase();
      filtered = filtered.filter(c => {
        const facturas = c.worksheet?.worksheetType === 'corporate_report' 
          ? (c.worksheet.documents?.filter(d => d.type === 'FACTURA').map(d => d.number) || [])
          : (c.facturaNumber ? c.facturaNumber.split(';').map(f => f.trim()) : []);
        return facturas.some(f => f.toLowerCase().includes(lowerCaseFilter));
      });
    }
    if (selectividadFilter) filtered = filtered.filter(c => (c.selectividad || 'N/A').toLowerCase().includes(selectividadFilter.toLowerCase()));
    if (incidentTypeFilter) filtered = filtered.filter(c => getIncidentTypeDisplay(c).toLowerCase().includes(incidentTypeFilter.toLowerCase()));


    return filtered.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  }, [allCases, appliedFilters, activeTab, neFilter, ejecutivoFilter, consignatarioFilter, facturaFilter, selectividadFilter, incidentTypeFilter]);
  
  const getRevisorStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) { case 'Aprobado': return 'default'; case 'Rechazado': return 'destructive'; case 'Revalidación Solicitada': return 'secondary'; default: return 'outline'; }
  };
  const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) { case 'En revisión': return 'default'; case 'Incompleto': return 'destructive'; case 'En proceso': return 'secondary'; case 'Pendiente': return 'destructive'; default: return 'outline'; }
  };
  const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Trámite Completo') { return <Badge variant="default" className="bg-green-600">{declaracion || 'Finalizado'}</Badge> }
    if (status) { return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>; }
    return <Badge variant="outline">Pendiente</Badge>;
  }

  const approvePreliquidation = (caseId: string) => {
    handleAutoSave(caseId, 'preliquidationStatus', 'Aprobada');
  };
  
  const getPreliquidationStatusBadge = (status?: PreliquidationStatus) => {
    switch(status) {
      case 'Aprobada': return <Badge variant="default" className="bg-green-600">Aprobada</Badge>;
      default: return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  const getFacturacionStatusBadge = (status?: FacturacionStatus) => {
    switch(status) {
        case 'Enviado a Facturacion': return <Badge className="bg-blue-500 hover:bg-blue-600">Enviado</Badge>;
        case 'Facturado': return <Badge className="bg-green-600 hover:bg-green-700">Facturado</Badge>;
        default: return <Badge variant="outline">Pendiente</Badge>;
    }
  }
  
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

  if (authLoading || !user || !['ejecutivo', 'coordinadora', 'admin', 'supervisor'].includes(user.role || '')) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (selectedIncidentForDetails) {
    return (<AppShell><div className="py-2 md:py-5"><IncidentReportDetails caseData={selectedIncidentForDetails} onClose={() => setSelectedIncidentForDetails(null)} /></div></AppShell>);
  }
  if (selectedWorksheet) {
    return (<AppShell><div className="py-2 md:py-5"><WorksheetDetails worksheet={selectedWorksheet} onClose={() => setSelectedWorksheet(null)} /></div></AppShell>);
  }
  
  const caseActions = {
    handleViewWorksheet,
    setSelectedCaseForDocs: () => {}, // Placeholder, as ManageDocumentsModal is not used here
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
  };


  const renderTable = () => {
      if (isLoading) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      }
      if (filteredCases.length === 0) {
        return <p className="text-muted-foreground text-center py-10">No se encontraron casos con los filtros actuales.</p>
      }
      if (isMobile) {
        return (
          <div className="space-y-4">
              {filteredCases.map(c => (
                  <MobileCaseCard
                      key={c.id}
                      caseData={c}
                      savingState={savingState}
                      caseActions={caseActions}
                      onAutoSave={handleAutoSave}
                      approvePreliquidation={approvePreliquidation}
                  />
              ))}
          </div>
        );
      }
      return (
        <div className="overflow-x-auto table-container rounded-lg border">
            <TooltipProvider>
            <Table><TableHeader><TableRow>
                <TableHead>Acciones</TableHead>
                <TableHead><Input placeholder="NE..." className="h-8 text-xs" value={neFilter} onChange={e => setNeFilter(e.target.value)}/></TableHead>
                <TableHead>Insignias</TableHead>
                <TableHead><Input placeholder="Ejecutivo..." className="h-8 text-xs" value={ejecutivoFilter} onChange={e => setEjecutivoFilter(e.target.value)}/></TableHead>
                <TableHead><Input placeholder="Consignatario..." className="h-8 text-xs" value={consignatarioFilter} onChange={e => setConsignatarioFilter(e.target.value)}/></TableHead>
                <TableHead><Input placeholder="Factura..." className="h-8 text-xs" value={facturaFilter} onChange={e => setFacturaFilter(e.target.value)}/></TableHead>
                <TableHead>Estado General</TableHead>
                <TableHead>Preliquidación</TableHead>
                <TableHead><Input placeholder="Selectividad..." className="h-8 text-xs" value={selectividadFilter} onChange={e => setSelectividadFilter(e.target.value)}/></TableHead>
                <TableHead>Fecha Despacho</TableHead>
                <TableHead><Input placeholder="Incidencia..." className="h-8 text-xs" value={incidentTypeFilter} onChange={e => setIncidentTypeFilter(e.target.value)}/></TableHead>
                <TableHead>Facturado</TableHead>
            </TableRow></TableHeader>
            <TableBody>
                {filteredCases.map(c => {
                    const facturas = c.worksheet?.worksheetType === 'corporate_report' 
                        ? (c.worksheet.documents?.filter(d => d.type === 'FACTURA').map(d => d.number) || [])
                        : (c.facturaNumber ? c.facturaNumber.split(';').map(f => f.trim()) : []);

                    const firstFactura = facturas[0] || '';
                    const remainingFacturasCount = facturas.length > 1 ? facturas.length - 1 : 0;
                    const isPsmt = c.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA";
                    const daysUntilDue = c.resaDueDate ? differenceInDays(c.resaDueDate.toDate(), new Date()) : null;
                    const isResaCritical = daysUntilDue !== null && daysUntilDue < -15;

                    return (
                    <TableRow key={c.id} className={savingState[c.id] ? "bg-amber-100" : (isResaCritical ? "bg-red-200 hover:bg-red-200/80" : "")}>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">Ver</Button></DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleViewWorksheet(c)} disabled={!c.worksheetId}>
                                    <BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/managerpermisos?id=${c.id}`}>
                                    <FilePlus className="mr-2 h-4 w-4" /> Docs y Permisos
                                  </Link>
                                 </DropdownMenuItem> 
                                 <DropdownMenuItem onSelect={() => handleSearchPrevio(c.ne)}>
                                    <Search className="mr-2 h-4 w-4" /> Buscar Previo
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSelectedCaseForDocs(c)} disabled={!c}>
                                    <FilePlus className="mr-2 h-4 w-4" /> Docs y Permisos
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSelectedCaseForQuickRequest(c)} disabled={!c.worksheet}>
                                    <FilePlus className="mr-2 h-4 w-4" /> Solicitar Previo
                                </DropdownMenuItem>
                                 <DropdownMenuItem onSelect={() => setSelectedCaseForPayment(c)} disabled={!c}>
                                    <Banknote className="mr-2 h-4 w-4" /> Solicitud de Pago
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSelectedCaseForPaymentList(c)} disabled={!c}>
                                    <Banknote className="mr-2 h-4 w-4 text-blue-500" /> Ver Pagos
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSelectedCaseForResa(c)} disabled={!c}>
                                    <BellIcon className="mr-2 h-4 w-4 text-orange-500" /> Notificar RESA
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setSelectedCaseForIncident(c)} disabled={!c}>
                                    <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSelectedCaseForValueDoubt(c)} disabled={!c}>
                                    <ShieldAlert className="mr-2 h-4 w-4 text-rose-600" /> Reportar Duda de Valor
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setSelectedCaseForHistory(c)} disabled={!c}><History className="mr-2 h-4 w-4" /> Ver Bitácora</DropdownMenuItem>
                                {c.incidentReported && (<DropdownMenuItem onSelect={() => handleViewIncidents(c)}><Eye className="mr-2 h-4 w-4" /> Ver Incidencia</DropdownMenuItem>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCaseForComment(c)}>
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Añadir/Ver Comentarios</p></TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{c.ne}</TableCell>
                        <TableCell>
                            <StatusBadges caseData={c} />
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1">
                                <span>{c.executive}</span>
                                <LastUpdateTooltip lastUpdate={{ by: c.executive, at: c.createdAt }} caseCreation={c.createdAt} />
                            </div>
                        </TableCell>
                        <TableCell>
                        {c.consignee.length > 13 ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1 cursor-help">
                                            {`${c.consignee.substring(0, 13)}...`}
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{c.consignee}</p></TooltipContent>
                                </Tooltip>
                            ) : ( c.consignee )}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <span>{firstFactura}</span>
                                {remainingFacturasCount > 0 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="secondary" className="cursor-pointer">
                                                +{remainingFacturasCount}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <ul className="list-disc list-inside">
                                                {facturas.slice(1).map((f, i) => <li key={i}>{f}</li>)}
                                            </ul>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" onClick={() => setSelectedCaseForProcess(c)}>Revisar Proceso</Button>
                                <Badge variant={getRevisorStatusBadgeVariant(c.revisorStatus)}>{c.revisorStatus === 'Aprobado' ? 'Aprobado Revisor' : c.revisorStatus || 'Pendiente'}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {c.revisorStatus === 'Aprobado' && c.preliquidationStatus !== 'Aprobada' ? (
                                <Button size="sm" onClick={() => approvePreliquidation(c.id)} disabled={savingState[c.id]}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                                </Button>
                            ) : (
                                getPreliquidationStatusBadge(c.preliquidationStatus)
                            )}
                            <LastUpdateTooltip lastUpdate={c.preliquidationStatusLastUpdate} caseCreation={c.createdAt} />
                          </div>
                        </TableCell>
                         <TableCell>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={c.selectividad || ''}
                                    onValueChange={(value) => handleAutoSave(c.id, 'selectividad', value)}
                                    disabled={savingState[c.id] || !c.declaracionAduanera}
                                >
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VERDE">VERDE</SelectItem>
                                        <SelectItem value="AMARILLO">AMARILLO</SelectItem>
                                        <SelectItem value="ROJO">ROJO</SelectItem>
                                    </SelectContent>
                                </Select>
                                {c.selectividad === 'AMARILLO' && (
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Badge variant="secondary" className="cursor-help"><Info className="h-4 w-4" /></Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>CONSULTA DE VALORES</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div>
                                            <DatePickerWithTime
                                                date={(c.fechaDespacho as Timestamp)?.toDate()}
                                                onDateChange={(d) => handleAutoSave(c.id, 'fechaDespacho', d ? Timestamp.fromDate(d) : null)}
                                                disabled={savingState[c.id] || (c.selectividad !== 'VERDE' && c.selectividad !== 'ROJO')}
                                            />
                                        </div>
                                    </TooltipTrigger>
                                    {(c.selectividad !== 'VERDE' && c.selectividad !== 'ROJO') && (
                                        <TooltipContent>
                                            <p>Debe seleccionar un estado de selectividad (Verde o Rojo) antes de registrar el despacho.</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getIncidentTypeDisplay(c)}
                            <LastUpdateTooltip lastUpdate={c.incidentStatusLastUpdate} caseCreation={c.createdAt}/>
                          </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center justify-center">
                                {isPsmt ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="inline-block">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleSendToFacturacion(c.id)}
                                                    disabled={savingState[c.id] || !c.fechaDespacho || c.facturacionStatus === 'Facturado'}
                                                >
                                                    <Send className="mr-2 h-4 w-4" />
                                                    {c.facturacionStatus === 'Enviado a Facturacion' ? 'Re-enviar' : 'Enviar'}
                                                </Button>
                                            </div>
                                        </TooltipTrigger>
                                         {!c.fechaDespacho && (
                                            <TooltipContent><p>Debe ingresar la fecha de despacho primero.</p></TooltipContent>
                                        )}
                                    </Tooltip>
                                ) : (
                                    <Switch
                                        checked={!!c.facturado}
                                        onCheckedChange={(checked) => handleAutoSave(c.id, 'facturado', checked)}
                                        disabled={savingState[c.id]}
                                    />
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                )})}
            </TableBody></Table>
            </TooltipProvider>
        </div>
      );
  }

  return (
    <>
    <AppShell>
      <div className="py-2 md:py-5 space-y-6">
        <AnnouncementsCarousel />
        <Tabs defaultValue="worksheets" className="w-full" onValueChange={setActiveTab}>
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
    {selectedCaseForDocs && (<ManageDocumentsForm caseData={selectedCaseForDocs} onClose={() => setSelectedCaseForDocsModal(null)} />)}
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
