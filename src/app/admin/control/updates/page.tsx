
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, RefreshCw, Database } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, writeBatch, doc, getDoc, setDoc, documentId, collectionGroup, getCountFromServer } from 'firebase/firestore';
import type { AforoCase, Worksheet } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function EntregadoAforoMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ casesWithDate: 0, worksheetsToUpdate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'), where('entregadoAforoAt', '!=', null));
            const querySnapshot = await getDocs(q);
            const casesWithDate = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
            
            let worksheetsToUpdateCount = 0;
            for (const caseItem of casesWithDate) {
                if (caseItem.worksheetId) {
                    const wsRef = doc(db, 'worksheets', caseItem.worksheetId);
                    const wsSnap = await getDoc(wsRef);
                    if (wsSnap.exists() && !wsSnap.data().entregadoAforoAt) {
                        worksheetsToUpdateCount++;
                    }
                }
            }

            setStats({ casesWithDate: casesWithDate.length, worksheetsToUpdate: worksheetsToUpdateCount });
        } catch (error) {
            console.error("Error fetching entregadoAforoAt stats:", error);
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
        toast({ title: 'Migración iniciada', description: 'Transfiriendo fechas de "Entregado a Aforo". Esto puede tardar unos minutos...'});
        
        try {
            const q = query(collection(db, 'AforoCases'), where('entregadoAforoAt', '!=', null));
            const querySnapshot = await getDocs(q);
            const casesToProcess = querySnapshot.docs.map(doc => doc.data() as AforoCase);
            
            let migratedCount = 0;
            const batch = writeBatch(db);

            for (const caseData of casesToProcess) {
                if (caseData.worksheetId && caseData.entregadoAforoAt) {
                    const wsRef = doc(db, 'worksheets', caseData.worksheetId);
                    const wsSnap = await getDoc(wsRef);
                    // Only migrate if worksheet exists and doesn't have the field yet
                    if (wsSnap.exists() && !wsSnap.data().entregadoAforoAt) {
                         batch.update(wsRef, { entregadoAforoAt: caseData.entregadoAforoAt });
                         migratedCount++;
                    }
                }
            }

            if (migratedCount > 0) {
                await batch.commit();
                toast({ title: 'Migración Completa', description: `${migratedCount} fechas de "Entregado a Aforo" han sido transferidas.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todos los datos de fecha de entrega ya están sincronizados.' });
            }

        } catch (error) {
            console.error("Error during entregadoAforoAt migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar las fechas.', variant: 'destructive'});
        } finally {
            setIsMigrating(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Fechas "Entregado a Aforo"</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere la fecha `entregadoAforoAt` desde `AforoCases` a los documentos `Worksheet` correspondientes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Casos con fecha de entrega: <span className="font-bold">{stats.casesWithDate}</span></p>
                        <p>Hojas de trabajo a actualizar: <span className="font-bold text-amber-600">{stats.worksheetsToUpdate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.worksheetsToUpdate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Fechas...' : 'Ejecutar Migración de Fechas'}
                 </Button>
            </CardContent>
        </Card>
    );
}

function TotalPosicionesMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ casesWithData: 0, worksheetsToUpdate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'AforoCases'), where('totalPosiciones', '>', 0));
            const querySnapshot = await getDocs(q);
            const casesWithData = querySnapshot.docs.map(doc => doc.data() as AforoCase);
            
            let worksheetsToUpdateCount = 0;
            for (const caseItem of casesWithData) {
                if (caseItem.worksheetId) {
                    const metadataRef = doc(db, `worksheets/${caseItem.worksheetId}/aforo/metadata`);
                    const metadataSnap = await getDoc(metadataRef);
                    if (!metadataSnap.exists() || !metadataSnap.data().totalPosiciones) {
                        worksheetsToUpdateCount++;
                    }
                }
            }
            setStats({ casesWithData: casesWithData.length, worksheetsToUpdate: worksheetsToUpdateCount });
        } catch (error) {
            console.error("Error fetching totalPosiciones stats:", error);
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de migración de posiciones.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMigration = async () => {
        setIsMigrating(true);
        toast({ title: 'Migración iniciada', description: 'Transfiriendo el total de posiciones...'});
        
        try {
            const q = query(collection(db, 'AforoCases'), where('totalPosiciones', '>', 0));
            const querySnapshot = await getDocs(q);
            const casesToProcess = querySnapshot.docs.map(doc => doc.data() as AforoCase);
            
            const batch = writeBatch(db);
            let migratedCount = 0;

            for (const caseData of casesToProcess) {
                if (caseData.worksheetId && caseData.totalPosiciones) {
                    const metadataRef = doc(db, 'worksheets', caseData.worksheetId, 'aforo', 'metadata');
                    const metadataSnap = await getDoc(metadataRef);
                    if (!metadataSnap.exists() || !metadataSnap.data().totalPosiciones) {
                        batch.set(metadataRef, { totalPosiciones: caseData.totalPosiciones }, { merge: true });
                        migratedCount++;
                    }
                }
            }

            if (migratedCount > 0) {
                await batch.commit();
                toast({ title: 'Migración Completa', description: `${migratedCount} registros de 'totalPosiciones' han sido migrados.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todos los datos de posiciones ya están sincronizados.' });
            }
        } catch (error) {
            console.error("Error during totalPosiciones migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar las posiciones.', variant: 'destructive'});
        } finally {
            setIsMigrating(false);
            fetchStats();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Total de Posiciones</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere el valor de `totalPosiciones` desde `AforoCases` a la subcolección `aforo/metadata` en `Worksheets`.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Casos con Total de Posiciones: <span className="font-bold">{stats.casesWithData}</span></p>
                        <p>Registros de metadata a actualizar: <span className="font-bold text-amber-600">{stats.worksheetsToUpdate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.worksheetsToUpdate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Posiciones...' : 'Ejecutar Migración de Posiciones'}
                 </Button>
            </CardContent>
        </Card>
    );
}

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
            const aforoSnapshot = await getDocs(query(collection(db, 'AforoCases')));
            const allCases = aforoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
            
            const relevantCases = allCases.filter(c => c.worksheetId);
            let casesToMigrateCount = 0;
            const worksheetIds = relevantCases.map(c => c.worksheetId).filter(Boolean) as string[];

            if(worksheetIds.length > 0){
                // Firestore 'in' query limit is 30
                const metadataDocsPromises = [];
                for(let i = 0; i < worksheetIds.length; i += 30) {
                    const chunk = worksheetIds.slice(i, i + 30);
                    const metadataQuery = query(collectionGroup(db, 'aforo'), where('__name__', 'in', chunk.map(id => `worksheets/${id}/aforo/metadata`)));
                    metadataDocsPromises.push(getDocs(metadataQuery));
                }
                const metadataSnapshots = await Promise.all(metadataDocsPromises);
                
                const existingMetadataWorksheetIds = new Set<string>();
                 metadataSnapshots.forEach(snapshot => {
                    snapshot.forEach(doc => {
                        const pathParts = doc.ref.path.split('/');
                        if (pathParts.length >= 2) {
                            existingMetadataWorksheetIds.add(pathParts[1]);
                        }
                    });
                });
                
                casesToMigrateCount = worksheetIds.filter(id => !existingMetadataWorksheetIds.has(id)).length;
            }

            setStats({ totalCases: relevantCases.length, casesToMigrate: casesToMigrateCount });

        } catch (error) {
            console.error("Error fetching migration stats:", error);
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
            const casesToProcess = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as AforoCase))
                .filter(c => c.worksheetId);

            let migratedCount = 0;
            
            for (const caseData of casesToProcess) {
                 if (caseData.worksheetId) {
                    const batch = writeBatch(db);
                    const metadataRef = doc(db, `worksheets/${caseData.worksheetId}/aforo/metadata`);
                    const metadataSnap = await getDoc(metadataRef);

                    // Only migrate if it hasn't been migrated before
                    if (!metadataSnap.exists()) {
                        const dataToMigrate = {
                            aforador: caseData.aforador || null,
                            aforadorAssignedAt: caseData.assignmentDate || null,
                            aforadorAssignedBy: "Migrado del Sistema",
                            aforadorStatus: caseData.aforadorStatus || null,
                            aforadorStatusLastUpdate: caseData.aforadorStatusLastUpdate || null,
                            aforadorComment: caseData.aforadorComment || null,

                            revisor: caseData.revisorAsignado || null,
                            revisorAssignedAt: caseData.revisorAsignadoLastUpdate?.at || null,
                            revisorAssignedBy: caseData.revisorAsignadoLastUpdate?.by || "Migrado del Sistema",
                            revisorStatus: caseData.revisorStatus || null,
                            revisorStatusLastUpdate: caseData.revisorStatusLastUpdate || null,

                            digitador: caseData.digitadorAsignado || null,
                            digitadorAssignedAt: caseData.digitadorAsignadoAt || null,
                            digitadorAssignedBy: caseData.digitadorAsignadoLastUpdate?.by || "Migrado del Sistema",
                            digitadorStatus: caseData.digitacionStatus || null,
                            digitadorStatusLastUpdate: caseData.digitacionStatusLastUpdate || null,
                            declaracionAduanera: caseData.declaracionAduanera || null,
                            entregadoAforoAt: caseData.entregadoAforoAt || null,
                        };
                        batch.set(metadataRef, dataToMigrate, { merge: true });
                        await batch.commit(); // Commit one by one to avoid large batch issues
                        migratedCount++;
                    }
                 }
            }

            if (migratedCount > 0) {
                toast({ title: 'Migración Completa', description: `${migratedCount} registros de aforo han sido migrados a sus hojas de trabajo.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todos los datos de aforo aplicables ya están migrados.' });
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
                    Esta herramienta transfiere los datos de asignación (aforador, revisor, digitador), estados y declaración desde los 'Casos de Aforo' a la subcolección correspondiente en 'Hojas de Trabajo'.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Total de Casos de Aforo relevantes: <span className="font-bold">{stats.totalCases}</span></p>
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

function BitacoraMigrator() {
    const { toast } = useToast();
    const [stats, setStats] = useState({ casesWithLogs: 0, logsToMigrate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const aforoCasesQuery = query(collection(db, 'AforoCases'));
            const aforoCasesSnapshot = await getDocs(aforoCasesQuery);
            let totalLogs = 0;
            const caseIdsWithLogs = new Set<string>();

            for (const caseDoc of aforoCasesSnapshot.docs) {
                const updatesRef = collection(db, 'AforoCases', caseDoc.id, 'actualizaciones');
                const updatesCountSnapshot = await getCountFromServer(updatesRef);
                const count = updatesCountSnapshot.data().count;
                if (count > 0) {
                    totalLogs += count;
                    caseIdsWithLogs.add(caseDoc.id);
                }
            }

            setStats({
                casesWithLogs: caseIdsWithLogs.size,
                logsToMigrate: totalLogs,
            });

        } catch (error) {
            console.error("Error fetching bitácora stats:", error);
            toast({ title: 'Error', description: 'No se pudieron cargar las estadísticas de migración de bitácora.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);


    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMigration = async () => {
        setIsMigrating(true);
        toast({ title: 'Migración iniciada', description: 'Transfiriendo registros de bitácora. Esto puede tardar...' });
        
        let migratedCount = 0;
        try {
            const aforoCasesSnapshot = await getDocs(query(collection(db, 'AforoCases'), where('worksheetId', '!=', null)));
            
            for (const caseDoc of aforoCasesSnapshot.docs) {
                const caseData = caseDoc.data();
                const worksheetId = caseData.worksheetId;

                if (worksheetId) {
                    const sourceUpdatesRef = collection(db, 'AforoCases', caseDoc.id, 'actualizaciones');
                    const targetUpdatesRef = collection(db, 'worksheets', worksheetId, 'aforo', 'actualizaciones');

                    const targetSnapshot = await getDocs(query(targetUpdatesRef));
                    if (targetSnapshot.empty) { // Only migrate if target is empty
                        const sourceSnapshot = await getDocs(query(sourceUpdatesRef));
                        if (!sourceSnapshot.empty) {
                            const batch = writeBatch(db);
                            sourceSnapshot.forEach(logDoc => {
                                const newLogRef = doc(targetUpdatesRef, logDoc.id);
                                batch.set(newLogRef, logDoc.data());
                                migratedCount++;
                            });
                            await batch.commit();
                        }
                    }
                }
            }

            if (migratedCount > 0) {
                toast({ title: 'Migración Completa', description: `${migratedCount} registros de bitácora han sido migrados.` });
            } else {
                toast({ title: 'Sin cambios necesarios', description: 'Todas las bitácoras aplicables ya estaban migradas o no se encontraron casos para migrar.' });
            }
        } catch (error) {
            console.error("Error during bitácora migration:", error);
            toast({ title: 'Error en Migración', description: 'Ocurrió un error al migrar las bitácoras.', variant: 'destructive' });
        } finally {
            setIsMigrating(false);
            fetchStats(); // Refresh stats after migration
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Migrador de Bitácora de Aforo</CardTitle>
                <CardDescription>
                    Esta herramienta transfiere la subcolección `actualizaciones` desde `AforoCases` a `worksheets/{'{ID}'}/aforo/actualizaciones`.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Cargando estadísticas...</div>
                ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                        <p>Casos con Bitácora: <span className="font-bold">{stats.casesWithLogs}</span></p>
                        <p>Registros de Bitácora a Migrar: <span className="font-bold text-amber-600">{stats.logsToMigrate}</span></p>
                    </div>
                )}
                 <Button onClick={handleMigration} disabled={isLoading || isMigrating || stats.logsToMigrate === 0}>
                    {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    {isMigrating ? 'Migrando Bitácora...' : 'Ejecutar Migración de Bitácora'}
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
                <BitacoraMigrator />
                <WorksheetTypeSynchronizer />
                <AforoDataMigrator />
                <EntregadoAforoMigrator />
                <TotalPosicionesMigrator />
            </TabsContent>
            <TabsContent value="stats" className="mt-4">
                <p>Módulo de estadísticas en desarrollo.</p>
            </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
