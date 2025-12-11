
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
import { collection, query, where, getDocs, Timestamp as FirestoreTimestamp, doc, getDoc, orderBy, updateDoc, serverTimestamp, addDoc, getCountFromServer, writeBatch, deleteDoc, type QueryConstraint, setDoc, documentId } from 'firebase/firestore';
import type { SolicitudRecord, CommentRecord, ValidacionRecord, DeletionAuditEvent, AppUser } from '@/types';
import { downloadExcelFileFromTable } from '@/lib/fileExporterdatabasePay';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { SearchResultsTable } from '@/components/databasepay/SearchResultsTable';
import { DatabaseSolicitudDetailView } from '@/components/databasepay/DatabaseSolicitudDetailView';


type SearchType = "dateToday" | "dateSpecific" | "dateRange" | "dateCurrentMonth";


export default function DatabasePage() {
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


  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [currentSolicitudIdForMessage, setCurrentSolicitudIdForMessage] = useState<string | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');


  const [isMinutaDialogOpen, setIsMinutaDialogOpen] = useState(false);
  const [currentSolicitudIdForMinuta, setCurrentSolicitudIdForMinuta] = useState<string | null>(null);
  const [minutaNumberInput, setMinutaNumberInput] = useState('');
  

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [solicitudToDeleteId, setSolicitudToDeleteId] = useState<string | null>(null);


  const [filterRecpDocsInput, setFilterRecpDocsInput] = useState('');
  const [filterNotMinutaInput, setFilterNotMinutaInput] = useState('');
  const [filterSolicitudIdInput, setFilterSolicitudIdInput] = useState('');
  const [filterNEInput, setFilterNEInput] = useState('');
  const [filterEstadoPagoInput, setFilterEstadoPagoInput] = useState('');
  const [filterFechaSolicitudInput, setFilterFechaSolicitudInput] = useState('');
  const [filterMontoInput, setFilterMontoInput] = useState('');
  const [filterConsignatarioInput, setFilterConsignatarioInput] = useState('');
  const [filterDeclaracionInput, setFilterDeclaracionInput] = useState('');
  const [filterReferenciaInput, setFilterReferenciaInput] = useState('');
  const [filterGuardadoPorInput, setFilterGuardadoPorInput] = useState('');
  const [filterEstadoSolicitudInput, setFilterEstadoSolicitudInput] = useState('');


  const [solicitudToViewInModal, setSolicitudToViewInModal] = useState<SolicitudRecord | null>(null);
  
  const [isExporting, setIsExporting] = useState(false);


  const [duplicateSets, setDuplicateSets] = useState<Map<string, string[]>>(new Map());
  const [isMinutaValidationEnabled, setIsMinutaValidationEnabled] = useState(true);
  const [resolvedDuplicateKeys, setResolvedDuplicateKeys] = useState<string[]>([]);
  const [permanentlyResolvedDuplicateKeys, setPermanentlyResolvedDuplicateKeys] = useState<string[]>([]);
  
  const [isViewErrorDialogOpen, setIsViewErrorDialogOpen] = useState(false);
  const [errorMessageToView, setErrorMessageToView] = useState('');


  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleViewDetails = (solicitud: SolicitudRecord) => {
    setSolicitudToViewInModal(solicitud);
  };

  const handleCloseDetailView = () => {
    setSolicitudToViewInModal(null);
  };

  useEffect(() => {
    const fetchMinutaValidationSetting = async () => {
      if (!user) return;
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.isMinutaValidationEnabled === false) { // Explicitly check for false
          setIsMinutaValidationEnabled(false);
        }
      }
    };
    if (user) {
      fetchMinutaValidationSetting();
    }
  }, [user]);


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
    
    accumulatedData = applyFilter(accumulatedData, filterRecpDocsInput, (s, term) => {
      const statusText = s.recepcionDCStatus ? 'recibido' : 'pendiente';
      return statusText.includes(term);
    });

    accumulatedData = applyFilter(accumulatedData, filterNotMinutaInput, (s, term) => {
        const statusText = s.emailMinutaStatus ? 'notificado' : 'pendiente';
        return statusText.includes(term);
    });

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
    accumulatedData = applyFilter(accumulatedData, filterEstadoPagoInput, (s, term) =>
      (s.paymentStatus || 'pendiente').toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterMontoInput, (s, term) => {
        const montoText = String(s.monto || '');
        return montoText.toLowerCase().includes(term);
    });
    accumulatedData = applyFilter(accumulatedData, filterConsignatarioInput, (s, term) =>
        (s.consignatario || '').toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterDeclaracionInput, (s, term) =>
        (s.declaracionNumero || '').toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterReferenciaInput, (s, term) =>
        (s.examReference || '').toLowerCase().includes(term)
    );

    if (user?.role !== 'autorevisor' && user?.role !== 'autorevisor_plus') {
      accumulatedData = applyFilter(accumulatedData, filterGuardadoPorInput, (s, term) =>
        (s.savedBy || '').toLowerCase().includes(term)
      );
    }
    
    return accumulatedData;
  }, [
    fetchedSolicitudes,
    filterRecpDocsInput,
    filterNotMinutaInput,
    filterSolicitudIdInput,
    filterFechaSolicitudInput,
    filterNEInput,
    filterEstadoPagoInput,
    filterMontoInput,
    filterConsignatarioInput,
    filterDeclaracionInput,
    filterReferenciaInput,
    filterGuardadoPorInput,
    user?.role,
  ]);

  const handleUpdatePaymentStatus = useCallback(async (solicitudId: string, newPaymentStatus: string | null) => {
    if (!user || !user.email) {
        toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
        return;
    }
    const docRef = doc(db, "SolicitudCheques", solicitudId);
    try {
        await updateDoc(docRef, {
            paymentStatus: newPaymentStatus,
            paymentStatusLastUpdatedAt: serverTimestamp(),
            paymentStatusLastUpdatedBy: user.email,
        });
        toast({ title: "Éxito", description: `Estado de pago actualizado para ${solicitudId}.` });
        setFetchedSolicitudes(prev => prev ? prev.map(s => s.solicitudId === solicitudId ? { ...s, paymentStatus: newPaymentStatus } : s) : null);
    } catch (err) {
        console.error("Error updating payment status: ", err);
        toast({ title: "Error", description: "No se pudo actualizar el estado de pago.", variant: "destructive" });
    }
  }, [user, toast]);

  const handleUpdateRecepcionDCStatus = useCallback(async (solicitudId: string, status: boolean) => {
    if (!user || !user.email) return;
    const docRef = doc(db, "SolicitudCheques", solicitudId);
    try {
        await updateDoc(docRef, {
            recepcionDCStatus: status,
            recepcionDCLastUpdatedAt: serverTimestamp(),
            recepcionDCLastUpdatedBy: user.email,
        });
        setFetchedSolicitudes(prev => prev ? prev.map(s => s.solicitudId === solicitudId ? { ...s, recepcionDCStatus: status } : s) : null);
    } catch (err) { console.error(err); }
  }, [user]);

  const handleUpdateEmailMinutaStatus = useCallback(async (solicitudId: string, status: boolean) => {
    if (!user || !user.email) return;
    const docRef = doc(db, "SolicitudCheques", solicitudId);
    try {
        await updateDoc(docRef, {
            emailMinutaStatus: status,
            emailMinutaLastUpdatedAt: serverTimestamp(),
            emailMinutaLastUpdatedBy: user.email,
        });
        setFetchedSolicitudes(prev => prev ? prev.map(s => s.solicitudId === solicitudId ? { ...s, emailMinutaStatus: status } : s) : null);
    } catch (err) { console.error(err); }
  }, [user]);

  const openMessageDialog = (solicitudId: string) => {
    setCurrentSolicitudIdForMessage(solicitudId);
    setPaymentStatusMessage('');
    setIsMessageDialogOpen(true);
  };

  const handleSavePaymentStatusMessage = async () => {
    if (!currentSolicitudIdForMessage || !paymentStatusMessage.trim()) {
      toast({ title: "Error", description: "El mensaje no puede estar vacío.", variant: "destructive" });
      return;
    }
    await handleUpdatePaymentStatus(currentSolicitudIdForMessage, `Error: ${paymentStatusMessage.trim()}`);
    setIsMessageDialogOpen(false);
    setCurrentSolicitudIdForMessage(null);
  };
  
  const openMinutaDialog = (solicitudId: string) => {
    setCurrentSolicitudIdForMinuta(solicitudId);
    setMinutaNumberInput('');
    setIsMinutaDialogOpen(true);
  };

  const handleSaveMinuta = async (solicitudId: string, minutaNum?: string | null) => {
    if (!user || !user.email) return;
    const docRef = doc(db, "SolicitudCheques", solicitudId);
    try {
      await updateDoc(docRef, {
        paymentStatus: 'Pagado',
        minutaNumber: minutaNum || null,
        paymentStatusLastUpdatedAt: serverTimestamp(),
        paymentStatusLastUpdatedBy: user.email,
      });

      const updatedSolicitud = fetchedSolicitudes?.find(s => s.solicitudId === solicitudId);
      if(updatedSolicitud) {
          const updatedSol: SolicitudRecord = {...updatedSolicitud, paymentStatus: 'Pagado', minutaNumber: minutaNum || null };
          
          if(updatedSol.isMemorandum) {
              updatedSol.rhPaymentStatus = 'pagado_efectivo';
              updatedSol.rhStatusLastUpdatedAt = new Date();
              updatedSol.rhStatusLastUpdatedBy = user.email;
              updatedSol.rhPaymentDate = new Date();
          } else {
              updatedSol.emailMinutaStatus = true;
              updatedSol.emailMinutaLastUpdatedAt = new Date();
              updatedSol.emailMinutaLastUpdatedBy = user.email!;
              updatedSol.recepcionDCStatus = true;
              updatedSol.recepcionDCLastUpdatedAt = new Date();
              updatedSol.recepcionDCLastUpdatedBy = user.email!;
          }

          setFetchedSolicitudes(prev => prev ? prev.map(s => s.solicitudId === solicitudId ? updatedSol : s) : null);
      }

      toast({ title: "Éxito", description: `Estado de pago actualizado a 'Pagado' para ${solicitudId}.` });
    } catch (err) {
      console.error("Error updating minuta: ", err);
      toast({ title: "Error", description: "No se pudo actualizar la minuta.", variant: "destructive" });
    }
  };

  const handleSaveMinutaFromDialog = async () => {
    if (currentSolicitudIdForMinuta) {
      await handleSaveMinuta(currentSolicitudIdForMinuta, minutaNumberInput);
      setIsMinutaDialogOpen(false);
      setCurrentSolicitudIdForMinuta(null);
    }
  };


  const openCommentsDialog = async (solicitudId: string) => {
    setCurrentSolicitudIdForComments(solicitudId);
    setIsNewCommentUrgent(false); 
    setComments([]);
    setIsLoadingComments(true);
    setIsCommentsDialogOpen(true);

    let foundInCollection: string | null = null;
    const collectionsToTry = ["SolicitudCheques", "Memorandum"];

    for (const collectionName of collectionsToTry) {
        const docRef = doc(db, collectionName, solicitudId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            foundInCollection = collectionName;
            break;
        }
    }

    if (!foundInCollection) {
        toast({ title: "Error", description: "No se encontró la solicitud para cargar comentarios.", variant: "destructive" });
        setIsLoadingComments(false);
        return;
    }

    try {
      const commentsCollectionRef = collection(db, foundInCollection, solicitudId, "comments");
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

    let foundInCollection: string | null = null;
    const collectionsToTry = ["SolicitudCheques", "Memorandum"];

    for (const collectionName of collectionsToTry) {
        const docRef = doc(db, collectionName, currentSolicitudIdForComments);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            foundInCollection = collectionName;
            break;
        }
    }

    if (!foundInCollection) {
        toast({ title: "Error", description: "No se encontró la solicitud para añadir el comentario.", variant: "destructive" });
        setIsPostingComment(false);
        return;
    }

    try {
      const commentsCollectionRef = collection(db, foundInCollection, currentSolicitudIdForComments, "comments");
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
        const solicitudDocRef = doc(db, foundInCollection, currentSolicitudIdForComments);
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
      toast({ title: "Error", description: "No tiene permisos para eliminar solicitudes.", variant: "destructive" });
      return;
    }
    setSolicitudToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSolicitud = async () => {
    if (!solicitudToDeleteId || user?.role !== 'admin' || !user.email) {
      toast({ title: "Error", description: "No se pudo eliminar la solicitud o acción no autorizada.", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      return;
    }
    
    let foundInCollection: string | null = null;
    const collectionsToTry = ["SolicitudCheques", "Memorandum"];
    
    for (const collectionName of collectionsToTry) {
        const docRef = doc(db, collectionName, solicitudToDeleteId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            foundInCollection = collectionName;
            break;
        }
    }

    if (!foundInCollection) {
        toast({ title: "Error", description: `La solicitud ${solicitudToDeleteId} no se encontró en ninguna colección.`, variant: "destructive" });
        setIsDeleteDialogOpen(false);
        return;
    }


    const originalDocRef = doc(db, foundInCollection, solicitudToDeleteId);

    try {
      const originalDocSnap = await getDoc(originalDocRef);
      if (!originalDocSnap.exists()) {
        toast({ title: "Error", description: `La solicitud ${solicitudToDeleteId} no existe.`, variant: "destructive" });
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

      toast({ title: "Éxito", description: `Solicitud ${solicitudToDeleteId} eliminada y archivada.` });
      setFetchedSolicitudes(prev => prev ? prev.filter(s => s.solicitudId !== solicitudToDeleteId) : null);

    } catch (err) {
      console.error("Error deleting and archiving document:", err);
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

  const handleSearch = useCallback(async (actionConfig?: { event?: FormEvent, preserveFilters?: boolean }) => {
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
    setSolicitudToViewInModal(null);

    if (!preserveFilters) {
      setFilterSolicitudIdInput('');
      setFilterFechaSolicitudInput('');
      setFilterNEInput('');
      setFilterMontoInput('');
      setFilterConsignatarioInput('');
      setFilterDeclaracionInput('');
      setFilterReferenciaInput('');
      if (user?.role !== 'autorevisor' && user?.role !== 'autorevisor_plus') {
        setFilterGuardadoPorInput('');
      }
      setFilterEstadoPagoInput('');
      setFilterRecpDocsInput('');
      setFilterNotMinutaInput('');
      setFilterEstadoSolicitudInput('');
    }
    
    let allSolicitudes: SolicitudRecord[] = [];
    const collectionsToQuery = ["SolicitudCheques", "Memorandum"];
    
    try {
        // --- Visibility Logic ---
        let visibilityFilter: QueryConstraint | null = null;
        const globalVisibilityRoles = ['admin', 'supervisor', 'calificador'];
        const groupVisibilityRoles = ['ejecutivo', 'revisor', 'autorevisor_plus', 'coordinadora'];

        if (user.role && groupVisibilityRoles.includes(user.role)) {
            const groupEmails = Array.from(new Set([user.email, ...(user.visibilityGroup?.map(m => m.email) || [])])).filter(Boolean) as string[];
             if (groupEmails.length > 0) {
                visibilityFilter = where("savedBy", "in", groupEmails);
            } else {
                visibilityFilter = where("savedBy", "==", user.email);
            }
        } else if (user.role === 'autorevisor') {
            visibilityFilter = where("savedBy", "==", user.email);
        }
        // For global roles, visibilityFilter remains null, so no user-based filtering is applied.

        // --- Date Logic ---
        let dateFilter: QueryConstraint[] = [];
        let termForDisplay = searchTermText.trim();
        switch (searchType) {
            case "dateToday":
              const todayStart = startOfDay(new Date());
              const todayEnd = endOfDay(new Date());
              dateFilter.push(where("examDate", ">=", FirestoreTimestamp.fromDate(todayStart)));
              dateFilter.push(where("examDate", "<=", FirestoreTimestamp.fromDate(todayEnd)));
              termForDisplay = format(new Date(), "PPP", { locale: es });
              break;
            case "dateCurrentMonth":
              const monthStart = startOfMonth(new Date());
              const monthEnd = endOfMonth(new Date());
              dateFilter.push(where("examDate", ">=", FirestoreTimestamp.fromDate(monthStart)));
              dateFilter.push(where("examDate", "<=", FirestoreTimestamp.fromDate(monthEnd)));
              termForDisplay = format(new Date(), "MMMM yyyy", { locale: es });
              break;
            case "dateSpecific":
              if (!selectedDate) { setError("Por favor, seleccione una fecha específica."); setIsLoading(false); return; }
              const specificDayStart = startOfDay(selectedDate);
              const specificDayEnd = endOfDay(selectedDate);
              dateFilter.push(where("examDate", ">=", FirestoreTimestamp.fromDate(specificDayStart)));
              dateFilter.push(where("examDate", "<=", FirestoreTimestamp.fromDate(specificDayEnd)));
              termForDisplay = format(selectedDate, "PPP", { locale: es });
              break;
            case "dateRange":
              if (!datePickerStartDate || !datePickerEndDate) { setError("Por favor, seleccione un rango de fechas (inicio y fin)."); setIsLoading(false); return; }
              if (datePickerStartDate > datePickerEndDate) { setError("La fecha de inicio no puede ser posterior a la fecha de fin."); setIsLoading(false); return; }
              const rangeStart = startOfDay(datePickerStartDate);
              const rangeEnd = endOfDay(datePickerEndDate);
              dateFilter.push(where("examDate", ">=", FirestoreTimestamp.fromDate(rangeStart)));
              dateFilter.push(where("examDate", "<=", FirestoreTimestamp.fromDate(rangeEnd)));
              termForDisplay = `Rango: ${format(datePickerStartDate, "dd/MM/yy", { locale: es })} - ${format(datePickerEndDate, "dd/MM/yy", { locale: es })}`;
              break;
            default:
              setError("Tipo de búsqueda no válido."); setIsLoading(false); return;
        }

        setCurrentSearchTermForDisplay(termForDisplay);
        
        for (const collectionName of collectionsToQuery) {
            const queryConstraints = [
                ...dateFilter,
                orderBy("examDate", "desc")
            ];
            if (visibilityFilter) {
                queryConstraints.unshift(visibilityFilter);
            }

            const q = query(collection(db, collectionName), ...queryConstraints);
            const querySnapshot = await getDocs(q);

            const uniqueIds = new Set<string>();
            const dataPromises = querySnapshot.docs.map(async (docSnap) => {
                 if (uniqueIds.has(docSnap.id)) return null;
                 uniqueIds.add(docSnap.id);

                 const docData = docSnap.data();
                 const examDateValue = docData.examDate instanceof FirestoreTimestamp ? docData.examDate.toDate() : (docData.examDate instanceof Date ? docData.examDate : undefined);
                 const savedAtValue = docData.savedAt instanceof FirestoreTimestamp ? docData.savedAt.toDate() : (docData.savedAt instanceof Date ? docData.savedAt : undefined);
                 const rhPaymentDate = docData.rhPaymentDate instanceof FirestoreTimestamp ? docData.rhPaymentDate.toDate() : (docData.rhPaymentDate instanceof Date ? docData.rhPaymentDate : undefined);
                 const rhPaymentStartDate = docData.rhPaymentStartDate instanceof FirestoreTimestamp ? docData.rhPaymentStartDate.toDate() : (docData.rhPaymentStartDate instanceof Date ? docData.rhPaymentStartDate : undefined);
                 const rhPaymentEndDate = docData.rhPaymentEndDate instanceof FirestoreTimestamp ? docData.rhPaymentEndDate.toDate() : (docData.rhPaymentEndDate instanceof Date ? docData.rhPaymentEndDate : undefined);

                 let commentsCount = 0;
                 try {
                     const commentsColRef = collection(db, docSnap.ref.path, "comments");
                     const commentsSnapshot = await getCountFromServer(commentsColRef);
                     commentsCount = commentsSnapshot.data().count;
                 } catch (countError) {
                     console.error(`Error fetching comments count for ${docSnap.id}: `, countError);
                 }

                 return { ...docData, solicitudId: docSnap.id, examDate: examDateValue, savedAt: savedAtValue, rhPaymentDate, rhPaymentStartDate, rhPaymentEndDate, commentsCount } as SolicitudRecord;
            });
            const data = (await Promise.all(dataPromises)).filter(Boolean) as SolicitudRecord[];
            allSolicitudes.push(...data);
        }
        
        allSolicitudes.sort((a, b) => (b.savedAt?.getTime() || 0) - (a.savedAt?.getTime() || 0));

        if (allSolicitudes.length > 0) {
            setFetchedSolicitudes(allSolicitudes);
        } else { 
            setError("No se encontraron solicitudes para los criterios ingresados."); 
            setFetchedSolicitudes([]);
        }

    } catch (err: any) {
        console.error("Error fetching documents from Firestore: ", err);
        let userFriendlyError = "Error al buscar las solicitudes. Intente de nuevo.";
        if (err.code === 'permission-denied') {
            userFriendlyError = "No tiene permisos para acceder a esta información.";
        } else if (err.code === 'failed-precondition' || (err.message && err.message.toLowerCase().includes('index'))) {
            userFriendlyError = "Error de consulta: Es posible que se requiera un índice compuesto en Firestore que no existe. Por favor, revise la consola del navegador para ver un enlace que permita crear el índice necesario.";
            toast({ title: "Índice Requerido", description: "Es posible que necesite crear un índice compuesto en Firestore. Revise la consola del navegador (F12) para más detalles.", variant: "destructive", duration: 10000 });
        }
        setError(userFriendlyError);
    } finally {
        setIsLoading(false);
    }
  }, [user, searchType, selectedDate, datePickerStartDate, datePickerEndDate, toast]);

  const handleExport = async () => {
    const dataToUse = displayedSolicitudes || [];
    if (dataToUse.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos para exportar. Realice una búsqueda primero.", variant: "default" });
      return;
    }
    setIsExporting(true);
    toast({ title: "Exportando...", description: "Preparando datos para Excel, esto puede tardar unos segundos...", duration: 10000 });

    const headers = [
      "Estado Pago", "ID Solicitud", "Fecha", "NE", "Monto", "Moneda Monto", "Consignatario", "Declaracion", "Referencia", "Guardado Por",
      "Cantidad en Letras", "Destinatario Solicitud",
      "Unidad Recaudadora", "Código 1", "Codigo MUR", "Banco", "Otro Banco", "Número de Cuenta", "Moneda de la Cuenta", "Otra Moneda Cuenta",
      "Elaborar Cheque A", "Elaborar Transferencia A",
      "Impuestos Pagados Cliente", "R/C (Imp. Pagados)", "T/B (Imp. Pagados)", "Cheque (Imp. Pagados)",
      "Impuestos Pendientes Cliente", "Soporte", "Documentos Adjuntos",
      "Constancias de No Retención", "Constancia 1%", "Constancia 2%",
      "Pago de Servicios", "Tipo de Servicio", "Otro Tipo de Servicio", "Factura Servicio", "Institución Servicio",
      "Correo Notificación", "Observación", "Usuario (De)",
      "Fecha de Guardado", "Comentarios", "Comentario Urgente Abierto", "Memorandum"
    ];

    const dataToExportPromises = dataToUse.map(async (s) => {
      let commentsString = 'N/A';
      if (s.commentsCount && s.commentsCount > 0) {
        let collectionName = "SolicitudCheques"; // Assume this first
        let docRef = doc(db, collectionName, s.solicitudId);
        let docSnap = await getDoc(docRef);

        if(!docSnap.exists()) { // If not in first collection, try the second
            collectionName = "Memorandum";
        }
        try {
            const commentsCollectionRef = collection(db, collectionName, s.solicitudId, "comments");
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

      return {
        "Estado Pago": s.paymentStatus || 'Pendiente',
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
        "Fecha de Guardado": s.savedAt instanceof Date ? format(s.savedAt, "yyyy-MM-dd HH:mm:ss", { locale: es }) : 'N/A',
        "Comentarios": commentsString,
        "Comentario Urgente Abierto": s.hasOpenUrgentComment ? 'Sí' : 'No',
        "Memorandum": s.isMemorandum ? 'Sí' : 'No',
      };
    });

    try {
      const dataToExport = await Promise.all(dataToExportPromises);
      downloadExcelFileFromTable(dataToExport, headers, `Reporte_Pagos_${searchType}_${currentSearchTermForDisplay.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      case "dateToday": return <p className="text-sm text-muted-foreground flex-grow items-center flex h-10">Se buscarán las solicitudes de hoy.</p>;
      case "dateCurrentMonth": return <p className="text-sm text-muted-foreground flex-grow items-center flex h-10">Se buscarán las solicitudes del mes actual.</p>;
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

  if (!isClient || authLoading) {
    return <div className="min-h-screen flex items-center justify-center grid-bg"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>;
  }
  
  const isUserAdminOrRevisor = user?.role === 'admin' || user?.role === 'revisor';
  const isUserCalificador = user?.role === 'calificador';
  const isUserAllowedToMarkUrgent = user?.role === 'autorevisor' || user?.role === 'autorevisor_plus' || user?.role === 'revisor';


  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Base de Datos de Pagos</CardTitle>
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
            
            {isLoading && <div className="flex justify-center items-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Cargando solicitudes...</p></div>}
            {error && !isLoading && <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">{error}</div>}

            {displayedSolicitudes && !isLoading && (
              <SearchResultsTable
                solicitudes={displayedSolicitudes}
                searchType={searchType}
                searchTerm={currentSearchTermForDisplay}
                currentUserRole={user?.role}
                isMinutaValidationEnabled={isMinutaValidationEnabled}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
                onUpdateRecepcionDCStatus={handleUpdateRecepcionDCStatus}
                onUpdateEmailMinutaStatus={handleUpdateEmailMinutaStatus}
                onOpenMessageDialog={openMessageDialog}
                onSaveMinuta={handleSaveMinuta}
                onViewDetails={handleViewDetails}
                onOpenCommentsDialog={openCommentsDialog}
                onDeleteSolicitud={handleDeleteSolicitudRequest} 
                onRefreshSearch={() => handleSearch({ preserveFilters: true })}
                filterRecpDocsInput={filterRecpDocsInput}
                setFilterRecpDocsInput={setFilterRecpDocsInput}
                filterNotMinutaInput={filterNotMinutaInput}
                setFilterNotMinutaInput={setFilterNotMinutaInput}
                filterSolicitudIdInput={filterSolicitudIdInput}
                setFilterSolicitudIdInput={setFilterSolicitudIdInput}
                filterNEInput={filterNEInput}
                setFilterNEInput={setFilterNEInput}
                filterEstadoPagoInput={filterEstadoPagoInput}
                setFilterEstadoPagoInput={setFilterEstadoPagoInput}
                filterFechaSolicitudInput={filterFechaSolicitudInput}
                setFilterFechaSolicitudInput={setFilterFechaSolicitudInput}
                filterMontoInput={filterMontoInput}
                setFilterMontoInput={setFilterMontoInput}
                filterConsignatarioInput={filterConsignatarioInput}
                setFilterConsignatarioInput={setFilterConsignatarioInput}
                filterDeclaracionInput={filterDeclaracionInput}
                setFilterDeclaracionInput={setFilterDeclaracionInput}
                filterReferenciaInput={filterReferenciaInput}
                setFilterReferenciaInput={setFilterReferenciaInput}
                filterGuardadoPorInput={filterGuardadoPorInput}
                setFilterGuardadoPorInput={setFilterGuardadoPorInput}
                filterEstadoSolicitudInput={filterEstadoSolicitudInput}
                setFilterEstadoSolicitudInput={setFilterEstadoSolicitudInput}
                duplicateSets={duplicateSets}
                onResolveDuplicate={() => {}}
                resolvedDuplicateKeys={resolvedDuplicateKeys}
                permanentlyResolvedDuplicateKeys={permanentlyResolvedDuplicateKeys}
                onOpenViewErrorDialog={(msg) => { setErrorMessageToView(msg); setIsViewErrorDialogOpen(true); }}
                onFilterByDuplicateSet={() => {}}
              />
            )}
            {!fetchedSolicitudes && !isLoading && !error && !currentSearchTermForDisplay && <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">Seleccione un tipo de búsqueda e ingrese los criterios para ver resultados.</div>}
            {fetchedSolicitudes && fetchedSolicitudes.length === 0 && !isLoading && !error && currentSearchTermForDisplay && (
                <div className="mt-4 p-4 bg-yellow-500/10 text-yellow-700 border border-yellow-500/30 rounded-md text-center">
                    No se encontraron solicitudes para los criterios de búsqueda ingresados.
                </div>
            )}
          </CardContent>
        </Card>
      </div>

       {solicitudToViewInModal && (
        <DatabaseSolicitudDetailView 
            solicitud={solicitudToViewInModal}
            isOpen={!!solicitudToViewInModal}
            onClose={handleCloseDetailView}
        />
       )}

      <Dialog open={isCommentsDialogOpen} onOpenChange={closeCommentsDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comentarios para Solicitud ID: {currentSolicitudIdForComments}</DialogTitle>
            <DialogDescription>
              Ver y añadir comentarios para esta solicitud.
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
           Estas seguro de realizar esta opción. Operacion de borrar es permanente. La solicitud sera archivada.
          </DialogDescription>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setSolicitudToDeleteId(null); }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteSolicitud}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Añadir Mensaje de Error</DialogTitle></DialogHeader>
          <Textarea value={paymentStatusMessage} onChange={(e) => setPaymentStatusMessage(e.target.value)} placeholder="Describa el error..."/>
          <DialogFooter><Button onClick={handleSavePaymentStatusMessage}>Guardar Error</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewErrorDialogOpen} onOpenChange={setIsViewErrorDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Error Reportado</DialogTitle></DialogHeader>
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">{errorMessageToView}</div>
          <DialogFooter><Button onClick={() => setIsViewErrorDialogOpen(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

       <Dialog open={isMinutaDialogOpen} onOpenChange={setIsMinutaDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Confirmar Pago</DialogTitle><DialogDescription>Ingrese el número de minuta para confirmar el pago.</DialogDescription></DialogHeader>
            <div className="py-4"><Label htmlFor="minuta-input">Número de Minuta</Label><Input id="minuta-input" value={minutaNumberInput} onChange={e => setMinutaNumberInput(e.target.value)} placeholder="Opcional"/></div>
            <DialogFooter><Button variant="outline" onClick={() => setIsMinutaDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveMinutaFromDialog}>Confirmar Pago</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
