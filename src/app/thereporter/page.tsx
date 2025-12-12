
"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, PartyPopper, PlusCircle, ChevronDown, Search, Download, Calendar, CalendarDays, CalendarRange, Filter, Send, KeyRound } from 'lucide-react';
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
import { collection, getDocs, query, where, collectionGroup, orderBy, writeBatch, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadAforoReportAsExcel } from '@/lib/fileExporterAforo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfMonth, endOfMonth, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';


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
  const isMobile = useIsMobile();
  const [isAforoModalOpen, setIsAforoModalOpen] = useState(false);
  
  // State for filter inputs
  const [neInput, setNeInput] = useState('');
  const [consigneeInput, setConsigneeInput] = useState('');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  
  // State for applied filters that trigger re-fetch
  const [appliedDbFilters, setAppliedDbFilters] = useState<{
    ne?: string;
    consignee?: string;
    dateRange?: DateRange;
    dateFilterType: DateFilterType;
  }>({
    dateFilterType: 'range',
  });

  const [allFetchedCases, setAllFetchedCases] = useState<WorksheetWithCase[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingToDigitization, setIsSendingToDigitization] = useState(false);


  const canCreateReport = user?.role === 'aforador' || user?.role === 'admin';
  const canSendToDigitization = user?.role === 'admin' || (user?.role === 'supervisor' && user?.roleTitle === 'PSMT');


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


  const filteredCases = useMemo(() => {
    let filtered = allFetchedCases;

    if (showPendingOnly) {
      return allFetchedCases.filter(c => !c.declaracionAduanera);
    }
    
    return filtered;

  }, [allFetchedCases, showPendingOnly]);

  const handleExport = async () => {
    if (filteredCases.length === 0) {
        toast({ title: "No hay datos", description: "No hay casos en la tabla para exportar.", variant: "secondary" });
        return;
    };
    setIsExporting(true);

    try {
        const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];
        
        for (const caseItem of filteredCases) {
            const logsQuery = query(collection(db, 'AforoCases', caseItem.id, 'actualizaciones'), orderBy('updatedAt', 'asc'));
            const logSnapshot = await getDocs(logsQuery);
            logSnapshot.forEach(logDoc => {
                auditLogs.push({
                    ...(logDoc.data() as AforoCaseUpdate),
                    caseNe: caseItem.ne
                });
            });
        }
        
        await downloadAforoReportAsExcel(filteredCases, auditLogs);
        
    } catch (e) {
        console.error("Error exporting data with audit logs: ", e);
        toast({ title: "Error de Exportación", description: "No se pudieron obtener todos los registros de auditoría.", variant: "destructive" });
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
                                    <Button onClick={handleExport} disabled={filteredCases.length === 0 || isExporting}>
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
                           filters={appliedDbFilters} 
                           setAllFetchedCases={setAllFetchedCases}
                           displayCases={filteredCases}
                        />
                    </TabsContent>
                    <TabsContent value="digitacion">
                        <DigitizationCasesTable 
                           filters={appliedDbFilters}
                           setAllFetchedCases={setAllFetchedCases}
                           displayCases={filteredCases}
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
