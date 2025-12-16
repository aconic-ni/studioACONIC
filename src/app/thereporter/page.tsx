
"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, PartyPopper, PlusCircle, ChevronDown, Search, Download, Calendar, CalendarDays, CalendarRange, Filter, Send } from 'lucide-react';
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
import { collection, getDocs, query, where, collectionGroup, orderBy, writeBatch, doc, getDoc, Timestamp, onSnapshot, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadAforoReportAsExcel } from '@/lib/fileExporterAforo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
  const [allCases, setAllCases] = useState<WorksheetWithCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [neInput, setNeInput] = useState('');
  const [consigneeInput, setConsigneeInput] = useState('');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  
  const [appliedDbFilters, setAppliedDbFilters] = useState<{
    ne?: string;
    consignee?: string;
    dateRange?: DateRange;
    dateFilterType: DateFilterType;
  }>({
    dateFilterType: 'range',
  });
  
  const [isExporting, setIsExporting] = useState(false);

  const canCreateReport = user?.role === 'aforador' || user?.role === 'admin';
  const canSendToDigitization = user?.role === 'admin' || (user?.role === 'supervisor' && user?.roleTitle === 'PSMT');

  const fetchData = useCallback(() => {
    if (!user) return;
    setIsLoading(true);
    
    let qCases = query(collection(db, 'AforoCases'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(qCases, async (snapshot) => {
        const aforoCasesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        const worksheetIds = aforoCasesData.map(c => c.worksheetId).filter(Boolean) as string[];

        if (worksheetIds.length === 0) {
            setAllCases(aforoCasesData.map(c => ({...c, worksheet: null})));
            setIsLoading(false);
            return;
        }
        
        const worksheetPromises = [];
        for (let i = 0; i < worksheetIds.length; i += 30) {
            const chunk = worksheetIds.slice(i, i + 30);
            if(chunk.length > 0) {
                worksheetPromises.push(getDocs(query(collection(db, 'worksheets'), where(documentId(), 'in', chunk))));
            }
        }
        
        try {
            const worksheetSnapshots = await Promise.all(worksheetPromises);
            const worksheetsMap = new Map<string, Worksheet>();
            worksheetSnapshots.forEach(snap => snap.forEach(doc => worksheetsMap.set(doc.id, { id: doc.id, ...doc.data()} as Worksheet)));

            const combinedData = aforoCasesData.map(caseItem => ({
                ...caseItem,
                worksheet: worksheetsMap.get(caseItem.worksheetId || '') || null,
            }));
            
            setAllCases(combinedData);

        } catch (e) {
            console.error("Error fetching worksheets for cases:", e);
            setError("No se pudieron cargar los detalles de las hojas de trabajo.");
        } finally {
          setIsLoading(false);
        }
      },
      (error: any) => {
        console.error("Error fetching main aforo cases:", error);
        setError("Error al cargar los casos de aforo.");
        setIsLoading(false);
      }
    );
  
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const unsubscribe = fetchData();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [fetchData]);


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
    if (allCases.length === 0) {
        toast({ title: "No hay datos", description: "No hay casos en la tabla para exportar.", variant: "secondary" });
        return;
    };
    setIsExporting(true);

    try {
        const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];
        
        for (const caseItem of allCases) {
            const logsQuery = query(collection(db, 'AforoCases', caseItem.id, 'actualizaciones'), orderBy('updatedAt', 'asc'));
            const logSnapshot = await getDocs(logsQuery);
            logSnapshot.forEach(logDoc => {
                auditLogs.push({
                    ...(logDoc.data() as AforoCaseUpdate),
                    caseNe: caseItem.ne
                });
            });
        }
        
        await downloadAforoReportAsExcel(allCases, auditLogs);
        
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
        fetchData();

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
                                    <Button onClick={handleExport} disabled={allCases.length === 0 || isExporting}>
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
                           cases={allCases}
                           isLoading={isLoading}
                           error={error}
                           onRefresh={fetchData}
                        />
                    </TabsContent>
                    <TabsContent value="digitacion">
                        <DigitizationCasesTable 
                           cases={allCases}
                           isLoading={isLoading}
                           error={error}
                           onRefresh={fetchData}
                        />
                    </TabsContent>
                </CardContent>
            </Card>
        </Tabs>
      </div>

       {isAforoModalOpen && <AforoCaseModal isOpen={isAforoModalOpen} onClose={() => setIsAforoModalOpen(false)} />}
    </AppShell>
  );
}
