"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, collectionGroup, where, Timestamp } from 'firebase/firestore';
import type { AdminAuditLogEntry, AforoCaseUpdate, AuditLogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ActivityDashboard } from '@/components/dashboard/ActivityDashboard';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export type CombinedActivityLog = {
    user: string;
    date: Date;
    action: string;
};

export default function UpdatesStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [activityData, setActivityData] = useState<CombinedActivityLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAllActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const thirtyDaysAgo = Timestamp.fromDate(subDays(new Date(), 30));
        
        const adminLogsQuery = query(
            collection(db, 'adminAuditLog'),
            where("timestamp", ">=", thirtyDaysAgo)
        );
        const aforoUpdatesQuery = query(
            collectionGroup(db, 'actualizaciones'), 
            where("updatedAt", ">=", thirtyDaysAgo)
        );
        const recoveryLogsQuery = query(
            collection(db, 'examenesRecuperados'),
             where("changedAt", ">=", thirtyDaysAgo)
        );

        const promises = [
            getDocs(adminLogsQuery).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'adminAuditLog', operation: 'list' }, err));
                throw new Error("Failed to fetch admin logs");
            }),
            getDocs(aforoUpdatesQuery).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'actualizaciones', operation: 'list' }, err));
                throw new Error("Failed to fetch aforo updates");
            }),
            getDocs(recoveryLogsQuery).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'examenesRecuperados', operation: 'list' }, err));
                throw err;
            }),
        ];

        const [adminSnapshot, aforoSnapshot, recoverySnapshot] = await Promise.all(promises);
        
        const combinedLogs: CombinedActivityLog[] = [];

        adminSnapshot.forEach(doc => {
            const data = doc.data() as AdminAuditLogEntry;
            if (data.adminEmail && data.timestamp) {
                combinedLogs.push({ user: data.adminEmail, date: data.timestamp.toDate(), action: 'admin_update' });
            }
        });
        aforoSnapshot.forEach(doc => {
            const data = doc.data() as AforoCaseUpdate;
            if (data.updatedBy && data.updatedAt) {
                 const date = data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt.toDate();
                combinedLogs.push({ user: data.updatedBy, date: date, action: 'aforo_update' });
            }
        });
        recoverySnapshot.forEach(doc => {
            const data = doc.data() as AuditLogEntry;
            if (data.changedBy && data.changedAt) {
                combinedLogs.push({ user: data.changedBy, date: data.changedAt.toDate(), action: 'recovery_log' });
            }
        });
        
        setActivityData(combinedLogs);

    } catch (error: any) {
        console.error("Error fetching activity stats:", error);
        if (!(error instanceof FirestorePermissionError)) {
            toast({ title: 'Error', description: error.message || 'No se pudieron cargar las estadísticas.', variant: 'destructive' });
            setError(error.message || 'No se pudieron cargar las estadísticas.');
        }
    } finally {
        setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if(!authLoading && user && user.role === 'admin') {
        fetchAllActivity();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, authLoading, fetchAllActivity]);


  if (authLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3">Cargando datos de actividad...</p></div>
        ) : error ? (
            <Card className="w-full max-w-4xl mx-auto custom-shadow">
                <CardHeader>
                    <CardTitle className="text-destructive">Error al Cargar</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
            </Card>
        ) : (
            <ActivityDashboard allLogs={activityData} />
        )}
      </div>
    </AppShell>
  );
}
