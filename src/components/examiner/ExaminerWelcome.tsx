
"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, FilePlus, RefreshCw, Inbox, PlayCircle } from 'lucide-react';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ExamDocument } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '../ui/badge';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function ExaminerWelcome() {
  const { setCurrentStep, setExamData, setProducts, resetApp } = useAppContext();
  const { user } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);
  const [neToRecover, setNeToRecover] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedExams, setAssignedExams] = useState<ExamDocument[]>([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAssignedExams = async () => {
      if (!user?.displayName) {
        setIsLoadingAssigned(false);
        return;
      }
      setIsLoadingAssigned(true);
      try {
        const q = query(
            collection(db, "examenesPrevios"), 
            where("assignedTo", "==", user.displayName),
            where("status", "==", "incomplete")
        );
        const querySnapshot = await getDocs(q);
        const exams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamDocument));
        exams.sort((a,b) => (a.assignedAt?.toMillis() ?? 0) - (b.assignedAt?.toMillis() ?? 0));
        setAssignedExams(exams);
      } catch (err) {
        console.error("Error fetching assigned exams:", err);
        toast({
            title: "Error al Cargar Asignaciones",
            description: "No se pudieron cargar los previos asignados. Verifique las reglas de Firestore.",
            variant: "destructive"
        });
      } finally {
        setIsLoadingAssigned(false);
      }
    };

    fetchAssignedExams();
  }, [user, toast]);

  const handleStartNew = () => {
    resetApp();
    setCurrentStep(ExamStep.INITIAL_INFO);
  };
  
  const handleStartAssigned = async (exam: ExamDocument) => {
    if (!exam.id) {
        toast({ title: "Error", description: "El examen seleccionado no tiene un ID válido.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
        const examDocRef = doc(db, "examenesPrevios", exam.id);
        // Set creation date when work starts if not already set
        const docSnap = await getDoc(examDocRef);
        if (!docSnap.data()?.createdAt) {
            await updateDoc(examDocRef, {
                createdAt: serverTimestamp(), // Marks the start of the practical work
            });
        }
        
        // Load data into context
        setExamData({
            ne: exam.ne,
            reference: exam.reference,
            consignee: exam.consignee,
            location: exam.location,
            manager: exam.manager
        }, true); // isRecovery = true to enable logging
        setProducts(exam.products || []);
    
        toast({
          title: "Examen Iniciado",
          description: `Comenzando trabajo en el examen ${exam.ne}.`,
        });
    
        setCurrentStep(ExamStep.PRODUCT_LIST);

    } catch (err) {
        console.error("Error starting assigned exam:", err);
        toast({ title: "Error", description: "No se pudo iniciar el examen asignado.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!neToRecover.trim()) {
      setError("Por favor, ingrese un NE para recuperar.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const examDocRef = doc(db, "examenesPrevios", neToRecover.trim().toUpperCase());
      const docSnap = await getDoc(examDocRef);

      if (docSnap.exists()) {
        const recoveredExam = docSnap.data() as ExamDocument;

        // An exam cannot be recovered if it's already completed.
        if (recoveredExam.status === 'complete') {
            const errorMessage = "Este previo ya se encuentra finalizado y no puede ser modificado.";
            setError(errorMessage);
            toast({ 
                title: "Recuperación No Permitida", 
                description: errorMessage,
                variant: "destructive" 
            });
            setIsLoading(false);
            return;
        }
        
        // If checks pass, proceed to load data.
        setExamData({
            ne: recoveredExam.ne,
            reference: recoveredExam.reference,
            consignee: recoveredExam.consignee,
            location: recoveredExam.location,
            manager: recoveredExam.manager
        }, true); // isRecovery = true
        setProducts(recoveredExam.products || []);

        toast({
          title: "Examen Recuperado",
          description: `Se cargó el progreso del examen ${recoveredExam.ne}.`,
        });
        setCurrentStep(ExamStep.PRODUCT_LIST);

      } else {
        setError(`No se encontró ningún examen para el NE: ${neToRecover}`);
        toast({
          title: "Error de Recuperación",
          description: `No se encontró un examen para el NE: ${neToRecover}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error recovering exam:", err);
      setError("Ocurrió un error al intentar recuperar el examen.");
      toast({
        title: "Error de Servidor",
        description: "No se pudo comunicar con la base de datos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Gestor';
  
  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return format(timestamp.toDate(), 'dd/MM/yy HH:mm', { locale: es });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
    <Card className="custom-shadow">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">Bienvenido, {welcomeName}</CardTitle>
        <CardDescription>¿Qué desea hacer hoy?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => setIsRecovering(!isRecovering)} size="lg" variant="outline" className="h-20 text-lg">
              <RefreshCw className="mr-3 h-6 w-6" />
              {isRecovering ? 'Ocultar Recuperación' : 'Continuar/Recuperar Examen'}
            </Button>
          </div>
        {isRecovering && (
          <div className="p-4 border rounded-md bg-secondary/30">
            <h3 className="font-semibold text-center mb-3">Recuperar Examen no Finalizado</h3>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input
                type="text"
                placeholder="Ingrese NE a recuperar"
                value={neToRecover}
                onChange={(e) => setNeToRecover(e.target.value)}
                className="flex-grow"
                aria-label="NE a recuperar"
                onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
              />
              <Button onClick={handleRecover} className="btn-primary w-full sm:w-auto" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {isLoading ? 'Buscando...' : 'Recuperar'}
              </Button>
            </div>
            {error && <p className="text-destructive text-sm mt-2 text-center">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>

    <Card className="custom-shadow">
        <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><Inbox/> Mis Asignaciones</CardTitle>
            <CardDescription>Estos son los exámenes previos que se le han asignado para su gestión.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoadingAssigned && (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                    <p className="ml-2 text-muted-foreground">Cargando asignaciones...</p>
                </div>
            )}
            {!isLoadingAssigned && assignedExams.length === 0 && (
                <div className="text-center py-6 px-4 bg-secondary/30 rounded-lg">
                    <p className="text-muted-foreground">No tiene exámenes previos asignados pendientes.</p>
                </div>
            )}
            {!isLoadingAssigned && assignedExams.length > 0 && (
                <div className="space-y-3">
                    {assignedExams.map(exam => (
                        <div key={exam.id} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                            <div className="flex-1 mb-2 sm:mb-0">
                                <p className="font-bold text-primary">{exam.ne}</p>
                                <p className="text-sm text-foreground">{exam.consignee}</p>
                                <p className="text-xs text-muted-foreground">
                                    Asignado por {exam.requestedBy} el {formatTimestamp(exam.assignedAt)}
                                </p>
                            </div>
                            <Button size="sm" onClick={() => handleStartAssigned(exam)} disabled={isLoading}>
                                <PlayCircle className="mr-2 h-4 w-4"/> Empezar Previo
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
    </Card>

    </div>
  );
}
