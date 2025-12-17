
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, Search, FileSpreadsheet, ListChecks, Printer, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, getDocs, collectionGroup } from 'firebase/firestore';
import type { WorksheetWithCase, Worksheet, AforoCase } from '@/types';
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
    if (!user?.uid) return;
    setIsLoading(true);

    const aforoMetadataQuery = query(
      collectionGroup(db, 'aforo'),
      where('aforadorId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(aforoMetadataQuery, async (snapshot) => {
      if (snapshot.empty) {
        setCases([]);
        setIsLoading(false);
        return;
      }
      
      const worksheetPromises = snapshot.docs.map(docSnapshot => {
        const parentRef = docSnapshot.ref.parent.parent;
        if (!parentRef) return null;
        return getDoc(parentRef);
      });
      
      const worksheetDocs = await Promise.all(worksheetPromises);
      
      const casesData: WorksheetWithCase[] = [];
      for (let i = 0; i < worksheetDocs.length; i++) {
        const wsDoc = worksheetDocs[i];
        if (wsDoc && wsDoc.exists()) {
            const wsData = { id: wsDoc.id, ...wsDoc.data() } as Worksheet;
            const aforoData = snapshot.docs[i].data();
            
            // Combine worksheet data with its aforo metadata
            const combinedData = {
                ...wsData, 
                aforo: aforoData
            } as WorksheetWithCase;
            
            casesData.push(combinedData);
        }
      }
      
      casesData.sort((a,b) => (a.aforo?.aforadorAssignedAt?.toMillis() ?? 0) - (b.aforo?.aforadorAssignedAt?.toMillis() ?? 0));
      
      setCases(casesData);
      setIsLoading(false);

    }, (error) => {
        console.error("Error fetching aforador cases:", error);
        toast({ title: "Error", description: "No se pudieron cargar los casos asignados.", variant: "destructive" });
        setIsLoading(false);
    });
  
    return unsubscribe;
  }, [user?.uid, toast]);


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
        const aforoData = c.aforo;
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
