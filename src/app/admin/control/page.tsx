
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { DatePicker } from '@/components/reports/DatePicker';
import { Loader2, Search, Eye, Edit, Archive, History, Inbox, Trash2, FolderOpen, Megaphone, BarChartHorizontal } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp, where, doc, updateDoc, addDoc, serverTimestamp, writeBatch, limit, type QueryConstraint } from 'firebase/firestore';
import type { ExamDocument, AdminAuditLogEntry, AuditLogEntry, WorksheetWithCase } from '@/types';
import type { DateRange } from 'react-day-picker';
import { EditableExamDetails } from '@/components/admin/EditableExamDetails';
import { AuditLogPreview } from '@/components/admin/AuditLogPreview';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAppContext, ExamStep } from '@/context/AppContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';


type ViewMode = 'activeExamenes' | 'archivedExamenes' | 'archivedAforo';
type CombinedLog = (AdminAuditLogEntry | AuditLogEntry) & { sortDate: Date };


export default function AdminControlPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { setExamData, setProducts, setCurrentStep } = useAppContext();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [specificDate, setSpecificDate] = useState<Date | undefined>();
  const [searchMode, setSearchMode] = useState<'range' | 'specific'>('range');
  const [viewMode, setViewMode] = useState<ViewMode>('activeExamenes');

  const [filteredItems, setFilteredItems] = useState<(ExamDocument | WorksheetWithCase)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedExam, setSelectedExam] = useState<ExamDocument | WorksheetWithCase | null>(null);
  const [auditLogs, setAuditLogs] = useState<CombinedLog[]>([]);
  const [isViewingLogs, setIsViewingLogs] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleSearch = async () => {
    if ((searchMode === 'range' && !dateRange?.from) || (searchMode === 'specific' && !specificDate)) {
        setError("Por favor, seleccione una fecha o un rango de fechas para buscar.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setFilteredItems([]);
    setIsSearchActive(true);

    try {
        let collectionName: 'examenesPrevios' | 'worksheets';
        let isArchivedQuery: boolean;

        switch(viewMode) {
            case 'activeExamenes':
                collectionName = 'examenesPrevios';
                isArchivedQuery = false;
                break;
            case 'archivedExamenes':
                collectionName = 'examenesPrevios';
                isArchivedQuery = true;
                break;
            case 'archivedAforo':
                collectionName = 'worksheets';
                isArchivedQuery = true;
                break;
            default:
                collectionName = 'examenesPrevios';
                isArchivedQuery = false;
        }

        const qConstraints: QueryConstraint[] = [
            where("isArchived", "==", isArchivedQuery),
            orderBy("createdAt", "desc"),
            limit(50) // Limit results for performance
        ];
        
        let start: Date | undefined, end: Date | undefined;
        if (searchMode === 'range' && dateRange?.from) {
            start = dateRange.from;
            end = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
            end.setHours(23, 59, 59, 999);
        } else if (searchMode === 'specific' && specificDate) {
            start = new Date(specificDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(specificDate);
            end.setHours(23, 59, 59, 999);
        }

        if (start && end) {
            qConstraints.unshift(where("createdAt", "<=", end));
            qConstraints.unshift(where("createdAt", ">=", start));
        }

        const q = query(collection(db, collectionName), ...qConstraints);
        const snapshot = await getDocs(q);
        
        const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamDocument | WorksheetWithCase));
        setFilteredItems(fetchedItems);

        if (fetchedItems.length === 0) {
            setError("No se encontraron registros para los criterios de búsqueda actuales.");
        }

    } catch (err: any) {
      console.error("Error fetching filtered data:", err);
      setError("Error al buscar. Revise los índices de Firestore si el problema persiste.");
      toast({ title: "Error de Búsqueda", description: "Ocurrió un error al filtrar los datos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewDetails = (item: ExamDocument | WorksheetWithCase) => {
    setSelectedExam(item);
    setIsViewingLogs(false);
    setAuditLogs([]);
  };

  const handleEditExam = (exam: ExamDocument) => {
    setExamData({
      ne: exam.ne,
      reference: exam.reference,
      consignee: exam.consignee,
      location: exam.location,
      manager: exam.manager
    }, true); 
    setProducts(exam.products || []);
    setCurrentStep(ExamStep.PRODUCT_LIST);
    router.push('/examiner');
  };

  const handleViewModifications = async (item: ExamDocument | WorksheetWithCase) => {
    setSelectedExam(item);
    setIsViewingLogs(true);
    setAuditLogs([]);
    try {
        let logs: CombinedLog[] = [];
        let logPath: string;

        if ('products' in item) { // It's an ExamDocument
             const gestorLogsQuery = query(collection(db, "examenesRecuperados"), where("examNe", "==", item.ne), orderBy("changedAt", "desc"));
             const gestorSnapshot = await getDocs(gestorLogsQuery);
             gestorSnapshot.forEach(doc => logs.push({ ...doc.data(), id: doc.id, sortDate: doc.data().changedAt.toDate() } as CombinedLog));
             logPath = `examenesPrevios/${item.id}/actualizaciones`;
        } else { // It's a WorksheetWithCase
            logPath = `worksheets/${item.id}/actualizaciones`;
        }

        const updatesQuery = query(collection(db, logPath), orderBy('updatedAt', 'desc'));
        const updatesSnapshot = await getDocs(updatesQuery);
        updatesSnapshot.forEach(doc => logs.push({ ...doc.data(), id: doc.id, sortDate: doc.data().updatedAt.toDate() } as CombinedLog));
        
        logs.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
        setAuditLogs(logs);

    } catch (err) {
      console.error("Error fetching audit logs:", err);
      toast({ title: "Error", description: "No se pudieron cargar los registros de cambios.", variant: "destructive" });
    }
  };

  const handleArchiveAction = async (item: ExamDocument | WorksheetWithCase, archive: boolean) => {
     if (!user || !user.email) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }

    const isExamen = 'products' in item;
    const collectionName = isExamen ? "examenesPrevios" : "worksheets";
    const docRef = doc(db, collectionName, item.id!);
    const batch = writeBatch(db);

    try {
      const oldValue = item.isArchived ?? false;
      batch.update(docRef, { isArchived: archive });
      
      let worksheetId: string | undefined;
      if (!isExamen && (item as WorksheetWithCase).worksheetId) {
          worksheetId = (item as WorksheetWithCase).worksheetId;
          const worksheetRef = doc(db, "worksheets", worksheetId!);
          batch.update(worksheetRef, { isArchived: archive });
      }

      // Log to the corresponding worksheet/exam's audit trail
      const auditCollectionPath = isExamen ? `examenesPrevios/${item.id}/actualizaciones` : `worksheets/${worksheetId || item.id}/actualizaciones`;
      
      const logRef = doc(collection(db, auditCollectionPath));
      batch.set(logRef, {
          updatedAt: serverTimestamp(),
          updatedBy: user.email,
          field: 'isArchived',
          oldValue: oldValue,
          newValue: archive,
          comment: `Registro ${archive ? 'archivado' : 'restaurado'} por administrador.`
      });
      

      await batch.commit();
      toast({ title: `Registro ${archive ? 'archivado' : 'restaurado'} con éxito.` });
      
      // Refetch data to update the view
      handleSearch();

    } catch (error) {
      console.error("Error archiving document:", error);
      toast({ title: "Error", description: `No se pudo ${archive ? 'archivar' : 'restaurar'} el registro.`, variant: "destructive" });
    }
  };

  const handleCloseDetails = () => {
    setSelectedExam(null);
    setAuditLogs([]);
    setIsViewingLogs(false);
  };

  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return format(timestamp.toDate(), 'dd/MM/yy HH:mm', { locale: es });
  };
  

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (selectedExam && !isViewingLogs) {
      return (
        <AppShell>
          <div className="py-2 md:py-5">
            {'products' in selectedExam ? (
                <EditableExamDetails exam={selectedExam as ExamDocument} onClose={handleCloseDetails} />
            ) : (
                <p>Vista de detalle para worksheet no implementada aún.</p> // Replace with actual component
            )}
          </div>
        </AppShell>
      )
  }
  
  if (selectedExam && isViewingLogs) {
    return (
        <AppShell>
            <div className="py-2 md:py-5 max-w-5xl mx-auto">
                 <div className="bg-card p-4 rounded-lg shadow-md">
                    <Button onClick={handleCloseDetails} variant="outline" className="mb-4 no-print">Volver al listado</Button>
                    <AuditLogPreview logs={auditLogs} exam={selectedExam as ExamDocument} />
                 </div>
            </div>
        </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-7xl mx-auto custom-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-semibold text-foreground">Control de Registros</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Busque, visualice, edite y archive exámenes previos y casos de aforo.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                 <Button asChild variant="outline">
                    <Link href="/admin/control/updates">
                        <BarChartHorizontal className="mr-2 h-4 w-4" /> Herramientas de Datos
                    </Link>
                </Button>
                <Button asChild>
                    <Link href="/admin/control/avisos">
                        <Megaphone className="mr-2 h-4 w-4" /> Gestionar Avisos
                    </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border rounded-md bg-secondary/30">
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant={searchMode === 'range' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('range')}>Rango de Fechas</Button>
                    <Button variant={searchMode === 'specific' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('specific')}>Fecha Específica</Button>
                </div>
                 <div className="flex flex-wrap items-center gap-4">
                    {searchMode === 'range' && <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
                    {searchMode === 'specific' && <DatePicker date={specificDate} onDateChange={setSpecificDate} />}
                    <Button onClick={handleSearch} disabled={isLoading} className="btn-primary"><Search className="mr-2 h-4 w-4"/>{isLoading ? 'Buscando...' : 'Buscar'}</Button>
                </div>
            </div>
            
            <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <Button size="sm" variant={viewMode === 'activeExamenes' ? 'secondary' : 'ghost'} onClick={() => setViewMode('activeExamenes')}>
                            <Inbox className="mr-2 h-4 w-4" /> Activos (Exámenes)
                        </Button>
                        <Button size="sm" variant={viewMode === 'archivedExamenes' ? 'secondary' : 'ghost'} onClick={() => setViewMode('archivedExamenes')}>
                            <Archive className="mr-2 h-4 w-4" /> Archivados (Exámenes)
                        </Button>
                         <Button size="sm" variant={viewMode === 'archivedAforo' ? 'secondary' : 'ghost'} onClick={() => setViewMode('archivedAforo')}>
                            <Archive className="mr-2 h-4 w-4" /> Archivados (Aforo)
                        </Button>
                    </div>
                </div>

                {isLoading && (
                  <div className="flex justify-center items-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary"/><p className="ml-3 text-muted-foreground">Cargando...</p></div>
                )}
                {error && !isLoading && (
                  <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">{error}</div>
                )}
                {!isLoading && isSearchActive && filteredItems.length > 0 && (
                  <div className="overflow-x-auto table-container rounded-lg border">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead>NE</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Consignatario</TableHead>
                          <TableHead>Asignado/Ejecutivo</TableHead>
                          <TableHead>Fecha Creación</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => {
                            const isExamen = 'products' in item;
                            const isComplete = isExamen ? item.status === 'complete' : (item as WorksheetWithCase).aforadorStatus === 'En revisión';
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.ne}</TableCell>
                                <TableCell>{isExamen ? 'Examen Previo' : 'Caso Aforo'}</TableCell>
                                <TableCell>{item.consignee}</TableCell>
                                <TableCell><Badge variant="secondary">{isExamen ? (item.assignedTo || item.manager) : (item as WorksheetWithCase).executive}</Badge></TableCell>
                                <TableCell>{formatTimestamp(item.createdAt)}</TableCell>
                                <TableCell>
                                  {item.isArchived ? <Badge variant="destructive">Archivado</Badge> : (isComplete ? <Badge className="bg-green-500 text-white">Completo</Badge> : <Badge variant="outline">{isExamen ? item.status : (item as WorksheetWithCase).aforadorStatus}</Badge>)}
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(item)}><Eye className="h-4 w-4"/> <span className="sr-only">Ver</span></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleViewModifications(item)}><History className="h-4 w-4"/> <span className="sr-only">Modificaciones</span></Button>
                                    {isExamen && <Button variant="ghost" size="sm" onClick={() => handleEditExam(item as ExamDocument)}><Edit className="h-4 w-4"/> <span className="sr-only">Editar</span></Button>}
                                    
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className={item.isArchived ? "text-green-600" : "text-destructive"}>
                                                {item.isArchived ? <FolderOpen className="h-4 w-4"/> : <Trash2 className="h-4 w-4"/>}
                                                <span className="sr-only">{item.isArchived ? 'Restaurar' : 'Archivar'}</span>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción {item.isArchived ? 'restaurará' : 'archivará'} el registro. {item.isArchived ? 'Los usuarios podrán verlo de nuevo.' : 'No será visible en la lista principal.'}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleArchiveAction(item, !item.isArchived)}>Sí, continuar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                              </TableRow>
                            )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                 {!isLoading && !error && isSearchActive && filteredItems.length === 0 && (
                    <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">
                        No se encontraron registros para los criterios de búsqueda actuales.
                    </div>
                )}
                 {!isSearchActive && !isLoading && (
                    <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">
                        Por favor, realice una búsqueda para ver los registros.
                    </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

    