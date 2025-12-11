
"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { DatePicker } from '@/components/reports/DatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Search, Eye, Calendar, CalendarRange, Sparkles, MessageSquare, User, ChevronsUpDown } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import type { ExamDocument, AppUser } from '@/types';
import type { DateRange } from 'react-day-picker';
import { downloadExcelFile } from '@/lib/fileExporter';
import { FetchedExamDetails } from '@/components/database/FetchedExamDetails';
import { Badge } from '@/components/ui/badge';
import { BitacoraModal } from '@/components/database/BitacoraModal';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { startOfMonth, endOfMonth, format } from 'date-fns';

type SearchMode = 'range' | 'specific' | 'month' | 'gestor';

const months = [
    { value: 0, label: 'Enero' },
    { value: 1, label: 'Febrero' },
    { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Mayo' },
    { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' },
    { value: 10, label: 'Noviembre' },
    { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [specificDate, setSpecificDate] = useState<Date | undefined>();
  const [searchMode, setSearchMode] = useState<SearchMode>('range');
  
  const [exams, setExams] = useState<ExamDocument[]>([]);
  const [allExams, setAllExams] = useState<ExamDocument[]>([]); // Store all exams
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamDocument | null>(null);
  const [selectedBitacoraExamId, setSelectedBitacoraExamId] = useState<string | null>(null);

  // New states for month and gestor search
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [gestores, setGestores] = useState<string[]>([]);
  const [selectedGestor, setSelectedGestor] = useState<string | undefined>();
  const [popoverOpen, setPopoverOpen] = useState(false);
  
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "examenesPrevios"), orderBy("ne"));
      const querySnapshot = await getDocs(q);
      
      const fetchedExams = querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as ExamDocument));
      
      const activeExams = fetchedExams.filter(exam => exam.isArchived !== true);

      const examPromises = activeExams.map(async (examData) => {
        if (!examData.id) return { ...examData, commentCount: 0 };
        const commentsRef = collection(db, "examenesPrevios", examData.id, "comments");
        const commentsSnapshot = await getDocs(commentsRef);
        return { ...examData, commentCount: commentsSnapshot.size };
      });
      
      const fetchedExamsWithCounts = await Promise.all(examPromises);
      setAllExams(fetchedExamsWithCounts);
      setExams([]); 

      const gestorSet = new Set<string>();
      fetchedExamsWithCounts.forEach(exam => {
        if (exam.assignedTo) gestorSet.add(exam.assignedTo);
        if (exam.manager) gestorSet.add(exam.manager);
      });
      setGestores(Array.from(gestorSet).sort());


    } catch (err: any) {
      console.error("Error fetching reports from Firestore: ", err);
      let errorMessage = "Ocurrió un error al buscar los reportes. Inténtelo de nuevo.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
        router.push('/');
    } else if (user) {
        fetchInitialData();
    }
  }, [user, authLoading, router, fetchInitialData]);

  const filterExams = useCallback((start: Date, end: Date, gestor?: string) => {
    setError(null);
    
    let filtered = allExams.filter(exam => {
        const dateFields: (Timestamp | null | undefined)[] = [ exam.completedAt, exam.createdAt, exam.lastUpdated, exam.savedAt, exam.assignedAt, exam.requestedAt ];
        for (const dateField of dateFields) {
          if (dateField) {
            const examDate = dateField.toDate();
            if (examDate >= start && examDate <= end) {
              return true; // Include if any date falls within the range
            }
          }
        }
        return false;
    });

    if (gestor) {
        filtered = filtered.filter(exam => (exam.assignedTo === gestor || exam.manager === gestor));
    }
    
    filtered.sort((a, b) => {
        const dateA = a.completedAt || a.createdAt || a.lastUpdated || a.savedAt || a.assignedAt || a.requestedAt;
        const dateB = b.completedAt || b.createdAt || b.lastUpdated || b.savedAt || b.assignedAt || b.requestedAt;
        return (dateB?.toMillis() ?? 0) - (dateA?.toMillis() ?? 0);
    });

    setExams(filtered);
    if (filtered.length === 0) {
        setError("No se encontraron exámenes para los criterios de búsqueda seleccionados.");
    }
  }, [allExams]);


  const handleSearch = () => {
    setPopoverOpen(false); 
    if (searchMode === 'range') {
      if (!dateRange || !dateRange.from) {
        setError("Por favor, seleccione al menos una fecha de inicio.");
        return;
      }
      const endOfDay = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
      endOfDay.setHours(23, 59, 59, 999);
      filterExams(dateRange.from, endOfDay, selectedGestor);

    } else if (searchMode === 'specific') {
      if (!specificDate) {
        setError("Por favor, seleccione una fecha.");
        return;
      }
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);
      filterExams(startOfDay, endOfDay, selectedGestor);
    
    } else if (searchMode === 'month') {
      const start = startOfMonth(new Date(selectedYear, selectedMonth));
      const end = endOfMonth(new Date(selectedYear, selectedMonth));
      filterExams(start, end, selectedGestor);
    }
  };
  
  const handleExport = () => {
      if (exams.length > 0) {
          downloadExcelFile(exams[0]); // Export the first exam in the list as an example
          toast({
            title: "Exportación Iniciada",
            description: `Se está descargando el examen: ${exams[0].ne}. Para exportar otro, selecciónelo y descárguelo desde la vista de detalle.`,
          });
      } else {
          toast({
              title: "Sin Datos",
              description: "No hay datos para exportar. Realice una búsqueda primero.",
              variant: "default",
          });
      }
  }

  const handleViewDetails = (exam: ExamDocument) => setSelectedExam(exam);
  const handleCloseDetails = () => setSelectedExam(null);
  
  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return format(timestamp.toDate(), 'dd/MM/yy HH:mm', { locale: es });
  };


  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedExam) {
    return (
        <AppShell>
            <div className="py-2 md:py-5 w-full max-w-5xl mx-auto">
                 <FetchedExamDetails exam={selectedExam} onClose={handleCloseDetails} />
            </div>
        </AppShell>
    )
  }

  const isSearchDisabled = isLoading || (searchMode === 'range' && !dateRange?.from) || (searchMode === 'specific' && !specificDate);


  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-7xl mx-auto custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Reportes de Exámenes Previos</CardTitle>
            <CardDescription className="text-muted-foreground">
              Filtre los exámenes por fecha o gestor. La búsqueda mostrará todos los exámenes con alguna actividad (creado, asignado, guardado, completado) en el período seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant={searchMode === 'range' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('range')}><CalendarRange className="mr-2 h-4 w-4"/> Rango</Button>
                    <Button variant={searchMode === 'specific' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('specific')}><Calendar className="mr-2 h-4 w-4"/> Fecha</Button>
                    <Button variant={searchMode === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('month')}><Calendar className="mr-2 h-4 w-4"/> Mes</Button>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {searchMode === 'range' && <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
                  {searchMode === 'specific' && <DatePicker date={specificDate} onDateChange={setSpecificDate} />}
                  {searchMode === 'month' && (
                    <div className="flex gap-2">
                      <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mes" /></SelectTrigger>
                        <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                        <SelectTrigger className="w-[120px]"><SelectValue placeholder="Año" /></SelectTrigger>
                        <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                 <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-[250px] justify-between">
                         <User className="mr-2 h-4 w-4 opacity-50"/>
                         {selectedGestor || "Filtrar por gestor..."}
                         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0">
                        <div className="p-2">
                            <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => { setSelectedGestor(undefined); setPopoverOpen(false); }}>
                                Limpiar filtro
                            </Button>
                        </div>
                        {gestores.map(g => (
                            <Button key={g} variant="ghost" className="w-full justify-start" onClick={() => { setSelectedGestor(g); setPopoverOpen(false); }}>
                                {g}
                            </Button>
                        ))}
                    </PopoverContent>
                  </Popover>
                  <Button onClick={handleSearch} disabled={isSearchDisabled} className="btn-primary w-full sm:w-auto"><Search className="mr-2 h-4 w-4"/>{isLoading ? 'Buscando...' : 'Buscar'}</Button>
                  <Button onClick={handleExport} disabled={isLoading || exams.length === 0} variant="outline" className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4"/>Exportar</Button>
                </div>
            </div>

            {isLoading && (
              <div className="flex justify-center items-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary"/><p className="ml-3 text-muted-foreground">Cargando reportes...</p></div>
            )}
            {error && !isLoading && (
              <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">{error}</div>
            )}
            {!isLoading && exams.length > 0 && (
              <>
                <div className="mt-4 mb-2 text-sm text-muted-foreground">
                  Total de previos encontrados: <strong>{exams.length}</strong>
                </div>
                <div className="overflow-x-auto table-container rounded-lg border">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead>NE</TableHead>
                        <TableHead>Consignatario</TableHead>
                        <TableHead>Solicitado Por</TableHead>
                        <TableHead>Fecha Asignación</TableHead>
                        <TableHead>Asignado a</TableHead>
                        <TableHead>Inicio de Previo</TableHead>
                        <TableHead>Fin de Previo</TableHead>
                        <TableHead className="text-center">Productos</TableHead>
                        <TableHead className="text-center">Bitácora</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell className="font-medium">{exam.ne}</TableCell>
                          <TableCell>{exam.consignee}</TableCell>
                          <TableCell><Badge variant="outline">{exam.requestedBy ?? 'ana.estrada@aconic.com.ni'}</Badge></TableCell>
                          <TableCell>{formatTimestamp(exam.assignedAt ?? exam.savedAt)}</TableCell>
                          <TableCell>{(exam.assignedTo || exam.manager) ? <Badge variant="secondary">{exam.assignedTo || exam.manager}</Badge> : 'N/A'}</TableCell>
                          <TableCell>{formatTimestamp(exam.createdAt ?? exam.savedAt)}</TableCell>
                          <TableCell>{formatTimestamp(exam.completedAt ?? exam.savedAt)}</TableCell>
                          <TableCell className="text-center">{exam.products?.length || 0}</TableCell>
                          <TableCell className="text-center">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedBitacoraExamId(exam.id || null)}>
                                  <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                                  {exam.commentCount ?? 0}
                              </Button>
                          </TableCell>
                          <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDetails(exam)}><Eye className="mr-2 h-4 w-4"/> Ver</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
             {!isLoading && !error && exams.length === 0 && (
                <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">
                    Seleccione un modo de búsqueda y un criterio para generar un reporte.
                </div>
            )}
          </CardContent>
        </Card>
      </div>
      {selectedBitacoraExamId && (
          <BitacoraModal 
            isOpen={!!selectedBitacoraExamId} 
            onClose={() => setSelectedBitacoraExamId(null)} 
            examId={selectedBitacoraExamId}
          />
      )}
    </AppShell>
  );
}
