
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, getDocs, updateDoc, doc, collectionGroup } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, Inbox, FileCheck2, Eye, Search, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { AforoCase, AppUser, Remision } from '@/types';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { FacturacionFinalizeModal } from '@/components/facturacion/FacturacionFinalizeModal';
import { RemisionPrint } from '@/components/facturacion/RemisionPrint';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RemisionDetailView } from '@/components/facturacion/RemisionDetailView';
import { Input } from '@/components/ui/input';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';

type DateFilterType = 'range' | 'month' | 'today';

const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, 'label': 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function FacturacionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [allCases, setAllCases] = useState<AforoCase[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRemisiones, setIsLoadingRemisiones] = useState(true);
  const [selectedCase, setSelectedCase] = useState<AforoCase | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isRemisionModalOpen, setIsRemisionModalOpen] = useState(false);
  const [selectedRemision, setSelectedRemision] = useState<Remision | null>(null);
  
  const [searchTermNE, setSearchTermNE] = useState('');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [remisionSearchTerm, setRemisionSearchTerm] = useState('');
  const [remisionDateFilter, setRemisionDateFilter] = useState<DateRange | undefined>();

  const [activeFilters, setActiveFilters] = useState<{ ne?: string; dateRange?: DateRange; dateFilterType?: DateFilterType; month?: number; year?: number; } | null>(null);

  const canAssign = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'coordinadora';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

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

    setActiveFilters({
        ne: searchTermNE,
        dateRange: dateRange,
        dateFilterType: dateFilterType,
        month: selectedMonth,
        year: selectedYear,
    });
  };

  const clearFilters = () => {
    setSearchTermNE('');
    setDateRangeInput(undefined);
    setActiveFilters(null);
  };

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    let q;

    if (canAssign) {
        q = query(collection(db, "AforoCases"), 
            where('facturacionStatus', 'in', ['Enviado a Facturacion', 'Facturado'])
        );
    } else {
        q = query(collection(db, 'AforoCases'), 
            where("facturadorAsignado", "==", user.displayName),
            where('facturacionStatus', 'in', ['Enviado a Facturacion', 'Facturado'])
        );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetchedCases = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
      
      // If no filters are active, hide cases that are in a remision.
      if (!activeFilters) {
        fetchedCases = fetchedCases.filter(c => c.facturacionStatus === 'Enviado a Facturacion' || (c.facturacionStatus === 'Facturado' && !c.remisionId));
      }
      
      fetchedCases.sort((a,b) => (b.enviadoAFacturacionAt?.toMillis() || 0) - (a.enviadoAFacturacionAt?.toMillis() || 0));

      setAllCases(fetchedCases);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching facturacion cases:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, canAssign, activeFilters]);

  const fetchRemisiones = useCallback(() => {
    if (!user) return;
    setIsLoadingRemisiones(true);
    
    let q = query(collection(db, "remisiones"), orderBy("createdAt", "desc"));
    
    if (!canAssign) {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        q = query(q, where("createdAt", ">=", todayStart), where("createdAt", "<=", todayEnd));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedRemisiones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Remision));
        setRemisiones(fetchedRemisiones);
        setIsLoadingRemisiones(false);
    }, (error) => {
        console.error("Error fetching remisiones:", error);
        setIsLoadingRemisiones(false);
    });
    return unsubscribe;
  }, [user, canAssign]);

  useEffect(() => {
    const unsub = fetchRemisiones();
    return () => { if (unsub) unsub(); };
  }, [fetchRemisiones]);

  const filteredRemisiones = useMemo(() => {
    if (!user) return [];
    let filtered = remisiones;

    if (remisionSearchTerm) {
        const lowerTerm = remisionSearchTerm.toLowerCase();
        filtered = filtered.filter(r => 
            r.recipientName.toLowerCase().includes(lowerTerm) ||
            r.id.toLowerCase().includes(lowerTerm) ||
            r.cases.some(c => c.ne.toLowerCase().includes(lowerTerm))
        );
    }
    
    if (canAssign && remisionDateFilter?.from) {
        const start = remisionDateFilter.from;
        const end = remisionDateFilter.to ? endOfDay(remisionDateFilter.to) : endOfDay(start);
        filtered = filtered.filter(r => {
            const remisionDate = r.createdAt.toDate();
            return remisionDate >= start && remisionDate <= end;
        });
    }

    return filtered;
  }, [remisiones, remisionSearchTerm, remisionDateFilter, canAssign, user]);


  useEffect(() => {
    const fetchFacturadores = async () => {
        const q = query(collection(db, 'users'), where('role', '==', 'facturador'));
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => ({uid: doc.id, ...doc.data()} as AppUser));
        setAssignableUsers(users);
    };
    if (canAssign) {
        fetchFacturadores();
    }
  }, [canAssign]);

  const handleAssignment = useCallback(async (caseId: string, facturadorName: string) => {
    const caseDocRef = doc(db, 'AforoCases', caseId);
    try {
        await updateDoc(caseDocRef, {
            facturadorAsignado: facturadorName,
            facturadorAsignadoAt: Timestamp.now(),
        });
        toast({ title: 'Asignado', description: `Caso asignado a ${facturadorName}.`});
    } catch(error) {
        console.error("Error assigning case:", error);
        toast({ title: 'Error', description: 'No se pudo asignar el caso.', variant: 'destructive'});
    }
  }, [toast]);

  const handleFinalizeClick = (caseItem: AforoCase) => {
    setSelectedCase(caseItem);
  };

  const handleSelectionChange = (caseId: string) => {
    setSelectedRows(prev => 
      prev.includes(caseId) ? prev.filter(id => id !== caseId) : [...prev, caseId]
    );
  };
  
  const finalizedCases = useMemo(() => {
    return allCases.filter(c => c.facturacionStatus === 'Facturado');
  }, [allCases]);
  
  const handleSelectAll = () => {
    const currentFinalizedIds = finalizedCases.map(c => c.id);
    if (selectedRows.length === currentFinalizedIds.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(currentFinalizedIds);
    }
  };

  const casesForRemision = useMemo(() => finalizedCases.filter(c => selectedRows.includes(c.id)), [finalizedCases, selectedRows]);
  
  const filteredCases = useMemo(() => {
    let filtered = allCases;
    
    if (activeFilters?.ne) {
        filtered = filtered.filter(c => c.ne.toUpperCase().includes(activeFilters.ne!.toUpperCase()));
    }
    
    if (activeFilters?.dateRange?.from) {
        const start = activeFilters.dateRange.from;
        const end = activeFilters.dateRange.to ? endOfDay(activeFilters.dateRange.to) : endOfDay(start);
        filtered = filtered.filter(c => {
            const caseDate = (c.enviadoAFacturacionAt as Timestamp)?.toDate() || (c.createdAt as Timestamp)?.toDate();
            return caseDate && caseDate >= start && caseDate <= end;
        });
    }
    
    return filtered;
  }, [allCases, activeFilters]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (isRemisionModalOpen) {
    return <RemisionPrint cases={casesForRemision} onClose={() => { setIsRemisionModalOpen(false); setSelectedRows([]); }} />
  }

  if (selectedRemision) {
      return <RemisionDetailView remision={selectedRemision} onClose={() => setSelectedRemision(null)} />
  }

  return (
    <>
      <AppShell>
        <Tabs defaultValue="pendientes">
           <Card className="w-full max-w-7xl mx-auto custom-shadow">
            <CardHeader>
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="pendientes">Casos de Facturación</TabsTrigger>
                        <TabsTrigger value="remisiones">Remisiones Generadas</TabsTrigger>
                    </TabsList>
                    <Button onClick={() => setIsRemisionModalOpen(true)} disabled={selectedRows.length === 0}>
                        Generar Remisión ({selectedRows.length})
                    </Button>
                </div>
                <CardTitle>Módulo de Facturación</CardTitle>
                <CardDescription>Busque casos o vea los casos pendientes de facturación.</CardDescription>
                <div className="border-t pt-4 mt-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input placeholder="Buscar por NE..." value={searchTermNE} onChange={(e) => setSearchTermNE(e.target.value)} />
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
            </CardHeader>
            <CardContent>
                <TabsContent value="pendientes">
                    {isLoading ? (
                    <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : filteredCases.length === 0 ? (
                    <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium text-foreground">No hay casos</h3>
                        <p className="mt-1 text-muted-foreground">{activeFilters ? 'No se encontraron casos para los filtros aplicados.' : 'No hay casos pendientes de facturación.'}</p>
                    </div>
                    ) : (
                    <div className="overflow-x-auto table-container rounded-lg border">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedRows.length > 0 && selectedRows.length === finalizedCases.length}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Seleccionar todo"
                                    disabled={finalizedCases.length === 0}
                                />
                            </TableHead>
                            <TableHead>NE</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Consignatario</TableHead>
                            <TableHead>Ejecutivo</TableHead>
                            {canAssign && <TableHead>Asignar a</TableHead>}
                            <TableHead>Declaración</TableHead>
                            <TableHead>Fecha Envío</TableHead>
                            <TableHead>ID Remisión</TableHead>
                            <TableHead>Fecha Remisión</TableHead>
                            <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCases.map((c) => {
                                const remisionInfo = c.remisionId ? remisiones.find(r => r.id === c.remisionId) : undefined;
                                return (
                                <TableRow key={c.id} data-state={selectedRows.includes(c.id) ? "selected" : undefined} className={c.facturacionStatus === 'Facturado' ? 'bg-green-50' : ''}>
                                    <TableCell>
                                    <Checkbox
                                            checked={selectedRows.includes(c.id)}
                                            onCheckedChange={() => handleSelectionChange(c.id)}
                                            aria-label={`Seleccionar caso ${c.ne}`}
                                            disabled={c.facturacionStatus !== 'Facturado'}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{c.ne}</TableCell>
                                    <TableCell>{c.worksheet?.reference || 'N/A'}</TableCell>
                                    <TableCell>{c.consignee}</TableCell>
                                    <TableCell>{c.executive}</TableCell>
                                    {canAssign && (
                                        <TableCell>
                                            <Select
                                                value={c.facturadorAsignado || ''}
                                                onValueChange={(value) => handleAssignment(c.id, value)}
                                                disabled={c.facturacionStatus === 'Facturado'}
                                            >
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Asignar facturador..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {assignableUsers.map(u => (
                                                        <SelectItem key={u.uid} value={u.displayName || u.email!}>
                                                            {u.displayName || u.email}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    )}
                                    <TableCell>{c.declaracionAduanera || 'N/A'}</TableCell>
                                    <TableCell>{c.enviadoAFacturacionAt ? format(c.enviadoAFacturacionAt.toDate(), 'dd/MM/yy HH:mm', { locale: es }) : 'N/A'}</TableCell>
                                    <TableCell>{remisionInfo?.id || 'N/A'}</TableCell>
                                    <TableCell>{remisionInfo ? format(remisionInfo.createdAt.toDate(), 'dd/MM/yy HH:mm', { locale: es }) : 'N/A'}</TableCell>
                                    <TableCell>
                                    {c.facturacionStatus === 'Facturado' ? (
                                        <span className="text-sm text-green-600 font-semibold flex items-center gap-2">
                                            <FileCheck2 className="h-4 w-4"/> Finalizado
                                        </span>
                                    ) : (
                                        <Button size="sm" onClick={() => handleFinalizeClick(c)}>Finalizar Proceso</Button>
                                    )}
                                    </TableCell>
                                </TableRow>
                                )
                            })}
                        </TableBody>
                        </Table>
                    </div>
                    )}
                </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="remisiones">
                 <Card className="w-full max-w-7xl mx-auto custom-shadow">
                    <CardHeader>
                        <CardTitle>Remisiones Generadas</CardTitle>
                        <CardDescription>Historial de todas las remisiones de cuentas creadas.</CardDescription>
                         <div className="border-t pt-4 mt-2 space-y-4">
                            <div className="flex flex-col md:flex-row gap-4">
                                <Input placeholder="Buscar por ID, destinatario o NE..." value={remisionSearchTerm} onChange={e => setRemisionSearchTerm(e.target.value)} className="max-w-sm"/>
                                {canAssign && (
                                    <DatePickerWithRange date={remisionDateFilter} onDateChange={setRemisionDateFilter} />
                                )}
                            </div>
                         </div>
                    </CardHeader>
                    <CardContent>
                         {isLoadingRemisiones ? (
                            <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : filteredRemisiones.length === 0 ? (
                             <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                                <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium text-foreground">No hay remisiones</h3>
                                <p className="mt-1 text-muted-foreground">{canAssign ? 'No se encontraron remisiones para los filtros aplicados.' : 'No se han generado remisiones hoy.'}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto table-container rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID Remisión</TableHead>
                                            <TableHead>Destinatario</TableHead>
                                            <TableHead>Fecha de Creación</TableHead>
                                            <TableHead>Total de Cuentas</TableHead>
                                            <TableHead>Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRemisiones.map(r => (
                                            <TableRow key={r.id}>
                                                <TableCell className="font-mono text-xs">{r.id}</TableCell>
                                                <TableCell>{r.recipientName}</TableCell>
                                                <TableCell>{format(r.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                                                <TableCell>{r.totalCases}</TableCell>
                                                <TableCell>
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedRemision(r)}>
                                                        <Eye className="mr-2 h-4 w-4"/> Ver
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
            </TabsContent>
        </Tabs>
      </AppShell>
      {selectedCase && (
        <FacturacionFinalizeModal 
            isOpen={!!selectedCase}
            onClose={() => setSelectedCase(null)}
            caseData={selectedCase}
        />
      )}
    </>
  );
}
