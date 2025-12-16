
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, RefreshCw, Database } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import type { AforoCase, Worksheet } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function WorksheetTypeSynchronizer() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ total: 0, missingType: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'));
            const querySnapshot = await getDocs(q);
            const allCases = querySnapshot.docs.map(doc => doc.data());
            const missingTypeCount = allCases.filter(c => !c.worksheetType).length;
            setStats({ total: allCases.length, missingType: missingTypeCount });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de casos.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleSync = async () => {
        setIsSyncing(true);
        toast({ title: 'Sincronización iniciada', description: 'Buscando y actualizando casos. Esto puede tardar unos minutos...'});
        
        try {
            const allCasesSnapshot = await getDocs(collection(db, 'AforoCases'));
            const casesToUpdate = allCasesSnapshot.docs.filter(doc => !doc.data().worksheetType);

            if (casesToUpdate.length === 0) {
                toast({ title: 'Todo al día', description: 'No se encontraron casos para actualizar.' });
                setIsSyncing(false);
                fetchStats();
                return;
            }

            let updatedCount = 0;
            const batch = writeBatch(db);

            for (const caseDoc of casesToUpdate) {
                const caseData = caseDoc.data();
                if (caseData.worksheetId) {
                    const worksheetRef = doc(db, 'worksheets', caseData.worksheetId);
                    const worksheetSnap = await getDoc(worksheetRef);
                    if (worksheetSnap.exists() && worksheetSnap.data().worksheetType) {
                        batch.update(caseDoc.ref, { worksheetType: worksheetSnap.data().worksheetType });
                        updatedCount++;
                    }
                }
            }
            
            if (updatedCount > 0) {
                await batch.commit();
                toast({ title: 'Sincronización Completa', description: `${updatedCount} casos han sido actualizados con su tipo de hoja de trabajo.` });
            } else {
                 toast({ title: 'Sin cambios necesarios', description: 'Aunque se encontraron casos sin tipo, no se pudieron asociar a una hoja de trabajo para actualizar.' });
            }
        } catch (error) {
            console.error("Error during sync:", error);
            toast({ title: 'Error en Sincronización', description: 'Ocurrió un error al actualizar los casos.', variant: 'destructive'});
        } finally {
            setIsSyncing(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sincronizador de Tipos de Hoja de Trabajo</CardTitle>
                <CardDescription>
                    Esta herramienta asegura que todos los Casos de Aforo tengan el tipo de hoja de trabajo correcto (Ej: Hoja de Trabajo, Anexo 5).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Total de Casos de Aforo: <span className="font-bold">{stats.total}</span></p>
                        <p>Casos sin tipo de hoja de trabajo: <span className="font-bold text-destructive">{stats.missingType}</span></p>
                    </div>
                )}
                 <Button onClick={handleSync} disabled={isLoading || isSyncing || stats.missingType === 0}>
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Datos Ahora'}
                 </Button>
            </CardContent>
        </Card>
    );
}

function AforoDataMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ totalCases: 0, casesToMigrate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'));
            const querySnapshot = await getDocs(q);
            const allCases = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
            
            const casesWithData = allCases.filter(c => c.worksheetId && (c.aforador || c.revisorAsignado));
            let migratedCount = 0;
            for(const caseItem of casesWithData) {
                const metadataRef = doc(db, `worksheets/${caseItem.worksheetId}/aforo/metadata`);
                const metadataSnap = await getDoc(metadataRef);
                if(metadataSnap.exists()) {
                    migratedCount++;
                }
            }

            setStats({ totalCases: allCases.length, casesToMigrate: casesWithData.length - migratedCount });

        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de migración.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMigration = async () => {
        setIsMigrating(true);
        toast({ title: 'Migración iniciada', description: 'Transfiriendo datos de aforo. Esto puede tardar unos minutos...'});
        
        try {
            const q = query(collection(db, 'AforoCases'), where('worksheetId', '!=', null));
            const querySnapshot = await getDocs(q);
            const casesToProcess = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));

            const batch = writeBatch(db);
            let migratedCount = 0;

            for (const caseData of casesToProcess) {
                if (caseData.worksheetId && (caseData.aforador || caseData.revisorAsignado)) {
                    const metadataRef = doc(db, `worksheets/${caseData.worksheetId}/aforo/metadata`);
                    const metadataSnap = await getDoc(metadataRef);

                    // Only migrate if it hasn't been migrated before
                    if (!metadataSnap.exists()) {
                        const dataToMigrate = {
                            aforador: caseData.aforador || null,
                            revisor: caseData.revisorAsignado || null,
                            aforadorAssignedAt: caseData.assignmentDate || null,
                            aforadorAssignedBy: 'Migrado del Sistema', // Placeholder
                            revisorAssignedAt: caseData.revisorStatusLastUpdate?.at || null,
                            revisorAssignedBy: caseData.revisorStatusLastUpdate?.by || 'Migrado del Sistema',
                        };
                        batch.set(metadataRef, dataToMigrate, { merge: true });
                        migratedCount++;
                    }
                }
            }

            if (migratedCount > 0) {
                await batch.commit();
                toast({ title: 'Migración Completa', description: `${migratedCount} registros de aforo han sido migrados a sus hojas de trabajo.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todos los datos de aforo ya están migrados.' });
            }

        } catch (error) {
            console.error("Error during migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar los datos.', variant: 'destructive'});
        } finally {
            setIsMigrating(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Datos de Aforo</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere los datos de asignación de aforador y revisor desde los 'Casos de Aforo' a las 'Hojas de Trabajo' para la nueva vista de gestión.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Total de Casos de Aforo: <span className="font-bold">{stats.totalCases}</span></p>
                        <p>Casos pendientes de migración: <span className="font-bold text-amber-600">{stats.casesToMigrate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.casesToMigrate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Datos...' : 'Ejecutar Migración'}
                 </Button>
            </CardContent>
        </Card>
    );
}


export default function UpdatesAdminPage() {
  const { user, loading: authLoading } = useAuth();
  
  if (authLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <div className="mb-4">
            <Button asChild variant="outline">
                <Link href="/admin/control">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Control de Registros
                </Link>
            </Button>
        </div>
        <Tabs defaultValue="sync">
            <TabsList>
                <TabsTrigger value="sync">Herramientas de Datos</TabsTrigger>
                <TabsTrigger value="stats" disabled>Estadísticas de Actividad (Próximamente)</TabsTrigger>
            </TabsList>
            <TabsContent value="sync" className="mt-4 grid gap-6">
                <WorksheetTypeSynchronizer />
                <AforoDataMigrator />
            </TabsContent>
            <TabsContent value="stats" className="mt-4">
                <p>Módulo de estadísticas en desarrollo.</p>
            </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
