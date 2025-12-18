
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, Search, FileSpreadsheet, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, getDocs, collectionGroup, Timestamp, limit } from 'firebase/firestore';
import type { Worksheet, WorksheetWithCase } from '@/types';
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

    const aforoMetadataQuery = query(
      collectionGroup(db, 'aforo'),
      where('aforador', '==', user.displayName),
      orderBy('aforadorAssignedAt', 'desc'),
      limit(50) // Limit to the most recent 50 assignments for this user
    );

    const unsubscribe = onSnapshot(aforoMetadataQuery, async (snapshot) => {
      if (snapshot.empty) {
        setCases([]);
        setIsLoading(false);
        return;
      }
      
      const worksheetIds = snapshot.docs.map(doc => doc.ref.parent.parent?.id).filter(Boolean);
      if (worksheetIds.length === 0) {
        setCases([]);
        setIsLoading(false);
        return;
      }

      const worksheetPromises = [];
      for(let i = 0; i < worksheetIds.length; i += 30) {
          const chunk = worksheetIds.slice(i, i + 30) as string[];
          const wsQuery = query(collection(db, 'worksheets'), where(documentId(), 'in', chunk));
          worksheetPromises.push(getDocs(wsQuery));
      }
      
      const worksheetSnapshots = await Promise.all(worksheetPromises);
      const worksheetsMap = new Map<string, Worksheet>();
      worksheetSnapshots.forEach(snap => snap.forEach(doc => worksheetsMap.set(doc.id, { id: doc.id, ...doc.data() } as Worksheet)));
      
      const aforoDataMap = new Map<string, any>();
      snapshot.docs.forEach(doc => {
          const parentId = doc.ref.parent.parent?.id;
          if (parentId) {
              aforoDataMap.set(parentId, doc.data());
          }
      });

      const casesData: WorksheetWithCase[] = [];
      for (const wsId of worksheetIds) {
          const wsData = worksheetsMap.get(wsId as string);
          const aforoData = aforoDataMap.get(wsId as string);
          if (wsData && aforoData) {
               const combinedData: WorksheetWithCase = {
                  ...wsData, 
                  id: wsData.id,
                  ...aforoData,
                  worksheet: wsData,
               };
              casesData.push(combinedData);
          }
      }
      
      setCases(casesData);
      setIsLoading(false);

    }, (error) => {
        console.error("Error fetching aforador cases:", error);
        toast({ 
            title: "Error de consulta", 
            description: "No se pudieron cargar los casos. Es posible que se necesite un índice en Firestore. Revise la consola del navegador para ver un enlace para crearlo.", 
            variant: "destructive",
            duration: 10000,
        });
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
        const aforoData = c as any;
        const lastUpdateDate = aforoData?.aforadorStatusLastUpdate?.at?.toDate();
        return aforoData?.aforadorStatus === 'En revisión' && 
               lastUpdateDate && lastUpdateDate >= today;
    }).map(c => c);
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
                            <CardDescription>Bienvenido, {welcomeName}. Aquí están sus casos asignados para hoy.</CardDescription>
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
                            <Inbox /> Mis Casos Asignados
                        </CardTitle>
                         <Button onClick={() => setIsSummaryModalOpen(true)} variant="secondary">
                            Resumen Diario
                        </Button>
                    </div>
                    <CardDescription>
                        Casos que le han sido asignados para su revisión.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                         </div>
                    ) : cases.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">No tiene casos asignados para hoy.</div>
                    ) : (
                        <AforadorCasesTable cases={cases} />
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
