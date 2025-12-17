
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, Search, FileSpreadsheet, ListChecks, Printer, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collectionGroup, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import type { WorksheetWithCase, Worksheet } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AforadorCasesTable } from '@/components/aforador/AforadorCasesTable';
import { DailySummaryModal } from '@/components/aforador/DailySummaryModal';
import Link from 'next/link';

export default function AforadorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [cases, setCases] = useState<WorksheetWithCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const fetchCases = useCallback(() => {
    if (!user?.displayName) return;
    setIsLoading(true);

    const q = query(
      collectionGroup(db, 'aforo'),
      where('aforador', '==', user.displayName),
      orderBy('aforadorAssignedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const promises = snapshot.docs.map(async (docSnapshot) => {
            const aforoData = docSnapshot.data();
            const worksheetRef = docSnapshot.ref.parent.parent; 
            if (worksheetRef) {
                const worksheetSnap = await getDoc(worksheetRef);
                if (worksheetSnap.exists()) {
                    const worksheetData = worksheetSnap.data() as Worksheet;
                    return {
                        id: worksheetRef.id,
                        ...worksheetData,
                        aforo: aforoData,
                        worksheet: { id: worksheetRef.id, ...worksheetData }
                    } as WorksheetWithCase;
                }
            }
            return null;
        });

        Promise.all(promises).then(fetchedCases => {
            const validCases = fetchedCases.filter(c => c !== null) as WorksheetWithCase[];
            setCases(validCases);
            setIsLoading(false);
        });

    }, (error) => {
        console.error("Error fetching aforador cases:", error);
        toast({ title: "Error", description: "No se pudieron cargar los casos asignados.", variant: "destructive" });
        setIsLoading(false);
    });

    return unsubscribe;
  }, [user?.displayName, toast]);


  useEffect(() => {
    const unsubscribe = fetchCases();
    return () => {
        if(unsubscribe) unsubscribe();
    };
  }, [fetchCases]);

  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Aforador';

  const completedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return cases.filter(c => {
        const aforoData = (c as any).aforo;
        const lastUpdateDate = aforoData?.aforadorStatusLastUpdate?.at?.toDate();
        return aforoData?.aforadorStatus === 'En revisión' && 
               lastUpdateDate && lastUpdateDate >= today;
    });
  }, [cases]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <AppShell>
        <div className="py-2 md:py-5 space-y-6">
            <Card className="w-full mx-auto custom-shadow">
                 <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                         <div>
                            <CardTitle className="text-2xl">Panel de Aforador</CardTitle>
                            <CardDescription>Bienvenido, {welcomeName}. Aquí están sus casos asignados.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                             <Button asChild variant="outline">
                                <Link href="/database">
                                    <Search className="mr-2 h-4 w-4" /> Buscar Previo
                                </Link>
                            </Button>
                             <Button asChild variant="outline">
                                <Link href="/reports">
                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Reportes de Previos
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="w-full mx-auto custom-shadow">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <ListChecks /> Mis Casos Asignados
                        </CardTitle>
                         <Button onClick={() => setIsSummaryModalOpen(true)} variant="secondary">
                            <Printer className="mr-2 h-4 w-4" /> Resumen Diario
                        </Button>
                    </div>
                    <CardDescription>
                        Casos que requieren su atención para el ingreso del total de posiciones.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                         </div>
                    ) : (
                        <AforadorCasesTable cases={cases} onRefresh={fetchCases} />
                    )}
                </CardContent>
            </Card>
        </div>
      </AppShell>
      <DailySummaryModal 
        isOpen={isSummaryModalOpen} 
        onClose={() => setIsSummaryModalOpen(false)} 
        completedCases={completedToday} 
        aforadorName={user.displayName || 'N/A'}
      />
    </>
  );
}
