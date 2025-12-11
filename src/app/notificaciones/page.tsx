
"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, Search, Eye, Bell, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import type { AforoCase } from '@/types';
import { Input } from '@/components/ui/input';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { Badge } from '@/components/ui/badge';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileIncidentCard } from '@/components/reporter/MobileIncidentCard';

type DateFilterType = 'range' | 'month' | 'today';

const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, 'label': 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function NotificacionesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  
  const [allIncidents, setAllIncidents] = useState<AforoCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<AforoCase | null>(null);

  // States for filter inputs
  const [searchTermInput, setSearchTermInput] = useState('');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // State for applied filters
  const [appliedFilters, setAppliedFilters] = useState({
    searchTerm: '',
    dateRange: undefined as DateRange | undefined,
    isSearchActive: false,
  });

  useEffect(() => {
    if (!authLoading && (!user || !(user.roleTitle === 'agente aduanero' || user.role === 'admin'))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    // Base query fetches all cases that HAVE an incident reported.
    let q = query(
      collection(db, 'AforoCases'),
      where('incidentReported', '==', true),
      orderBy('incidentReportedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedIncidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
      setAllIncidents(fetchedIncidents);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching incidents:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
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
      searchTerm: searchTermInput,
      dateRange: dateRange,
      isSearchActive: !!searchTermInput || !!dateRange
    });
  };

  const clearFilters = () => {
    setSearchTermInput('');
    setDateRangeInput(undefined);
    setAppliedFilters({ searchTerm: '', dateRange: undefined, isSearchActive: false });
  };


  const filteredIncidents = useMemo(() => {
    let filtered = allIncidents;
    
    // If no search is active, show only pending.
    if (!appliedFilters.isSearchActive) {
        return filtered.filter(incident => incident.incidentStatus === 'Pendiente');
    }

    // If search is active, filter from all incidents
    if (appliedFilters.searchTerm) {
        filtered = filtered.filter(incident =>
            incident.ne.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
            incident.consignee.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase())
        );
    }
    
    if (appliedFilters.dateRange?.from) {
        const start = startOfDay(appliedFilters.dateRange.from);
        const end = appliedFilters.dateRange.to ? endOfDay(appliedFilters.dateRange.to) : endOfDay(appliedFilters.dateRange.from);
        
        filtered = filtered.filter(c => {
            if (!c.incidentReportedAt) return false;
            const incidentDate = c.incidentReportedAt.toDate();
            return incidentDate >= start && incidentDate <= end;
        });
    }

    return filtered.sort((a, b) => (b.incidentReportedAt?.toMillis() ?? 0) - (a.incidentReportedAt?.toMillis() ?? 0));
  }, [allIncidents, appliedFilters]);

  const formatDate = (timestamp: Timestamp | Date | null | undefined): string => {
    if (!timestamp) return 'N/A';
    const d = (timestamp as Timestamp)?.toDate ? (timestamp as Timestamp).toDate() : (timestamp as Date);
    return format(d, "dd/MM/yy HH:mm", { locale: es });
  };
  
  if (authLoading || !user || !(user.roleTitle === 'agente aduanero' || user.role === 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedIncident) {
    return (
      <AppShell>
        <div className="py-2 md:py-5">
          <IncidentReportDetails
            caseData={selectedIncident}
            onClose={() => setSelectedIncident(null)}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-5xl mx-auto custom-shadow">
          <CardHeader>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                      <CardTitle className="flex items-center gap-2 text-2xl"><Bell /> Centro de Notificaciones</CardTitle>
                      <CardDescription>Aquí se listan todas las solicitudes de rectificación pendientes de revisión.</CardDescription>
                  </div>
                </div>
                 <div className="border-t pt-4 space-y-4">
                     <div className="flex flex-wrap items-center gap-2">
                         <div className="relative w-full sm:max-w-xs">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                             <Input 
                                 placeholder="Buscar por NE o Consignatario..."
                                 className="pl-10"
                                 value={searchTermInput}
                                 onChange={(e) => setSearchTermInput(e.target.value)}
                             />
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
                        <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                        <Button variant="outline" onClick={clearFilters}>Limpiar Filtros</Button>
                      </div>
                  </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium text-foreground">No hay incidencias que mostrar</h3>
                <p className="mt-1 text-muted-foreground">
                  {appliedFilters.isSearchActive ? 'No se encontraron incidencias para su búsqueda.' : 'No tiene solicitudes de rectificación pendientes por revisar.'}
                </p>
              </div>
            ) : isMobile ? (
                 <div className="space-y-4">
                    {filteredIncidents.map(incident => (
                        <MobileIncidentCard 
                            key={incident.id} 
                            incident={incident} 
                            onReview={() => setSelectedIncident(incident)}
                        />
                    ))}
                </div>
            ) : (
              <div className="overflow-x-auto table-container rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NE</TableHead>
                      <TableHead>Consignatario</TableHead>
                      <TableHead>Reportado Por</TableHead>
                      <TableHead>Fecha Reporte</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents.map(incident => (
                      <TableRow key={incident.id}>
                        <TableCell className="font-medium">{incident.ne}</TableCell>
                        <TableCell>{incident.consignee}</TableCell>
                        <TableCell><Badge variant="outline">{incident.incidentReportedBy}</Badge></TableCell>
                        <TableCell>{formatDate(incident.incidentReportedAt)}</TableCell>
                        <TableCell>
                           <Badge 
                              variant={
                                  incident.incidentStatus === 'Pendiente' ? 'secondary' : 
                                  incident.incidentStatus === 'Aprobada' ? 'default' : 'destructive'
                               }
                           >
                            {incident.incidentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <Button variant="default" size="sm" onClick={() => setSelectedIncident(incident)}>
                                <Eye className="mr-2 h-4 w-4" /> Revisar Esquela
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
