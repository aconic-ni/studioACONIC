
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
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, updateDoc, writeBatch, addDoc, getDocs, collectionGroup, serverTimestamp, setDoc, limit, startAfter, endBefore, limitToLast } from 'firebase/firestore';
import type { Worksheet, worksheet, AforadorStatus, no existeStatus, DigitacionStatus, WorksheetWithCase, AforoUpdate, PreliquidationStatus, IncidentType, LastUpdateInfo, ExecutiveComment, InitialDataContext, AppUser, SolicitudRecord, ExamDocument, FacturacionStatus } from '@/types';
import { format, toDate, isSameDay, startOfDay, endOfDay, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import type { DateRange } from 'react-day-picker';
import { ExecutiveCommentModal } from '@/components/executive/ExecutiveCommentModal';
import { QuickRequestModal } from '@/components/executive/QuickRequestModal';
import { PaymentRequestModal } from '@/components/executive/PaymentRequestModal';
import { PaymentListModal } from '@/components/executive/PaymentListModal';
import { AnnouncementsCarousel } from '@/components/executive/AnnouncementsCarousel';
import { AssignUserModal } from '@/components/reporter/AssignUserModal';
import { ResaNotificationModal } from '@/components/executive/ResaNotificationModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppContext } from '@/context/AppContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ViewIncidentsModal } from '@/components/executive/ViewIncidentsModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusProcessModal } from '@/components/executive/StatusProcessModal';
import { Textarea } from '@/components/ui/textarea';
import { ExecutiveCasesTable } from '@/components/executive/ExecutiveCasesTable';
import { ExecutiveFilters } from '@/components/executive/ExecutiveFilters';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PaymentRequestFlow } from '@/components/examinerPay/InitialDataForm';
import { PaginationControls } from '@/components/shared/PaginationControls';

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

const ITEMS_PER_PAGE = 20;

function ExecutivePageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isPaymentRequestFlowOpen, closePaymentRequestFlow, setInitialContextData, setIsMemorandumMode, caseToAssignAforador, setCaseToAssignAforador } = useAppContext();
  
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
  }>({ history: null, incident: null, valueDoubt: null, incidentDetails: null, worksheet: null, comment: null, quickRequest: null, payment: null, paymentList: null, resa: null, viewIncidents: null, process: null, archive: null, });
  
  const [caseToDuplicate, setCaseToDuplicate] = useState<WorksheetWithCase | null>(null);
  const [isRequestPaymentModalOpen, setIsRequestPaymentModalOpen] = useState(false);
  const [duplicateAndRetireModalOpen, setDuplicateAndRetireModalOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  
  const [newNeForDuplicate, setNewNeForDuplicate] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  
  const [isDeathkeyModalOpen, setIsDeathkeyModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [columnFilters, setColumnFilters] = useState({ ne: '', ejecutivo: '', consignatario: '', factura: '', selectividad: '', incidentType: '' });
  
  const urlTab = searchParams.get('tab') as TabValue | null;
  const activeTab = urlTab || 'worksheets';

  const [searchHint, setSearchHint] = useState<{ foundIn: TabValue; label: string } | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // --- PAGINATION STATE ---
  const [pages, setPages] = useState<{[key: number]: WorksheetWithCase[]}>({});
  const [page, setPage] = useState(1);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [firstVisible, setFirstVisible] = useState<any>(null);
  const [isLastPage, setIsLastPage] = useState(false);


  const handleTabChange = (value: string) => {
    router.push(`/executive?tab=${value as TabValue}`, { scroll: false });
    setPage(1);
    setPages({});
    setLastVisible(null);
    setFirstVisible(null);
    setIsLastPage(false);
    setSearchHint(null);
  };
  
  const fetchCases = useCallback(async (pageNumber = 1, direction: 'next' | 'prev' | 'new' = 'new') => {
    if (!user) return;
    setIsLoading(true);

    if (direction === 'new') {
      setPages({});
      setLastVisible(null);
      setFirstVisible(null);
      setIsLastPage(false);
    }
    
    if (direction !== 'new' && pages[pageNumber]) {
        setIsLoading(false);
        return;
    }

    const worksheetTypeFilters: ('hoja_de_trabajo' | 'anexo_5' | 'anexo_7' | 'corporate_report' | undefined)[] = [];
    if(activeTab === 'worksheets') worksheetTypeFilters.push('hoja_de_trabajo', undefined);
    if(activeTab === 'anexos') worksheetTypeFilters.push('anexo_5', 'anexo_7');
    if(activeTab === 'corporate') worksheetTypeFilters.push('corporate_report');

    let q = query(collection(db, 'worksheets'), where('worksheetType', 'in', worksheetTypeFilters), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));

    if (direction === 'next' && lastVisible) {
        q = query(collection(db, 'worksheets'), where('worksheetType', 'in', worksheetTypeFilters), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && firstVisible) {
        q = query(collection(db, 'worksheets'), where('worksheetType', 'in', worksheetTypeFilters), orderBy('createdAt'), startAfter(firstVisible), limit(ITEMS_PER_PAGE));
    }


    try {
        const wsSnapshot = await getDocs(q);
        
        if (direction === 'prev') {
            wsSnapshot.docs.reverse(); // Since we queried backwards
        }

        const newLastVisible = wsSnapshot.docs[wsSnapshot.docs.length - 1];
        const newFirstVisible = wsSnapshot.docs[0];

        const worksheetIds = wsSnapshot.docs.map(doc => doc.id);
        const aforoMetadataMap = new Map<string, AforoData>();

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
        
        const combinedData = wsSnapshot.docs.map(doc => {
            const wsData = { id: doc.id, ...doc.data() } as Worksheet;
            const aforoData = aforoMetadataMap.get(doc.id) || null;
            return {
                ...wsData,
                ...aforoData,
                id: doc.id,
                worksheet: wsData,
                aforo: aforoData,
            } as WorksheetWithCase;
        });

        setPages(prev => ({...prev, [pageNumber]: combinedData }));
        setLastVisible(newLastVisible);
        setFirstVisible(newFirstVisible);
        setIsLastPage(wsSnapshot.docs.length < ITEMS_PER_PAGE);

    } catch (error) {
        console.error("Error fetching cases:", error);
        toast({ title: "Error de Carga", description: "No se pudieron cargar los datos de los casos.", variant: "destructive" });
    } finally {
        setIsLoading(false);
        setIsSearchLoading(false);
    }
}, [user, toast, activeTab, lastVisible, firstVisible, pages]);


  useEffect(() => {
    fetchCases(page, 'new');
  }, [activeTab]); // Refetch when tab changes


  // ... Other handlers ...

  const handleSearch = () => {
    setIsSearchLoading(true);
    // This is a simplified search that will search from all cases. A full implementation
    // would involve server-side search. For now, we'll fetch ALL and filter client side for search.
    // THIS IS NOT IDEAL FOR PERFORMANCE but matches the request for a robust filter.
    const fetchAllAndFilter = async () => {
      let all_q = query(collection(db, 'worksheets'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(all_q);
      const allDocs = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as WorksheetWithCase);
      // Now apply filters
      let filtered = allDocs.filter(c => c.ne.toLowerCase().includes(searchTerm.toLowerCase()));
      // ... apply other filters as well ...
      setPages({1: filtered.slice(0, ITEMS_PER_PAGE)});
      setPage(1);
      setIsLastPage(filtered.length <= ITEMS_PER_PAGE);
      setIsSearchLoading(false);
    }
    fetchAllAndFilter();
  };

  const handlePageChange = (newPage: number) => {
    const direction = newPage > page ? 'next' : 'prev';
    setPage(newPage);
    if (!pages[newPage]) {
      fetchCases(newPage, direction);
    }
  };


  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Usuario';

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
                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={()=>{}}>Sí, continuar</AlertDialogAction></AlertDialogFooter>
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
                                  <Input placeholder="Buscar por NE o Consignatario..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                                </div>
                                <div className="flex items-center flex-wrap gap-4">
                                  <Button onClick={handleSearch} disabled={isSearchLoading}>
                                      {isSearchLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />} Buscar
                                  </Button>
                                  <Button variant="outline" onClick={() => fetchCases(1, 'new')}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
                                  </Button>
                                </div>
                           </div>
                        </div>

                        <TabsContent value="worksheets" className="mt-6">
                            {isLoading ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : <ExecutiveCasesTable cases={pages[page] || []} savingState={savingState} onAutoSave={()=>{}} approvePreliquidation={()=>{}} caseActions={{}} selectedRows={[]} onSelectRow={()=>{}} onSelectAllRows={()=>{}} columnFilters={columnFilters} setColumnFilters={setColumnFilters} handleSendToFacturacion={()=>{}} onSearch={handleSearch} getIncidentTypeDisplay={() => ''} />}
                        </TabsContent>
                        <TabsContent value="anexos" className="mt-6">
                           {isLoading ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : <ExecutiveCasesTable cases={pages[page] || []} savingState={savingState} onAutoSave={()=>{}} approvePreliquidation={()=>{}} caseActions={{}} selectedRows={[]} onSelectRow={()=>{}} onSelectAllRows={()=>{}} columnFilters={columnFilters} setColumnFilters={setColumnFilters} handleSendToFacturacion={()=>{}} onSearch={handleSearch} getIncidentTypeDisplay={() => ''} />}
                        </TabsContent>
                        <TabsContent value="corporate" className="mt-6">
                            {isLoading ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : <ExecutiveCasesTable cases={pages[page] || []} savingState={savingState} onAutoSave={()=>{}} approvePreliquidation={()=>{}} caseActions={{}} selectedRows={[]} onSelectRow={()=>{}} onSelectAllRows={()=>{}} columnFilters={columnFilters} setColumnFilters={setColumnFilters} handleSendToFacturacion={()=>{}} onSearch={handleSearch} getIncidentTypeDisplay={() => ''} />}
                        </TabsContent>
                    </Tabs>
                    <PaginationControls
                      currentPage={page}
                      isLastPage={isLastPage}
                      onPageChange={handlePageChange}
                    />
                </CardContent>
            </Card>
        </div>
      </AppShell>
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

