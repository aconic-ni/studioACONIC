

"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, IncidentStatus, AforoCaseUpdate } from '@/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


export function IncidentNotificationPanel({ isMobile = false }: { isMobile?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<AforoCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !((user.roleTitle === 'agente aduanero') || user.role === 'admin')) return;
    
    setIsLoading(true);
    let q = query(
      collection(db, 'AforoCases'),
      where('incidentReported', '==', true),
      where('incidentStatus', '==', 'Pendiente')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedIncidents: AforoCase[] = [];
      snapshot.forEach(doc => {
        fetchedIncidents.push({ id: doc.id, ...doc.data() } as AforoCase);
      });
      setIncidents(fetchedIncidents);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleReview = async (caseId: string, newStatus: IncidentStatus) => {
    if (!user || !user.displayName) return;

    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const originalCase = incidents.find(inc => inc.id === caseId);

    try {
      await updateDoc(caseDocRef, {
        incidentStatus: newStatus,
        incidentReviewedBy: user.displayName,
        incidentReviewedAt: Timestamp.now(),
        incidentStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
      });

      const updateLog: AforoCaseUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.displayName,
        field: 'incident_report',
        oldValue: 'Pendiente',
        newValue: newStatus,
        comment: `Incidencia ${newStatus.toLowerCase()} por agente aduanero.`,
      };
      await addDoc(updatesSubcollectionRef, updateLog);

      toast({
        title: 'Incidencia Revisada',
        description: `El estado de la incidencia para el NE ${originalCase?.ne} ha sido actualizado.`,
      });

    } catch (error) {
      console.error("Error reviewing incident:", error);
      toast({ title: 'Error', description: 'No se pudo actualizar la incidencia.', variant: 'destructive' });
    }
  };

  const popoverContent = (
    <PopoverContent className="w-80 p-0" align="end">
      <div className="p-4 font-medium border-b">
        Notificaciones de Incidencia
      </div>
      <ScrollArea className="h-[300px]">
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Cargando...</div>}
        {!isLoading && incidents.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No hay incidencias pendientes.
          </div>
        )}
        {!isLoading && incidents.map(incident => (
          <div key={incident.id} className="p-3 border-b">
            <p className="font-semibold text-sm">NE: {incident.ne}</p>
            <p className="text-xs text-muted-foreground">Reportado por: {incident.incidentReportedBy}</p>
            <p className="text-sm my-2 p-2 bg-secondary rounded-md">{incident.incidentReason}</p>
            <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleReview(incident.id, 'Rechazada')}>
                    <XCircle className="mr-2 h-4 w-4"/> Rechazar
                </Button>
                <Button size="sm" onClick={() => handleReview(incident.id, 'Aprobada')}>
                    <CheckCircle className="mr-2 h-4 w-4"/> Aprobar
                </Button>
            </div>
          </div>
        ))}
      </ScrollArea>
      <div className="p-2 border-t">
        <Button variant="ghost" className="w-full justify-center gap-2" asChild>
            <Link href="/notificaciones">
                Ver Todas las Notificaciones <ExternalLink className="h-4 w-4"/>
            </Link>
        </Button>
      </div>
    </PopoverContent>
  );

  const triggerButton = (
    <Button variant="ghost" size={isMobile ? "lg" : "icon"} className={isMobile ? "w-full justify-center text-base gap-4" : "relative text-primary"}>
      <Bell className={cn("h-5 w-5", incidents.length > 0 ? "text-destructive" : "")} />
      {incidents.length > 0 && !isMobile && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
          {incidents.length}
        </span>
      )}
      {isMobile && <span>Notificaciones ({incidents.length})</span>}
      <span className="sr-only">Notificaciones de Incidencia</span>
    </Button>
  );

  if (isMobile) {
    return (
        <Popover>
            <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
            {popoverContent}
        </Popover>
    );
  }

  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {triggerButton}
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
              <p>Notificaciones de Incidencia</p>
          </TooltipContent>
        </Tooltip>
        {popoverContent}
      </Popover>
    </TooltipProvider>
  );
}
