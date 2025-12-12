
"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, getDocs, QueryConstraint, getDoc, writeBatch, doc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, Inbox, Eye, Search, Calendar, CalendarDays, CalendarRange, BookOpen, AlertTriangle, History, CheckSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AforoCase, AforoCaseStatus, PreliquidationStatus, DigitacionStatus, Worksheet, AforoCaseUpdate } from '@/types';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ObservationModal } from '@/components/reporter/ObservationModal';
import { Input } from '@/components/ui/input';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import type { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { AforoCaseHistoryModal } from '@/components/reporter/AforoCaseHistoryModal';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileAgenteCaseCard } from '@/components/agente/MobileAgenteCaseCard';
import { WorksheetDetailModal } from '@/components/reporter/WorksheetDetailModal';


type DateFilterType = 'range' | 'month' | 'today';
type StatusFilterType = 'todos' | 'Pendiente' | 'Aprobado' | 'Rechazado';

const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, 'label': 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function AgenteCasosPage() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [allCases, setAllCases] = useState<AforoCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<AforoCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCaseForAction, setSelectedCaseForAction] = useState<AforoCase | null>(null);
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [worksheetToView, setWorksheetToView] = useState<Worksheet | null>(null);
  const [incidentToView, setIncidentToView] = useState<AforoCase | null>(null);
  const { toast } = useToast();
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('Pendiente');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!user || !(user.roleTitle === 'agente aduanero' || user.role === 'supervisor')) {
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    try {
        const q = query(
            collection(db, "AforoCases"),
            where("revisorAsignado", "==", user.displayName),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const fetchedCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        setAllCases(fetchedCases);
    } catch (error) {
        console.error("Error fetching assigned cases:", error);
    } finally {
        setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyFilters = useCallback(() => {
    let cases = [...allCases];

    if (searchTerm) {
        cases = cases.filter(c => c.ne.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (statusFilter !== 'todos') {
        cases = cases.filter(c => (c.revisorStatus || 'Pendiente') === statusFilter);
    }
    
    let dateFiltered = cases;
    let start, end;
    
    if (dateFilterType === 'range' && dateRange?.from) {
        start = startOfDay(dateRange.from);
        end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    } else if (dateFilterType === 'month') {
        start = startOfMonth(new Date(selectedYear, selectedMonth));
        end = endOfMonth(new Date(selectedYear, selectedMonth));
    } else if (dateFilterType === 'today') {
        const today = new Date();
        start = startOfDay(today);
        end = endOfDay(today);
    }

    if (start && end) {
        dateFiltered = cases.filter(c => {
            const caseDate = c.assignmentDate?.toDate();
            return caseDate && caseDate >= start! && caseDate <= end!;
        });
    }

    setFilteredCases(dateFiltered);
  }, [allCases, searchTerm, statusFilter, dateFilterType, dateRange, selectedMonth, selectedYear]);
  
  useEffect(() => {
    applyFilters();
  }, [allCases, applyFilters]);

  const handleSearch = () => { applyFilters(); };
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('Pendiente');
    setDateFilterType('range');
    setDateRange(undefined);
    setFilteredCases(allCases.filter(c => (c.revisorStatus || 'Pendiente') === 'Pendiente'));
    setSelectedRows([]);
  }

  const handleBulkApprove = async () => {
    if (selectedRows.length === 0 || !user?.displayName) return;
    setIsBulkApproving(true);
    const batch = writeBatch(db);
    const newStatus: AforoCaseStatus = 'Aprobado';
    const comment = "Aprobado masivamente por agente aduanero.";

    selectedRows.forEach(caseId => {
        const caseRef = doc(db, 'AforoCases', caseId);
        const originalCase = allCases.find(c => c.id === caseId);
        
        batch.update(caseRef, {
            revisorStatus: newStatus,
            observacionRevisor: comment,
            revisorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });

        const updatesSubcollectionRef = collection(caseRef, 'actualizaciones');
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'status_change',
            oldValue: originalCase?.revisorStatus || 'Pendiente',
            newValue: newStatus,
            comment: comment,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
    });

    try {
        await batch.commit();
        toast({ title: 'Éxito', description: `${selectedRows.length} casos han sido aprobados.` });
        setSelectedRows([]);
        fetchData(); // Refresh data
    } catch (error) {
        console.error("Error bulk approving cases:", error);
        toast({ title: 'Error', description: 'No se pudieron aprobar los casos seleccionados.', variant: 'destructive' });
    } finally {
        setIsBulkApproving(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.length === filteredCases.filter(c => c.revisorStatus === 'Pendiente').length) {
        setSelectedRows([]);
    } else {
        setSelectedRows(filteredCases.filter(c => c.revisorStatus === 'Pendiente').map(c => c.id));
    }
  }

  const openActionModal = (caseItem: AforoCase, action: 'observation' | 'history') => {
    setSelectedCaseForAction(caseItem);
    if (action === 'observation') setIsObservationModalOpen(true);
    if (action === 'history') setIsHistoryModalOpen(true);
  };
  
  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
  };
  
  const handleCloseObservationModal = () => {
    setIsObservationModalOpen(false);
    fetchData();
  };


  const handleViewWorksheet = async (caseItem: AforoCase) => {
    if (!caseItem.worksheetId) {
        toast({ title: "Sin Hoja de Trabajo", description: "Este caso no tiene una hoja de trabajo asociada.", variant: "destructive" });
        return;
    }
    try {
        const wsDocRef = doc(db, 'worksheets', caseItem.worksheetId);
        const wsSnap = await getDoc(wsDocRef);
        if (wsSnap.exists()) {
            setWorksheetToView({ id: wsSnap.id, ...wsSnap.data() } as Worksheet);
        } else {
            toast({ title: "Error", description: "No se pudo encontrar la hoja de trabajo.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "Ocurrió un error al cargar la hoja de trabajo.", variant: "destructive" });
    }
  };

  const getStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) {
        case 'Aprobado': return 'default';
        case 'Rechazado': return 'destructive';
        case 'Revalidación Solicitada': return 'secondary';
        case 'Pendiente':
        default: return 'outline';
    }
  };

  const getPreliquidationStatusBadge = (status?: PreliquidationStatus) => {
    switch(status) {
      case 'Aprobada': return <Badge variant="default" className="bg-green-600">Aprobada</Badge>;
      default: return <Badge variant="outline">Pendiente</Badge>;
    }
  };

   const getDigitacionBadge = (status?: DigitacionStatus) => {
    if (status) return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>;
    return <Badge variant="outline">Pendiente</Badge>;
  }


  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (incidentToView) {
      return <AppShell><div className="py-2 md:py-5"><IncidentReportDetails caseData={incidentToView} onClose={() => setIncidentToView(null)} /></div></AppShell>;
  }

  const caseActions = {
    openActionModal,
    handleViewWorksheet,
    setIncidentToView,
  };


  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-screen-2xl mx-auto custom-shadow">
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle>Mis Casos Asignados</CardTitle>
                <Button onClick={handleBulkApprove} disabled={selectedRows.length === 0 || isBulkApproving}>
                    {isBulkApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    <CheckSquare className="mr-2 h-4 w-4" /> Aprobar Seleccionados ({selectedRows.length})
                </Button>
            </div>
            <CardDescription>Aquí se listan los casos de aforo que requieren su revisión y aprobación.</CardDescription>
            <div className="border-t pt-4 mt-2 space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Input placeholder="Buscar por NE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilterType)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="todos">Todos los Estados</SelectItem>
                          <SelectItem value="Pendiente">Pendientes</SelectItem>
                          <SelectItem value="Aprobado">Aprobados</SelectItem>
                          <SelectItem value="Rechazado">Rechazados</SelectItem>
                      </SelectContent>
                  </Select>
                  <Select value={dateFilterType} onValueChange={v => setDateFilterType(v as DateFilterType)}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent>
                           <SelectItem value="range"><CalendarRange className="mr-2 h-4 w-4 inline"/>Rango de Fechas</SelectItem>
                           <SelectItem value="month"><Calendar className="mr-2 h-4 w-4 inline"/>Mes Específico</SelectItem>
                           <SelectItem value="today"><CalendarDays className="mr-2 h-4 w-4 inline"/>Hoy</SelectItem>
                       </SelectContent>
                  </Select>
               </div>
               <div className="flex flex-wrap items-center gap-4">
                   {dateFilterType === 'range' && <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredCases.length === 0 ? (
              <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium text-foreground">No se encontraron casos</h3>
                <p className="mt-1 text-muted-foreground">No hay casos que coincidan con los filtros actuales.</p>
              </div>
            ) : isMobile ? (
                 <div className="space-y-4">
                    {filteredCases.map(caseItem => (
                        <MobileAgenteCaseCard 
                            key={caseItem.id} 
                            caseItem={caseItem} 
                            caseActions={caseActions} 
                        />
                    ))}
                </div>
            ) : (
              <div className="overflow-x-auto table-container rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                          <Checkbox
                              checked={selectedRows.length > 0 && selectedRows.length === filteredCases.filter(c => c.revisorStatus === 'Pendiente').length}
                              onCheckedChange={handleSelectAll}
                          />
                      </TableHead>
                      <TableHead>Acciones</TableHead>
                      <TableHead>NE</TableHead>
                      <TableHead>Consignatario</TableHead>
                      <TableHead>Aforador</TableHead>
                      <TableHead>Estado Revisor</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Posiciones</TableHead>
                      <TableHead>Estado Preliquidación</TableHead>
                      <TableHead>Digitador</TableHead>
                      <TableHead>Estado Digitación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map(caseItem => (
                      <TableRow key={caseItem.id} data-state={selectedRows.includes(caseItem.id) ? 'selected' : undefined}>
                        <TableCell>
                            <Checkbox
                                checked={selectedRows.includes(caseItem.id)}
                                onCheckedChange={() => setSelectedRows(prev => 
                                    prev.includes(caseItem.id) 
                                        ? prev.filter(id => id !== caseItem.id)
                                        : [...prev, caseItem.id]
                                )}
                                disabled={caseItem.revisorStatus !== 'Pendiente'}
                            />
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">Ver</Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onSelect={() => handleViewWorksheet(caseItem)}><BookOpen className="mr-2 h-4 w-4" /> Hoja de Trabajo</DropdownMenuItem>
                                        {caseItem.incidentReported && <DropdownMenuItem onSelect={() => setIncidentToView(caseItem)}><AlertTriangle className="mr-2 h-4 w-4" /> Incidencia</DropdownMenuItem>}
                                        <DropdownMenuItem onSelect={() => openActionModal(caseItem, 'history')}><History className="mr-2 h-4 w-4" /> Bitácora</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                 <Button size="sm" variant="default" onClick={() => openActionModal(caseItem, 'observation')}>Gestionar</Button>
                            </div>
                        </TableCell>
                        <TableCell className="font-medium">{caseItem.ne}</TableCell>
                        <TableCell>{caseItem.consignee}</TableCell>
                        <TableCell>{caseItem.aforador || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(caseItem.revisorStatus)}>
                            {caseItem.revisorStatus || 'Pendiente'}
                          </Badge>
                        </TableCell>
                        <TableCell>{caseItem.declarationPattern}</TableCell>
                        <TableCell>{caseItem.totalPosiciones || 'N/A'}</TableCell>
                        <TableCell>{getPreliquidationStatusBadge(caseItem.preliquidationStatus)}</TableCell>
                        <TableCell>{caseItem.digitadorAsignado || 'N/A'}</TableCell>
                        <TableCell>{getDigitacionBadge(caseItem.digitacionStatus)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {selectedCaseForAction && (
          <>
            <ObservationModal 
                isOpen={isObservationModalOpen}
                onClose={handleCloseObservationModal}
                caseData={selectedCaseForAction}
            />
            <AforoCaseHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={handleCloseHistoryModal}
                caseData={selectedCaseForAction}
            />
          </>
      )}
      {worksheetToView && (
        <WorksheetDetailModal
          isOpen={!!worksheetToView}
          onClose={() => setWorksheetToView(null)}
          worksheet={worksheetToView}
        />
      )}
    </AppShell>
  );
}
