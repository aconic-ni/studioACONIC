
"use client";
import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, updateDoc, writeBatch, addDoc, getDocs, collectionGroup, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Worksheet, AforoCase, WorksheetWithCase, AforoCaseUpdate, AppUser, SolicitudRecord } from '@/types';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';

// Component Imports
import { ExecutiveFilters } from '@/components/executive/ExecutiveFilters';
import { ExecutiveCasesTable } from '@/components/executive/ExecutiveCasesTable';
import { AnnouncementsCarousel } from '@/components/executive/AnnouncementsCarousel';
import { AforoCaseHistoryModal } from '@/components/reporter/AforoCaseHistoryModal';
import { IncidentReportModal } from '@/components/reporter/IncidentReportModal';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { ValueDoubtModal } from '@/components/executive/ValueDoubtModal';
import { WorksheetDetailModal } from '@/components/reporter/WorksheetDetailModal';
import { ExecutiveCommentModal } from '@/components/executive/ExecutiveCommentModal';
import { QuickRequestModal } from '@/components/executive/QuickRequestModal';
import { PaymentRequestModal } from '@/components/executive/PaymentRequestModal';
import { PaymentListModal } from '@/components/executive/PaymentListModal';
import { ResaNotificationModal } from '@/components/executive/ResaNotificationModal';
import { AssignUserModal } from '@/components/reporter/AssignUserModal';
import { ViewIncidentsModal } from '@/components/executive/ViewIncidentsModal';
import { StatusProcessModal } from '@/components/executive/StatusProcessModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '@/context/AppContext';

type DateFilterType = 'range' | 'month' | 'today';
type TabValue = 'worksheets' | 'anexos' | 'corporate';

function ExecutivePageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setInitialContextData, caseToAssignAforador, setCaseToAssignAforador } = useAppContext();

  // Data state
  const [allCases, setAllCases] = useState<WorksheetWithCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  
  // Modal state
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
    deathkey: false,
  });
  const [isRequestPaymentModalOpen, setIsRequestPaymentModalOpen] = useState(false);
  const [duplicateAndRetireModalOpen, setDuplicateAndRetireModalOpen] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [facturadoFilter, setFacturadoFilter] = useState({ facturado: false, noFacturado: true });
  const [acuseFilter, setAcuseFilter] = useState({ conAcuse: false, sinAcuse: true });
  const [preliquidationFilter, setPreliquidationFilter] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [appliedFilters, setAppliedFilters] = useState({ searchTerm: '', facturado: false, noFacturado: true, conAcuse: false, sinAcuse: true, preliquidation: false, dateFilterType: 'range' as DateFilterType, dateRange: undefined as DateRange | undefined, isSearchActive: false });
  
  // Column filter state
  const [columnFilters, setColumnFilters] = useState({
      ne: '', ejecutivo: '', consignatario: '', factura: '', selectividad: '', incidentType: ''
  });

  // UI State
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  const [pinInput, setPinInput] = useState('');
  const [newNeForDuplicate, setNewNeForDuplicate] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchHint, setSearchHint] = useState<{ foundIn: TabValue; label: string } | null>(null);

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
  
  const getIncidentTypeDisplay = (c: AforoCase) => {
    const types = [];
    if (c.incidentType === 'Rectificacion') types.push('Rectificación');
    if (c.hasValueDoubt) types.push('Duda de Valor');
    return types.length > 0 ? types.join(' / ') : 'N/A';
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
    if (appliedFilters.preliquidation) finalFiltered = finalFiltered.filter(c => { const aforoData = (c as any).aforo || c; return aforoData.revisorStatus === 'Aprobado' && aforoData.preliquidationStatus !== 'Aprobada'; });
    if (appliedFilters.dateRange?.from) {
        const start = startOfDay(appliedFilters.dateRange.from);
        const end = appliedFilters.dateRange.to ? endOfDay(appliedFilters.dateRange.to) : endOfDay(start);
        finalFiltered = finalFiltered.filter(item => item.createdAt?.toDate() >= start && item.createdAt?.toDate() <= end);
    }
    
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

    return finalFiltered.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  }, [allCases, appliedFilters, activeTab, columnFilters]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = appliedFilters.isSearchActive ? filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : filteredCases;
  
  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

  return (
    <>
      <AppShell>
        <div className="py-2 md:py-5 space-y-6">
          <AnnouncementsCarousel />
          <ExecutiveFilters
            activeTab={activeTab}
            onTabChange={handleTabChange}
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
            clearFilters={() => { setSearchTerm(''); setFacturadoFilter({ facturado: false, noFacturado: true }); setAcuseFilter({ conAcuse: false, sinAcuse: true }); setPreliquidationFilter(false); setDateRangeInput(undefined); setColumnFilters({ ne: '', ejecutivo: '', consignatario: '', factura: '', selectividad: '', incidentType: ''}); setAppliedFilters({ searchTerm: '', facturado: false, noFacturado: true, conAcuse: false, sinAcuse: true, preliquidation: false, dateFilterType: 'range', dateRange: undefined, isSearchActive: false }); setCurrentPage(1); setSearchHint(null);}}
          />

          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredCases.length > 0 ? (
                <ExecutiveCasesTable
                  cases={paginatedCases}
                  savingState={savingState}
                  onAutoSave={handleAutoSave}
                  approvePreliquidation={(id) => handleAutoSave(id, 'preliquidationStatus', 'Aprobada')}
                  caseActions={ { handleViewWorksheet: (c: AforoCase) => setModalState(prev => ({...prev, worksheet: c.worksheet as Worksheet})), setSelectedCaseForQuickRequest: (c: WorksheetWithCase) => setModalState(prev => ({...prev, quickRequest: c})), setSelectedCaseForPayment: (c: AforoCase) => setModalState(prev => ({...prev, payment: c})), setSelectedCaseForPaymentList: (c: AforoCase) => setModalState(prev => ({...prev, paymentList: c})), setSelectedCaseForResa: (c: AforoCase) => setModalState(prev => ({...prev, resa: c})), setSelectedCaseForIncident: (c: AforoCase) => setModalState(prev => ({...prev, incident: c})), setSelectedCaseForValueDoubt: (c: AforoCase) => setModalState(prev => ({...prev, valueDoubt: c})), setSelectedCaseForHistory: (c: AforoCase) => setModalState(prev => ({...prev, history: c})), setSelectedIncidentForDetails: (c: AforoCase) => setModalState(prev => ({...prev, incidentDetails: c})), setSelectedCaseForComment: (c: AforoCase) => setModalState(prev => ({...prev, comment: c})), handleSearchPrevio: (ne: string) => router.push(`/database?ne=${ne}`), setCaseToArchive: (c: WorksheetWithCase) => setModalState(prev => ({...prev, archive: c})), setDuplicateAndRetireModalOpen: setDuplicateAndRetireModalOpen, setCaseToDuplicate: (c: WorksheetWithCase) => setModalState(prev => ({...prev, duplicate: c})), setSelectedCaseForProcess: (c: AforoCase) => setModalState(prev => ({...prev, process: c})), }}
                  selectedRows={selectedRows}
                  onSelectRow={(ids) => setSelectedRows(ids)}
                  onSelectAllRows={() => { const selectableIds = filteredCases.filter(c => ((c as any).aforo || c).revisorStatus === 'Aprobado' && ((c as any).aforo || c).preliquidationStatus !== 'Aprobada').map(c => c.id); if (selectedRows.length === selectableIds.length) { setSelectedRows([]); } else { setSelectedRows(selectableIds); } }}
                  columnFilters={columnFilters}
                  setColumnFilters={setColumnFilters}
                  handleSendToFacturacion={(id) => { if (!user || !user.displayName) return; setSavingState(prev => ({...prev, [id]: true})); updateDoc(doc(db, 'AforoCases', id), { facturacionStatus: 'Enviado a Facturacion', enviadoAFacturacionAt: Timestamp.now(), facturadorAsignado: 'Alvaro Gonzalez', facturadorAsignadoAt: Timestamp.now() }).then(() => toast({ title: 'Enviado a Facturación' })).catch(() => toast({title: 'Error'})).finally(()=> setSavingState(prev => ({...prev, [id]: false})))}}
                />
              ) : (
                <p className="text-muted-foreground text-center py-10">No se encontraron casos con los filtros actuales.</p>
              )}
               {appliedFilters.isSearchActive && filteredCases.length > itemsPerPage && (
                    <div className="flex items-center justify-between space-x-2 py-4">
                        <div className="text-sm text-muted-foreground"> {selectedRows.length} de {filteredCases.length} fila(s) seleccionadas. </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm"> Página {currentPage} de {totalPages} </span>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Anterior</Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Siguiente</Button>
                        </div>
                    </div>
                )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
      
      {/* Modals */}
      {modalState.history && (<AforoCaseHistoryModal isOpen={!!modalState.history} onClose={() => setModalState(p => ({...p, history: null}))} caseData={modalState.history} />)}
      {modalState.incident && (<IncidentReportModal isOpen={!!modalState.incident} onClose={() => setModalState(p => ({...p, incident: null}))} caseData={modalState.incident} />)}
      {modalState.valueDoubt && (<ValueDoubtModal isOpen={!!modalState.valueDoubt} onClose={() => setModalState(p => ({...p, valueDoubt: null}))} caseData={modalState.valueDoubt} />)}
      {modalState.incidentDetails && (<IncidentReportDetails caseData={modalState.incidentDetails} onClose={() => setModalState(p => ({...p, incidentDetails: null}))} />)}
      {modalState.worksheet && (<WorksheetDetailModal worksheet={modalState.worksheet} onClose={() => setModalState(p => ({...p, worksheet: null}))} isOpen={!!modalState.worksheet} />)}
      {modalState.comment && (<ExecutiveCommentModal isOpen={!!modalState.comment} onClose={() => setModalState(p => ({...p, comment: null}))} caseData={modalState.comment} />)}
      {modalState.quickRequest && (<QuickRequestModal isOpen={!!modalState.quickRequest} onClose={() => setModalState(p => ({...p, quickRequest: null}))} caseWithWorksheet={modalState.quickRequest} />)}
      {modalState.payment && (<PaymentRequestModal isOpen={!!modalState.payment} onClose={() => setModalState(p => ({...p, payment: null}))} caseData={modalState.payment} />)}
      {isRequestPaymentModalOpen && (<PaymentRequestModal isOpen={isRequestPaymentModalOpen} onClose={() => setIsRequestPaymentModalOpen(false)} caseData={null} />)}
      {modalState.paymentList && (<PaymentListModal isOpen={!!modalState.paymentList} onClose={() => setModalState(p => ({...p, paymentList: null}))} caseData={modalState.paymentList} />)}
      {modalState.resa && (<ResaNotificationModal isOpen={!!modalState.resa} onClose={() => setModalState(p => ({...p, resa: null}))} caseData={modalState.resa} />)}
      {caseToAssignAforador && (<AssignUserModal isOpen={!!caseToAssignAforador} onClose={() => setCaseToAssignAforador(null)} caseData={caseToAssignAforador} assignableUsers={assignableUsers} onAssign={(id, name) => { if (!user || !user.displayName) return; updateDoc(doc(db, 'AforoCases', id), { aforador: name, assignmentDate: Timestamp.now(), aforadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }}).then(()=>toast({title: 'Aforador Asignado'})).catch(()=>toast({title: 'Error'})); setCaseToAssignAforador(null); }} title="Asignar Aforador (PSMT)" description={`Como el consignatario es PSMT, debe asignar un aforador para el caso NE: ${caseToAssignAforador.ne}.`}/>)}
      {modalState.viewIncidents && (<ViewIncidentsModal isOpen={!!modalState.viewIncidents} onClose={() => setModalState(p => ({...p, viewIncidents: null}))} onSelectRectificacion={() => { setModalState(p => ({...p, incidentDetails: p.viewIncidents, viewIncidents: null})); }} onSelectDudaValor={() => { setModalState(p => ({...p, valueDoubt: p.viewIncidents, viewIncidents: null})); }} />)}
      {modalState.process && (<StatusProcessModal isOpen={!!modalState.process} onClose={() => setModalState(p => ({...p, process: null}))} caseData={modalState.process} />)}
      
      {/* Action Dialogs */}
      <AlertDialog open={!!modalState.archive} onOpenChange={(isOpen) => !isOpen && setModalState(p => ({...p, archive: null}))}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>¿Está seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción archivará el caso y no será visible en las listas principales.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleArchiveCase}>Sí, Archivar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={duplicateAndRetireModalOpen} onOpenChange={setDuplicateAndRetireModalOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Duplicar y Retirar Caso</DialogTitle><DialogDescription>Se creará un nuevo caso con un NE nuevo, y el caso original ({modalState.duplicate?.ne}) será retirado (archivado y marcado como trasladado).</DialogDescription></DialogHeader>
            <div className="py-4 space-y-4">
                <div><Label htmlFor="new-ne">Nuevo NE</Label><Input id="new-ne" value={newNeForDuplicate} onChange={e => setNewNeForDuplicate(e.target.value)} placeholder="Ingrese el nuevo NE" /></div>
                <div><Label htmlFor="reason">Motivo</Label><Textarea id="reason" value={duplicateReason} onChange={e => setDuplicateReason(e.target.value)} placeholder="Explique brevemente el motivo de la duplicación" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDuplicateAndRetireModalOpen(false)}>Cancelar</Button><Button onClick={()=>{if (modalState.duplicate) { const newNe = newNeForDuplicate.trim().toUpperCase(); if (!newNe || !duplicateReason) { toast({title:'Error', description:'Nuevo NE y motivo son requeridos', variant:'destructive'}); return; } setSavingState(p=>({...p, [modalState.duplicate!.id]: true})); const batch=writeBatch(db); const newCaseRef = doc(db,'AforoCases',newNe); const newWorksheetRef=doc(db,'worksheets',newNe); getDoc(newCaseRef).then(snap=>{if(snap.exists()){toast({title:'Error', description:'El nuevo NE ya existe'});return;const creationTimestamp=Timestamp.now();const createdByInfo={by:user!.displayName,at:creationTimestamp};const {id:oldId,ne:oldNe,createdAt:oldCreatedAt,lastUpdatedAt:oldLastUpdatedAt,...worksheetToCopy}=modalState.duplicate!.worksheet!;const newWorksheetData:Worksheet={...worksheetToCopy,id:newNe,ne:newNe,createdAt:creationTimestamp,createdBy:user!.email!,lastUpdatedAt:creationTimestamp};batch.set(newWorksheetRef,newWorksheetData);const newCaseData:Omit<AforoCase,'id'>={ne:newNe,executive:modalState.duplicate!.executive,consignee:modalState.duplicate!.consignee,facturaNumber:modalState.duplicate!.facturaNumber,declarationPattern:modalState.duplicate!.declarationPattern,merchandise:modalState.duplicate!.merchandise,createdBy:user!.uid,createdAt:creationTimestamp,aforador:'',assignmentDate:null,aforadorStatus:'Pendiente ',aforadorStatusLastUpdate:createdByInfo,revisorStatus:'Pendiente',revisorStatusLastUpdate:createdByInfo,preliquidationStatus:'Pendiente',preliquidationStatusLastUpdate:createdByInfo,digitacionStatus:'Pendiente',digitacionStatusLastUpdate:createdByInfo,incidentStatus:'Pendiente',incidentStatusLastUpdate:createdByInfo,revisorAsignado:'',revisorAsignadoLastUpdate:createdByInfo,digitadorAsignado:'',digitadorAsignadoLastUpdate:createdByInfo,worksheetId:newNe,entregadoAforoAt:null,isArchived:false,executiveComments:[{id:uuidv4(),author:user!.displayName!,text:`Duplicado del NE: ${modalState.duplicate!.ne}. Motivo: ${duplicateReason}`,createdAt:creationTimestamp}]};batch.set(newCaseRef,newCaseData);batch.update(doc(db,'AforoCases',modalState.duplicate!.id),{digitacionStatus:'TRASLADADO',isArchived:true});const originalUpdatesRef=collection(db,'worksheets',modalState.duplicate!.id,'actualizaciones');const updateLog:AforoCaseUpdate={updatedAt:Timestamp.now(),updatedBy:user!.displayName!,field:'digitacionStatus',oldValue:modalState.duplicate!.digitacionStatus,newValue:'TRASLADADO',comment:`Caso trasladado al nuevo NE: ${newNe}. Motivo: ${duplicateReason}`};batch.set(doc(originalUpdatesRef),updateLog);const newUpdatesRef=collection(db,'worksheets',newNe,'actualizaciones');const newCaseLog:AforoCaseUpdate={updatedAt:creationTimestamp,updatedBy:user!.displayName!,field:'creation',oldValue:null,newValue:`duplicated_from_${modalState.duplicate!.ne}`,comment:`Caso duplicado desde ${modalState.duplicate!.ne}. Motivo: ${duplicateReason}`};batch.set(doc(newUpdatesRef),newCaseLog);batch.commit().then(()=>{toast({title:'Éxito'});setDuplicateAndRetireModalOpen(false);}).catch(e=>{toast({title:'Error',description:e.message})}).finally(()=>setSavingState(p=>({...p,[modalState.duplicate!.id]:false})))}})}} disabled={savingState[modalState.duplicate?.id || '']}>Duplicar y Retirar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={modalState.deathkey} onOpenChange={(isOpen) => setModalState(p => ({...p, deathkey: isOpen}))}>
        <DialogContent>
            <DialogHeader><DialogTitle>Confirmar Acción "Deathkey"</DialogTitle><DialogDescription>Esta acción reclasificará {selectedRows.length} caso(s) a "Reporte Corporativo", excluyéndolos de la lógica de Aforo. Es irreversible. Ingrese el PIN para confirmar.</DialogDescription></DialogHeader>
            <div className="py-4 space-y-2"><Label htmlFor="pin-input" className="flex items-center gap-2"><KeyRound/>PIN de Seguridad</Label><Input id="pin-input" type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN de 6 dígitos"/></div>
            <DialogFooter><Button variant="outline" onClick={() => setModalState(p => ({...p, deathkey: false}))}>Cancelar</Button><Button variant="destructive" onClick={()=>{if(pinInput!=='192438'){toast({title:'Error',variant:'destructive'});return;}if(selectedRows.length===0)return;setIsLoading(true);const batch=writeBatch(db);selectedRows.forEach(id=>{const item=allCases.find(c=>c.id===id);if(item&&item.worksheetId){const wsRef=doc(db,'worksheets',item.worksheetId);batch.update(wsRef,{worksheetType:'corporate_report'});const updatesRef=collection(wsRef,'actualizaciones');const log:AforoCaseUpdate={updatedAt:Timestamp.now(),updatedBy:user!.displayName!,field:'worksheetType',oldValue:'hoja_de_trabajo',newValue:'corporate_report',comment:'Caso reclasificado a Reporte Corporativo via Deathkey.'};batch.set(doc(updatesRef),log);}});batch.commit().then(()=>{toast({title:'Éxito'});setSelectedRows([]);setModalState(p=>({...p,deathkey:false}));setPinInput('');}).catch(e=>{toast({title:'Error',variant:'destructive'})}).finally(()=>setIsLoading(false));}} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirmar y Ejecutar</Button></DialogFooter>
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

```