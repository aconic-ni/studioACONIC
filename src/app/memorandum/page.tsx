
"use client";
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search, Download, Eye, Calendar as CalendarIcon, MessageSquare, Info as InfoIcon, AlertCircle, CheckCircle2, FileText as FileTextIcon, ListCollapse, ArrowLeft, CheckSquare as CheckSquareIcon, MessageSquareText, RotateCw, AlertTriangle, ShieldCheck, Trash2, FileSignature, Briefcase, User as UserIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp as FirestoreTimestamp, doc, getDoc, orderBy, updateDoc, serverTimestamp, addDoc, getCountFromServer, writeBatch, deleteDoc, type QueryConstraint, setDoc } from 'firebase/firestore';
import type { SolicitudRecord, CommentRecord, ValidacionRecord, DeletionAuditEvent, AppUser } from '@/types';
import { downloadExcelFileFromTable } from '@/lib/fileExporterdatabasePay';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { MemorandumDetailView } from '@/components/memorandum/MemorandumDetailView';

type SearchType = "dateToday" | "dateSpecific" | "dateRange" | "dateCurrentMonth";

const URGENT_KEYWORDS_LOWER = ["urgente", "urgent", "urge", "apoyo", "apoyar"];


const formatCurrencyFetched = (amount?: number | string | null, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num) && typeof amount === 'string' && amount.trim() === '') return 'N/A';
    if (isNaN(num)) return String(amount);

    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';
    return `${prefix}${num.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface SearchResultsTableProps {
  solicitudes: SolicitudRecord[];
  searchType: SearchType;
  searchTerm?: string;
  currentUserRole?: string;
  onUpdateRHStatus: (solicitudId: string, newStatus: string, otherDetails?: string) => Promise<void>;
  onViewDetails: (solicitud: SolicitudRecord) => void;
  onOpenCommentsDialog: (solicitudId: string) => void;
  onDeleteSolicitud: (solicitudId: string) => void; 
  onRefreshSearch: () => void;
  filterSolicitudIdInput: string;
  setFilterSolicitudIdInput: (value: string) => void;
  filterNEInput: string;
  setFilterNEInput: (value: string) => void;
  filterFechaSolicitudInput: string;
  setFilterFechaSolicitudInput: (value: string) => void;
  filterMontoInput: string;
  setFilterMontoInput: (value: string) => void;
  filterConsignatarioInput: string;
  setFilterConsignatarioInput: (value: string) => void;
  filterGuardadoPorInput: string;
  setFilterGuardadoPorInput: (value: string) => void;
}

const SearchResultsTable: React.FC<SearchResultsTableProps> = ({
  solicitudes,
  searchType,
  searchTerm,
  currentUserRole,
  onUpdateRHStatus,
  onViewDetails,
  onOpenCommentsDialog,
  onDeleteSolicitud, 
  onRefreshSearch,
  filterSolicitudIdInput,
  setFilterSolicitudIdInput,
  filterNEInput,
  setFilterNEInput,
  filterFechaSolicitudInput,
  setFilterFechaSolicitudInput,
  filterMontoInput,
  setFilterMontoInput,
  filterConsignatarioInput,
  setFilterConsignatarioInput,
  filterGuardadoPorInput,
  setFilterGuardadoPorInput,
}) => {
  const { user } = useAuth();
  const [otherDetails, setOtherDetails] = useState<{ [key: string]: string }>({});

  const handleStatusChange = (solicitudId: string, newStatus: string) => {
    if (newStatus === 'otros') {
      // If 'otros' is selected, wait for input in the details field
      // The actual update will be triggered by a button next to the input
    } else {
      onUpdateRHStatus(solicitudId, newStatus);
    }
  };

  const handleOtherDetailsChange = (solicitudId: string, details: string) => {
    setOtherDetails(prev => ({ ...prev, [solicitudId]: details }));
  };

  const handleUpdateOtherStatus = (solicitudId: string) => {
    const details = otherDetails[solicitudId];
    if (details) {
      onUpdateRHStatus(solicitudId, 'otros', details);
    }
  };

  if (!solicitudes || solicitudes.length === 0) {
    let message = "No se encontraron memorandos para los criterios ingresados.";
    if (searchType === "dateToday") message = "No se encontraron memorandos para hoy."
    else if (searchType === "dateCurrentMonth") message = "No se encontraron memorandos para el mes actual."
    return <p className="text-muted-foreground text-center py-4">{message}</p>;
  }

  const getTitle = () => {
    if (searchType === "dateToday") return `Memorandos de Hoy (${format(new Date(), "PPP", { locale: es })})`;
    if (searchType === "dateCurrentMonth") return `Memorandos del Mes Actual (${format(new Date(), "MMMM yyyy", { locale: es })})`;
    if (searchType === "dateSpecific" && searchTerm) return `Memorandos del ${searchTerm}`;
    if (searchType === "dateRange" && searchTerm) return `Memorandos para ${searchTerm}`;
    return "Memorandos Encontrados";
  };
  
  const isGuardadoPorFilterDisabled = currentUserRole === 'autorevisor' || currentUserRole === 'autorevisor_plus';

  return (
    <Card className="mt-6 w-full custom-shadow">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">{getTitle()}</CardTitle>
        <CardDescription className="text-muted-foreground">Se encontraron {solicitudes.length} memorando(s) asociados.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto table-container rounded-lg border">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={onRefreshSearch} className="h-6 w-6 p-0 mr-1">
                        <RotateCw className="h-4 w-4 text-primary" />
                    </Button>
                    Acciones
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Colaborador(es)
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Fecha
                  <Input
                    type="text"
                    placeholder="Filtrar Fecha (dd/MM/yy)..."
                    value={filterFechaSolicitudInput}
                    onChange={(e) => setFilterFechaSolicitudInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Monto
                  <Input
                    type="text"
                    placeholder="Filtrar Monto..."
                    value={filterMontoInput}
                    onChange={(e) => setFilterMontoInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Consignatario
                  <Input
                    type="text"
                    placeholder="Filtrar Consignatario..."
                    value={filterConsignatarioInput}
                    onChange={(e) => setFilterConsignatarioInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Guardado Por
                  <Input
                    type="text"
                    placeholder={isGuardadoPorFilterDisabled ? "Filtrado por rol" : "Filtrar Guardado Por..."}
                    value={filterGuardadoPorInput}
                    onChange={(e) => setFilterGuardadoPorInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    disabled={isGuardadoPorFilterDisabled}
                    readOnly={isGuardadoPorFilterDisabled}
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  NE
                  <Input
                    type="text"
                    placeholder="Filtrar NE..."
                    value={filterNEInput}
                    onChange={(e) => setFilterNEInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  ID Solicitud
                  <Input
                    type="text"
                    placeholder="Filtrar ID..."
                    value={filterSolicitudIdInput}
                    onChange={(e) => setFilterSolicitudIdInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-y divide-border">
              {solicitudes.map((solicitud) => {
                const isUrgent = solicitud.hasOpenUrgentComment;

                let rowClass = 'hover:bg-muted/50 dark:hover:bg-muted/80';
                if (isUrgent) {
                  rowClass = 'bg-red-200 hover:bg-red-300 dark:bg-red-600/40 dark:hover:bg-red-600/50';
                }

                return (
                <TableRow
                  key={solicitud.solicitudId}
                  className={cn(rowClass)}
                >
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-1">
                        {currentUserRole === 'admin' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onDeleteSolicitud(solicitud.solicitudId)}
                                  className="px-2 py-1 h-auto text-destructive hover:bg-destructive/10"
                                  aria-label="Eliminar Solicitud"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar Memorando</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewDetails(solicitud)}
                                className="px-2 py-1 h-auto"
                                aria-label="Ver Detalles"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ver Detalles</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenCommentsDialog(solicitud.solicitudId)}
                                className="px-2 py-1 h-auto"
                                aria-label="Comentarios"
                              >
                                <MessageSquareText className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Comentarios</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge variant="secondary" className="h-6 min-w-[1.5rem] flex items-center justify-center px-1.5 py-0.5 text-xs">
                          {solicitud.commentsCount ?? 0}
                        </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {(solicitud.memorandumCollaborators && solicitud.memorandumCollaborators.length > 0) ? (
                      <div className="flex items-center">
                        <UserIcon className="h-4 w-4 mr-2" />
                        {solicitud.memorandumCollaborators[0].name}
                        {solicitud.memorandumCollaborators.length > 1 && (
                            <Badge variant="secondary" className="ml-2">+{solicitud.memorandumCollaborators.length - 1}</Badge>
                        )}
                      </div>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {solicitud.examDate instanceof Date
                      ? format(solicitud.examDate, "dd/MM/yy", { locale: es })
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{formatCurrencyFetched(solicitud.monto ?? undefined, solicitud.montoMoneda || undefined)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {solicitud.consignatario && solicitud.consignatario.length > 21 ? (
                        <div className="flex items-center space-x-1">
                        <span>{`${solicitud.consignatario.substring(0, 21)}...`}</span>
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                <InfoIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs break-words">
                                <p>{solicitud.consignatario}</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        </div>
                    ) : (
                        solicitud.consignatario || 'N/A'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                     <div className="flex items-center space-x-1">
                        <span>{solicitud.savedBy || 'N/A'}</span>
                        {solicitud.savedAt && solicitud.savedAt instanceof Date && (
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                                <p>Guardado el:</p>
                                <p>{format(solicitud.savedAt, "Pp", { locale: es })}</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{solicitud.examNe}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{solicitud.solicitudId}</TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default function MemorandumPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [searchType, setSearchType] = useState<SearchType>("dateToday");
  const [searchTermText, setSearchTermText] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [datePickerStartDate, setDatePickerStartDate] = useState<Date | undefined>(undefined);
  const [datePickerEndDate, setDatePickerEndDate] = useState<Date | undefined>(undefined);

  const [isSpecificDatePopoverOpen, setIsSpecificDatePopoverOpen] = useState(false);
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);


  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedSolicitudes, setFetchedSolicitudes] = useState<SolicitudRecord[] | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [currentSearchTermForDisplay, setCurrentSearchTermForDisplay] = useState('');


  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [currentSolicitudIdForComments, setCurrentSolicitudIdForComments] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isNewCommentUrgent, setIsNewCommentUrgent] = useState(false);


  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [solicitudToDeleteId, setSolicitudToDeleteId] = useState<string | null>(null);


  const [filterSolicitudIdInput, setFilterSolicitudIdInput] = useState('');
  const [filterNEInput, setFilterNEInput] = useState('');
  const [filterFechaSolicitudInput, setFilterFechaSolicitudInput] = useState('');
  const [filterMontoInput, setFilterMontoInput] = useState('');
  const [filterConsignatarioInput, setFilterConsignatarioInput] = useState('');
  const [filterGuardadoPorInput, setFilterGuardadoPorInput] = useState('');


  const [solicitudToViewInline, setSolicitudToViewInline] = useState<SolicitudRecord | null>(null);
  const [isDetailViewVisible, setIsDetailViewVisible] = useState(false);

  const [isExporting, setIsExporting] = useState(false);


  useEffect(() => {
    setIsClient(true);
    if (!authLoading && user) {
      const isAllowed = user.hasPaymentAccess || user.role === 'admin' || user.role === 'calificador';
      if (!isAllowed) {
        toast({
          title: "Acceso Denegado",
          description: "No tiene permisos para acceder a esta plataforma.",
          variant: "destructive",
          duration: 5000 
        });
        router.push('/');
      }
    }
  }, [authLoading, user, router, toast]);


  const handleViewDetailsInline = (solicitud: SolicitudRecord) => {
    setSolicitudToViewInline(solicitud);
    setIsDetailViewVisible(true);
  };

  const handleBackToTable = () => {
    setIsDetailViewVisible(false);
    setSolicitudToViewInline(null);
  };


  const displayedSolicitudes = useMemo(() => {
    if (!fetchedSolicitudes) return null;
    let accumulatedData = [...fetchedSolicitudes];

    const applyFilter = (
        data: SolicitudRecord[],
        filterValue: string,
        filterFn: (item: SolicitudRecord, searchTerm: string) => boolean
    ): SolicitudRecord[] => {
        if (!filterValue.trim()) return data;
        const searchTerm = filterValue.toLowerCase().trim();
        return data.filter(item => filterFn(item, searchTerm));
    };

    accumulatedData = applyFilter(accumulatedData, filterSolicitudIdInput, (s, term) =>
        s.solicitudId.toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterFechaSolicitudInput, (s, term) => {
        const dateText = s.examDate && s.examDate instanceof Date ? format(s.examDate, "dd/MM/yy", { locale: es }) : 'N/A';
        return dateText.toLowerCase().includes(term);
    });
    accumulatedData = applyFilter(accumulatedData, filterNEInput, (s, term) =>
        (s.examNe || '').toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterMontoInput, (s, term) => {
        const montoText = formatCurrencyFetched(s.monto ?? undefined, s.montoMoneda || undefined);
        return montoText.toLowerCase().includes(term);
    });
    accumulatedData = applyFilter(accumulatedData, filterConsignatarioInput, (s, term) =>
        (s.consignatario || '').toLowerCase().includes(term)
    );

    if (user?.role !== 'autorevisor' && user?.role !== 'autorevisor_plus') {
      accumulatedData = applyFilter(accumulatedData, filterGuardadoPorInput, (s, term) =>
        (s.savedBy || '').toLowerCase().includes(term)
      );
    }
    
    return accumulatedData;
  }, [
    fetchedSolicitudes,
    filterSolicitudIdInput,
    filterFechaSolicitudInput,
    filterNEInput,
    filterMontoInput,
    filterConsignatarioInput,
    filterGuardadoPorInput,
    user?.role,
  ]);

  const handleUpdateRHStatus = useCallback(async (solicitudId: string, newStatus: string, otherDetails?: string) => {
    if (!user || !user.email) {
        toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
        return;
    }
    const docRef = doc(db, "Memorandum", solicitudId);
    try {
        const updateData: { [key: string]: any } = {
            rhPaymentStatus: newStatus,
            rhStatusLastUpdatedAt: serverTimestamp(),
            rhStatusLastUpdatedBy: user.email,
        };
        if (newStatus === 'otros' && otherDetails) {
            updateData.rhPaymentOtherDetails = otherDetails;
        }
        await updateDoc(docRef, updateData);
        toast({ title: "Éxito", description: `Estado de RH actualizado para ${solicitudId}.` });
        
        setFetchedSolicitudes(prev =>
            prev?.map(s =>
                s.solicitudId === solicitudId
                    ? { ...s, rhPaymentStatus: newStatus, rhPaymentOtherDetails: otherDetails ?? s.rhPaymentOtherDetails }
                    : s
            ) || null
        );
    } catch (err) {
        console.error("Error updating RH status: ", err);
        toast({ title: "Error", description: "No se pudo actualizar el estado de RH.", variant: "destructive" });
    }
  }, [user, toast]);

  const openCommentsDialog = async (solicitudId: string) => {
    setCurrentSolicitudIdForComments(solicitudId);
    setIsNewCommentUrgent(false); 
    setComments([]);
    setIsLoadingComments(true);
    setIsCommentsDialogOpen(true);

    const collectionName = "Memorandum";

    try {
      const commentsCollectionRef = collection(db, collectionName, solicitudId, "comments");
      const q = query(commentsCollectionRef, orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedComments = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof FirestoreTimestamp ? data.createdAt.toDate() : new Date(),
        } as CommentRecord;
      });
      setComments(fetchedComments);
    } catch (err) {
      console.error("Error fetching comments: ", err);
      toast({ title: "Error", description: "No se pudieron cargar los comentarios.", variant: "destructive" });
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const closeCommentsDialog = () => {
    setIsCommentsDialogOpen(false);
    setCurrentSolicitudIdForComments(null);
    setNewCommentText('');
    setIsNewCommentUrgent(false);
    setComments([]);
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim() || !currentSolicitudIdForComments || !user || !user.email) {
      toast({
        title: "Error",
        description: "El comentario no puede estar vacío o falta información del usuario/solicitud.",
        variant: "destructive",
      });
      return;
    }
    setIsPostingComment(true);

    const collectionName = "Memorandum";

    try {
      const commentsCollectionRef = collection(db, collectionName, currentSolicitudIdForComments, "comments");
      const newCommentData: Omit<CommentRecord, 'id' | 'createdAt'> & { createdAt: any } = {
        solicitudId: currentSolicitudIdForComments,
        text: newCommentText.trim(),
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
      };
      const docRefComment = await addDoc(commentsCollectionRef, newCommentData);

      let newHasOpenUrgentCommentFlag: boolean | undefined = undefined;
      if (isNewCommentUrgent) { 
        const solicitudDocRef = doc(db, collectionName, currentSolicitudIdForComments);
        await updateDoc(solicitudDocRef, { hasOpenUrgentComment: true });
        newHasOpenUrgentCommentFlag = true;
      }

      setComments(prev => [...prev, { ...newCommentData, id: docRefComment.id, createdAt: new Date() } as CommentRecord]);
      setNewCommentText('');
      setIsNewCommentUrgent(false); 
      toast({ title: "Éxito", description: "Comentario publicado." });

      setFetchedSolicitudes(prevSolicitudes =>
        prevSolicitudes?.map(s => {
          if (s.solicitudId === currentSolicitudIdForComments) {
            const updatedSol: SolicitudRecord = { ...s, commentsCount: (s.commentsCount ?? 0) + 1 };
            if (newHasOpenUrgentCommentFlag !== undefined) {
              updatedSol.hasOpenUrgentComment = newHasOpenUrgentCommentFlag;
            }
            return updatedSol;
          }
          return s;
        }) || null
      );

    } catch (err) {
      console.error("Error posting comment: ", err);
      toast({ title: "Error", description: "No se pudo publicar el comentario.", variant: "destructive" });
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteSolicitudRequest = (id: string) => {
    if (user?.role !== 'admin') {
      toast({ title: "Error", description: "No tiene permisos para eliminar memorandos.", variant: "destructive" });
      return;
    }
    setSolicitudToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSolicitud = async () => {
    if (!solicitudToDeleteId || user?.role !== 'admin' || !user.email) {
      toast({ title: "Error", description: "No se pudo eliminar el memorando o acción no autorizada.", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      return;
    }

    const collectionName = "Memorandum";

    const originalDocRef = doc(db, collectionName, solicitudToDeleteId);

    try {
      const originalDocSnap = await getDoc(originalDocRef);
      if (!originalDocSnap.exists()) {
        toast({ title: "Error", description: `El memorando ${solicitudToDeleteId} no existe.`, variant: "destructive" });
        setIsDeleteDialogOpen(false);
        return;
      }

      const originalData = originalDocSnap.data();

      // Prepare data for Eliminaciones collection (direct copy of original data)
      const eliminacionDocRef = doc(db, "Eliminaciones", solicitudToDeleteId);

      // Prepare data for AuditTrail subcollection
      const auditEventRef = doc(collection(db, "Eliminaciones", solicitudToDeleteId, "AuditTrail"));
      const auditEventData: Omit<DeletionAuditEvent, 'id' | 'deletedAt'> & { deletedAt: any } = {
        action: 'deleted',
        deletedBy: user.email,
        deletedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(eliminacionDocRef, originalData); // Store the full original document
      batch.set(auditEventRef, auditEventData);   // Store the audit event in subcollection
      batch.delete(originalDocRef);               // Delete original document

      await batch.commit();

      toast({ title: "Éxito", description: `Memorando ${solicitudToDeleteId} eliminado y archivado.` });
      setFetchedSolicitudes(prev => prev ? prev.filter(s => s.solicitudId !== solicitudToDeleteId) : null);

    } catch (err) {
      console.error("Error deleting and archiving memorandum:", err);
      toast({ title: "Error", description: "No se pudo completar la eliminación y archivado.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setSolicitudToDeleteId(null);
    }
  };


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !authLoading && user?.email) {
      if (user.role === 'autorevisor') {
        setFilterGuardadoPorInput(user.email);
      } else if (user.role === 'autorevisor_plus') {
        const colleagueEmails = user.canReviewUserEmails && user.canReviewUserEmails.length > 0 
          ? `, ${user.canReviewUserEmails.join(', ')}` 
          : '';
        setFilterGuardadoPorInput(`${user.email}${colleagueEmails}`);
      }
    }
  }, [isClient, authLoading, user]);

  const handleSearch = async (actionConfig?: { event?: FormEvent, preserveFilters?: boolean }) => {
    const event = actionConfig?.event;
    const preserveFilters = actionConfig?.preserveFilters ?? false;

    if (event) {
      event.preventDefault();
    }

    if (!user) {
      toast({ title: "No autenticado", description: "Debe iniciar sesión para buscar.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);
    setFetchedSolicitudes(null);
    setCurrentSearchTermForDisplay('');
    setIsDetailViewVisible(false);
    setSolicitudToViewInline(null);

    if (!preserveFilters) {
      setFilterSolicitudIdInput('');
      setFilterFechaSolicitudInput('');
      setFilterNEInput('');
      setFilterMontoInput('');
      setFilterConsignatarioInput('');
      if (user?.role !== 'autorevisor' && user?.role !== 'autorevisor_plus') {
        setFilterGuardadoPorInput('');
      }
    }


    const collectionRef = collection(db, "Memorandum");
    let termForDisplay = searchTermText.trim();
    const queryConstraints: QueryConstraint[] = [];

    queryConstraints.push(orderBy("examDate", "desc"));

    if (user?.email) {
        if (user.role === 'autorevisor') {
            queryConstraints.push(where("savedBy", "==", user.email));
        } else if (user.visibilityGroup && user.visibilityGroup.length > 0) {
            // Fetch emails for the group UIDs
            try {
                const usersQuery = query(collection(db, "users"), where('uid', 'in', user.visibilityGroup));
                const userDocs = await getDocs(usersQuery);
                const groupEmails = userDocs.docs.map(d => d.data().email).filter(Boolean);
                if(groupEmails.length > 0) {
                    queryConstraints.push(where("savedBy", "in", groupEmails));
                } else {
                     queryConstraints.push(where("savedBy", "==", user.email));
                }
            } catch (e) {
                console.error("Error fetching group member emails", e);
                // Fallback to user's own email if group fetch fails
                queryConstraints.push(where("savedBy", "==", user.email));
            }

        } else if (user.role === 'autorevisor_plus' && user.canReviewUserEmails && user.canReviewUserEmails.length > 0) {
            const emailsToQuery = [user.email, ...user.canReviewUserEmails];
            queryConstraints.push(where("savedBy", "in", emailsToQuery));
        } else if (user.role === 'autorevisor_plus' && (!user.canReviewUserEmails || user.canReviewUserEmails.length === 0)) {
            queryConstraints.push(where("savedBy", "==", user.email));
        }
    }


    try {
      switch (searchType) {
        case "dateToday":
          const todayStart = startOfDay(new Date());
          const todayEnd = endOfDay(new Date());
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(todayStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(todayEnd)));
          termForDisplay = format(new Date(), "PPP", { locale: es });
          break;
        case "dateCurrentMonth":
          const monthStart = startOfMonth(new Date());
          const monthEnd = endOfMonth(new Date());
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(monthStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(monthEnd)));
          termForDisplay = format(new Date(), "MMMM yyyy", { locale: es });
          break;
        case "dateSpecific":
          if (!selectedDate) { setError("Por favor, seleccione una fecha específica."); setIsLoading(false); return; }
          const specificDayStart = startOfDay(selectedDate);
          const specificDayEnd = endOfDay(selectedDate);
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(specificDayStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(specificDayEnd)));
          termForDisplay = format(selectedDate, "PPP", { locale: es });
          break;
        case "dateRange":
          if (!datePickerStartDate || !datePickerEndDate) { setError("Por favor, seleccione un rango de fechas (inicio y fin)."); setIsLoading(false); return; }
          if (datePickerStartDate > datePickerEndDate) { setError("La fecha de inicio no puede ser posterior a la fecha de fin."); setIsLoading(false); return; }
          const rangeStart = startOfDay(datePickerStartDate);
          const rangeEnd = endOfDay(datePickerEndDate);
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(rangeStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(rangeEnd)));
          termForDisplay = `Rango: ${format(datePickerStartDate, "dd/MM/yy", { locale: es })} - ${format(datePickerEndDate, "dd/MM/yy", { locale: es })}`;
          break;
        default:
          setError("Tipo de búsqueda no válido."); setIsLoading(false); return;
      }

      setCurrentSearchTermForDisplay(termForDisplay);

      const q = query(collectionRef, ...queryConstraints);

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const dataPromises = querySnapshot.docs.map(async (docSnap) => {
          const docData = docSnap.data();
          const examDateValue = docData.examDate instanceof FirestoreTimestamp ? docData.examDate.toDate() : (docData.examDate instanceof Date ? docData.examDate : undefined);
          const savedAtValue = docData.savedAt instanceof FirestoreTimestamp ? docData.savedAt.toDate() : (docData.savedAt instanceof Date ? docData.savedAt : undefined);
          const rhPaymentDate = docData.rhPaymentDate instanceof FirestoreTimestamp ? docData.rhPaymentDate.toDate() : (docData.rhPaymentDate instanceof Date ? docData.rhPaymentDate : undefined);
          const rhPaymentStartDate = docData.rhPaymentStartDate instanceof FirestoreTimestamp ? docData.rhPaymentStartDate.toDate() : (docData.rhPaymentStartDate instanceof Date ? docData.rhPaymentStartDate : undefined);
          const rhPaymentEndDate = docData.rhPaymentEndDate instanceof FirestoreTimestamp ? docData.rhPaymentEndDate.toDate() : (docData.rhPaymentEndDate instanceof Date ? docData.rhPaymentEndDate : undefined);


          let commentsCount = 0;
          try {
            const commentsColRef = collection(db, "Memorandum", docSnap.id, "comments");
            const commentsSnapshot = await getCountFromServer(commentsColRef);
            commentsCount = commentsSnapshot.data().count;
          } catch (countError) {
            console.error(`Error fetching comments count for ${docSnap.id}: `, countError);
          }

          return {
            ...docData,
            solicitudId: docSnap.id,
            examDate: examDateValue,
            savedAt: savedAtValue,
            monto: docData.monto ?? null,
            montoMoneda: docData.montoMoneda || null,
            cantidadEnLetras: docData.cantidadEnLetras || null,
            consignatario: docData.consignatario || null,
            declaracionNumero: docData.declaracionNumero || null,
            unidadRecaudadora: docData.unidadRecaudadora || null,
            codigo1: docData.codigo1 || null,
            codigo2: docData.codigo2 || null,
            banco: docData.banco || null,
            bancoOtros: docData.bancoOtros || null,
            numeroCuenta: docData.numeroCuenta || null,
            monedaCuenta: docData.monedaCuenta || null,
            monedaCuentaOtros: docData.monedaCuentaOtros || null,
            elaborarChequeA: docData.elaborarChequeA || null,
            elaborarTransferenciaA: docData.elaborarTransferenciaA || null,
            impuestosPagadosCliente: docData.impuestosPagadosCliente ?? false,
            impuestosPagadosRC: docData.impuestosPagadosRC || null,
            impuestosPagadosTB: docData.impuestosPagadosTB || null,
            impuestosPagadosCheque: docData.impuestosPagadosCheque || null,
            impuestosPendientesCliente: docData.impuestosPendientesCliente ?? false,
            soporte: docData.soporte ?? false,
            documentosAdjuntos: docData.documentosAdjuntos ?? false,
            constanciasNoRetencion: docData.constanciasNoRetencion ?? false,
            constanciasNoRetencion1: docData.constanciasNoRetencion1 ?? false,
            constanciasNoRetencion2: docData.constanciasNoRetencion2 ?? false,
            pagoServicios: docData.pagoServicios ?? false,
            tipoServicio: docData.tipoServicio || null,
            otrosTipoServicio: docData.otrosTipoServicio || null,
            facturaServicio: docData.facturaServicio || null,
            institucionServicio: docData.institucionServicio || null,
            correo: docData.correo || null,
            observation: docData.observation || null,
            savedBy: docData.savedBy || null,
            commentsCount: commentsCount,
            hasOpenUrgentComment: docData.hasOpenUrgentComment ?? false,
            isMemorandum: docData.isMemorandum ?? false,
            memorandumCollaborators: docData.memorandumCollaborators || [],
            rhPaymentStatus: docData.rhPaymentStatus || null,
            rhPaymentOtherDetails: docData.rhPaymentOtherDetails || null,
            rhPaymentDate: rhPaymentDate,
            rhPaymentStartDate: rhPaymentStartDate,
            rhPaymentEndDate: rhPaymentEndDate,
            rhStatusLastUpdatedBy: docData.rhStatusLastUpdatedBy || null,
            rhStatusLastUpdatedAt: docData.rhStatusLastUpdatedAt ? (docData.rhStatusLastUpdatedAt as FirestoreTimestamp).toDate() : undefined,
          } as SolicitudRecord;
        });

        const data = await Promise.all(dataPromises);
        setFetchedSolicitudes(data);
      } else { setError("No se encontraron memorandos para los criterios ingresados."); }

    } catch (err: any) {
      console.error("Error fetching documents from Firestore: ", err);
      let userFriendlyError = "Error al buscar los memorandos. Intente de nuevo.";
      if (err.code === 'permission-denied') {
        userFriendlyError = "No tiene permisos para acceder a esta información.";
      } else if (err.code === 'failed-precondition' || (err.message && err.message.toLowerCase().includes('index'))) {
            userFriendlyError = "Error de consulta: Es posible que se requiera un índice compuesto en Firestore que no existe. Por favor, revise la consola del navegador para ver un enlace que permita crear el índice necesario.";
            toast({ title: "Índice Requerido", description: "Es posible que necesite crear un índice compuesto en Firestore. Revise la consola del navegador (F12) para más detalles.", variant: "destructive", duration: 10000 });
      }
      setError(userFriendlyError);
    } finally { setIsLoading(false); }
  };

  const handleExport = async () => {
    const dataToUse = displayedSolicitudes || [];
    if (dataToUse.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos para exportar. Realice una búsqueda primero.", variant: "default" });
      return;
    }
    setIsExporting(true);
    toast({ title: "Exportando...", description: "Preparando datos para Excel, esto puede tardar unos segundos...", duration: 10000 });

    const headers = [
      "Estado Pago (RH)", "ID Solicitud", "Fecha", "NE", "Monto", "Moneda Monto", "Consignatario", "Declaracion", "Referencia", "Guardado Por",
      "Cantidad en Letras", "Destinatario Solicitud",
      "Unidad Recaudadora", "Código 1", "Codigo MUR", "Banco", "Otro Banco", "Número de Cuenta", "Moneda de la Cuenta", "Otra Moneda Cuenta",
      "Elaborar Cheque A", "Elaborar Transferencia A",
      "Impuestos Pagados Cliente", "R/C (Imp. Pagados)", "T/B (Imp. Pagados)", "Cheque (Imp. Pagados)",
      "Impuestos Pendientes Cliente", "Soporte", "Documentos Adjuntos",
      "Constancias de No Retención", "Constancia 1%", "Constancia 2%",
      "Pago de Servicios", "Tipo de Servicio", "Otro Tipo de Servicio", "Factura Servicio", "Institución Servicio",
      "Correo Notificación", "Observación", "Usuario (De)",
      "Fecha de Guardado", "Comentarios", "Comentario Urgente Abierto"
    ];

    const dataToExportPromises = dataToUse.map(async (s) => {
      let commentsString = 'N/A';
      if (s.commentsCount && s.commentsCount > 0) {
        try {
            const commentsCollectionRef = collection(db, "Memorandum", s.solicitudId, "comments");
            const q = query(commentsCollectionRef, orderBy("createdAt", "asc"));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
            commentsString = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                const createdAt = data.createdAt instanceof FirestoreTimestamp ? data.createdAt.toDate() : new Date();
                return `${data.userEmail} - ${format(createdAt, "dd/MM/yy HH:mm", { locale: es })}: ${data.text}`;
            }).join("\n");
            }
        } catch (err) {
            console.error(`Error fetching comments for ${s.solicitudId}: `, err);
            commentsString = 'Error al cargar comentarios';
        }
      } else if (s.commentsCount === 0) {
        commentsString = 'Sin comentarios';
      }
      
      const rhStatusMap: { [key: string]: string } = {
          'caso_no_iniciado': 'Caso no iniciado',
          'pagado_efectivo': 'Pagado Efectivo',
          'proceso_deduccion': 'En Proceso de Deducción',
          'otros': `Otros: ${s.rhPaymentOtherDetails || 'N/A'}`,
      };
      const rhStatusText = s.isMemorandum ? (rhStatusMap[s.rhPaymentStatus || ''] || 'En Trámite RH') : 'N/A';


      return {
        "Estado Pago (RH)": rhStatusText,
        "ID Solicitud": s.solicitudId,
        "Fecha": s.examDate instanceof Date ? format(s.examDate, "yyyy-MM-dd HH:mm", { locale: es }) : 'N/A',
        "NE": s.examNe,
        "Monto": s.monto,
        "Moneda Monto": s.montoMoneda,
        "Consignatario": s.consignatario || 'N/A',
        "Declaracion": s.declaracionNumero || 'N/A',
        "Referencia": s.examReference || 'N/A',
        "Guardado Por": s.savedBy || 'N/A',

        "Cantidad en Letras": s.cantidadEnLetras || 'N/A',
        "Destinatario Solicitud": s.examRecipient,
        "Unidad Recaudadora": s.unidadRecaudadora || 'N/A',
        "Código 1": s.codigo1 || 'N/A',
        "Codigo MUR": s.codigo2 || 'N/A',
        "Banco": s.banco === 'ACCION POR CHEQUE/NO APLICA BANCO' ? 'Acción por Cheque / No Aplica Banco' : s.banco || 'N/A',
        "Otro Banco": s.banco === 'Otros' ? (s.bancoOtros || 'N/A') : 'N/A',
        "Número de Cuenta": s.banco === 'ACCION POR CHEQUE/NO APLICA BANCO' ? 'N/A' : s.numeroCuenta || 'N/A',
        "Moneda de la Cuenta": s.banco === 'ACCION POR CHEQUE/NO APLICA BANCO' ? 'N/A' : (s.monedaCuenta === 'Otros' ? (s.monedaCuentaOtros || 'N/A') : s.monedaCuenta || 'N/A'),
        "Otra Moneda Cuenta": s.monedaCuenta === 'Otros' ? (s.monedaCuentaOtros || 'N/A') : 'N/A',
        "Elaborar Cheque A": s.elaborarChequeA || 'N/A',
        "Elaborar Transferencia A": s.elaborarTransferenciaA || 'N/A',
        "Impuestos Pagados Cliente": s.impuestosPagadosCliente ? 'Sí' : 'No',
        "R/C (Imp. Pagados)": s.impuestosPagadosCliente ? (s.impuestosPagadosRC || 'N/A') : 'N/A',
        "T/B (Imp. Pagados)": s.impuestosPagadosCliente ? (s.impuestosPagadosTB || 'N/A') : 'N/A',
        "Cheque (Imp. Pagados)": s.impuestosPagadosCliente ? (s.impuestosPagadosCheque || 'N/A') : 'N/A',
        "Impuestos Pendientes Cliente": s.impuestosPendientesCliente ? 'Sí' : 'No',
        "Soporte": s.soporte ? 'Sí' : 'No',
        "Documentos Adjuntos": s.documentosAdjuntos ? 'Sí' : 'No',
        "Constancias de No Retención": s.constanciasNoRetencion ? 'Sí' : 'No',
        "Constancia 1%": s.constanciasNoRetencion ? (s.constanciasNoRetencion1 ? 'Sí' : 'No') : 'N/A',
        "Constancia 2%": s.constanciasNoRetencion ? (s.constanciasNoRetencion2 ? 'Sí' : 'No') : 'N/A',
        "Pago de Servicios": s.pagoServicios ? 'Sí' : 'No',
        "Tipo de Servicio": s.pagoServicios ? (s.tipoServicio === 'OTROS' ? s.otrosTipoServicio : s.tipoServicio) || 'N/A' : 'N/A',
        "Otro Tipo de Servicio": s.pagoServicios && s.tipoServicio === 'OTROS' ? s.otrosTipoServicio || 'N/A' : 'N/A',
        "Factura Servicio": s.pagoServicios ? s.facturaServicio || 'N/A' : 'N/A',
        "Institución Servicio": s.pagoServicios ? s.institucionServicio || 'N/A' : 'N/A',
        "Correo Notificación": s.correo || 'N/A',
        "Observación": s.observation || 'N/A',
        "Usuario (De)": s.examManager,
        "Fecha de Guardado": s.savedAt instanceof Date ? format(s.savedAt, "yyyy-MM-dd HH:mm", { locale: es }) : 'N/A',
        "Comentarios": commentsString,
        "Comentario Urgente Abierto": s.hasOpenUrgentComment ? 'Sí' : 'No',
      };
    });

    try {
      const dataToExport = await Promise.all(dataToExportPromises);
      downloadExcelFileFromTable(dataToExport, headers, `Reporte_Memorandos_${searchType}_${currentSearchTermForDisplay.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Exportación Completa", description: "El archivo Excel se ha descargado." });
    } catch (err) {
      console.error("Error during data export preparation: ", err);
      toast({ title: "Error de Exportación", description: "No se pudo preparar los datos para exportar.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const renderSearchInputs = () => {
    switch (searchType) {
      case "dateToday": return <p className="text-sm text-muted-foreground flex-grow items-center flex h-10">Se buscarán los memorandos de hoy.</p>;
      case "dateCurrentMonth": return <p className="text-sm text-muted-foreground flex-grow items-center flex h-10">Se buscarán los memorandos del mes actual.</p>;
      case "dateSpecific":
        return (
          <Popover open={isSpecificDatePopoverOpen} onOpenChange={setIsSpecificDatePopoverOpen}>
            <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal flex-grow", !selectedDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsSpecificDatePopoverOpen(false);
                  }}
                  initialFocus
                  locale={es}
                />
            </PopoverContent>
          </Popover>
        );
      case "dateRange":
        return (
          <div className="flex flex-col sm:flex-row gap-2 flex-grow">
            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !datePickerStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{datePickerStartDate ? format(datePickerStartDate, "dd/MM/yy", { locale: es }) : <span>Fecha Inicio</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={datePickerStartDate} onSelect={(date) => {setDatePickerStartDate(date); setIsStartDatePopoverOpen(false);}} initialFocus locale={es}/>
              </PopoverContent>
            </Popover>
            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !datePickerEndDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{datePickerEndDate ? format(datePickerEndDate, "dd/MM/yy", { locale: es }) : <span>Fecha Fin</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={datePickerEndDate} onSelect={(date) => {setDatePickerEndDate(date); setIsEndDatePopoverOpen(false);}} initialFocus locale={es}/>
              </PopoverContent>
            </Popover>
          </div>
        );
      default: return null;
    }
  };

  if (!isClient || authLoading && !fetchedSolicitudes && !isDetailViewVisible) {
    return <div className="min-h-screen flex items-center justify-center grid-bg"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>;
  }

  if (isDetailViewVisible && solicitudToViewInline) {
    return (
      <AppShell>
         <div className="py-2 md:py-5 max-w-4xl mx-auto">
            <MemorandumDetailView
              solicitud={solicitudToViewInline}
              onBackToList={handleBackToTable}
            />
        </div>
      </AppShell>
    );
  }

  const isUserAdminOrRevisor = user?.role === 'admin' || user?.role === 'revisor';
  const isUserCalificador = user?.role === 'calificador';
  const isUserAllowedToMarkUrgent = user?.role === 'autorevisor' || user?.role === 'autorevisor_plus' || user?.role === 'revisor';


  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Base de Datos de Memorandos (RH)</CardTitle>
            <CardDescription className="text-muted-foreground">Seleccione un tipo de búsqueda e ingrese los criterios.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSearch({ event: e })} className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Select value={searchType} onValueChange={(value) => { setSearchType(value as SearchType); setSearchTermText(''); setSelectedDate(undefined); setDatePickerStartDate(undefined); setDatePickerEndDate(undefined); setFetchedSolicitudes(null); setError(null); setCurrentSearchTermForDisplay(''); }}>
                  <SelectTrigger className="w-full sm:w-[200px] shrink-0"><SelectValue placeholder="Tipo de búsqueda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dateToday">Por Fecha (Hoy)</SelectItem>
                    <SelectItem value="dateSpecific">Por Fecha (Específica)</SelectItem>
                    {(isUserAdminOrRevisor || isUserCalificador) && (
                        <>
                            <SelectItem value="dateCurrentMonth">Por Mes (Actual)</SelectItem>
                            <SelectItem value="dateRange">Por Rango de Fechas</SelectItem>
                        </>
                    )}
                  </SelectContent>
                </Select>
                {renderSearchInputs()}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button type="submit" className="btn-primary w-full sm:w-auto" disabled={isLoading}><Search className="mr-2 h-4 w-4" /> {isLoading ? 'Buscando...' : 'Ejecutar Búsqueda'}</Button>
                <Button type="button" onClick={handleExport} variant="outline" className="w-full sm:w-auto" disabled={!displayedSolicitudes || isLoading || (displayedSolicitudes && displayedSolicitudes.length === 0) || isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isExporting ? 'Exportando...' : 'Exportar Tabla'}
                </Button>
              </div>
            </form>
            
            {isLoading && <div className="flex justify-center items-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Cargando memorandos...</p></div>}
            {error && <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">{error}</div>}

            {displayedSolicitudes && !isLoading && (
              <SearchResultsTable
                solicitudes={displayedSolicitudes}
                searchType={searchType}
                searchTerm={currentSearchTermForDisplay}
                currentUserRole={user?.role}
                onUpdateRHStatus={handleUpdateRHStatus}
                onViewDetails={handleViewDetailsInline}
                onOpenCommentsDialog={openCommentsDialog}
                onDeleteSolicitud={handleDeleteSolicitudRequest} 
                onRefreshSearch={() => handleSearch({ preserveFilters: true })}
                filterSolicitudIdInput={filterSolicitudIdInput}
                setFilterSolicitudIdInput={setFilterSolicitudIdInput}
                filterNEInput={filterNEInput}
                setFilterNEInput={setFilterNEInput}
                filterFechaSolicitudInput={filterFechaSolicitudInput}
                setFilterFechaSolicitudInput={setFilterFechaSolicitudInput}
                filterMontoInput={filterMontoInput}
                setFilterMontoInput={setFilterMontoInput}
                filterConsignatarioInput={filterConsignatarioInput}
                setFilterConsignatarioInput={setFilterConsignatarioInput}
                filterGuardadoPorInput={filterGuardadoPorInput}
                setFilterGuardadoPorInput={setFilterGuardadoPorInput}
              />
            )}
            {!fetchedSolicitudes && !isLoading && !error && !currentSearchTermForDisplay && <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">Seleccione un tipo de búsqueda e ingrese los criterios para ver resultados.</div>}
            {fetchedSolicitudes && fetchedSolicitudes.length === 0 && !isLoading && !error && currentSearchTermForDisplay && (
                <div className="mt-4 p-4 bg-yellow-500/10 text-yellow-700 border border-yellow-500/30 rounded-md text-center">
                    No se encontraron memorandos para los criterios de búsqueda ingresados.
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCommentsDialogOpen} onOpenChange={closeCommentsDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comentarios para Memorando ID: {currentSolicitudIdForComments}</DialogTitle>
            <DialogDescription>
              Ver y añadir comentarios para este memorando.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="h-60 overflow-y-auto border p-2 rounded-md bg-muted/20 space-y-2">
              {isLoadingComments ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="ml-2 text-sm text-muted-foreground">Cargando comentarios...</p>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay comentarios aún.</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="p-2 my-1 border-b bg-card shadow-sm rounded">
                    <div className="flex justify-between items-center mb-1">
                        <p className="font-semibold text-primary text-xs">{comment.userEmail}</p>
                        <p className="text-muted-foreground text-xs">
                            {format(comment.createdAt, "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
            <div>
              <Label htmlFor="newCommentTextarea" className="text-sm font-medium text-foreground">Nuevo Comentario:</Label>
              <Textarea
                id="newCommentTextarea"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Escriba su comentario aquí..."
                rows={3}
                className="mt-1"
                disabled={isPostingComment}
              />
            </div>
            {isUserAllowedToMarkUrgent && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="urgentCommentCheckbox"
                  checked={isNewCommentUrgent}
                  onCheckedChange={(checked) => setIsNewCommentUrgent(!!checked)}
                  disabled={isPostingComment}
                />
                <Label htmlFor="urgentCommentCheckbox" className="text-sm font-medium text-amber-700 dark:text-amber-500 cursor-pointer">
                  Indicar que la operación requiere atención especial
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCommentsDialog} disabled={isPostingComment}>Salir</Button>
            <Button onClick={handlePostComment} disabled={isPostingComment || !newCommentText.trim()}>
                {isPostingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPostingComment ? 'Publicando...' : 'Publicar Comentario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <DialogDescription>
           Estas seguro de realizar esta opción. Operacion de borrar es permanente. El memorando será archivado.
          </DialogDescription>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setSolicitudToDeleteId(null); }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteSolicitud}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
