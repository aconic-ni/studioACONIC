
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, History, User, Calendar, Edit2, CheckCircle, XCircle, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AforoCaseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase | null;
}

export function AforoCaseHistoryModal({ isOpen, onClose, caseData }: AforoCaseHistoryModalProps) {
  const [history, setHistory] = useState<AforoCaseUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !caseData?.id) {
        setHistory([]);
        return;
    };

    setIsLoading(true);
    const updatesRef = collection(db, 'AforoCases', caseData.id, 'actualizaciones');
    const q = query(updatesRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedHistory: AforoCaseUpdate[] = [];
      querySnapshot.forEach((doc) => {
        fetchedHistory.push(doc.data() as AforoCaseUpdate);
      });
      setHistory(fetchedHistory);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching case history: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, caseData]);

  const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    return format(d, 'dd/MM/yy HH:mm', { locale: es });
  };
  
  const formatValue = (value: any) => {
      if (value instanceof Timestamp) {
          return formatDate(value);
      }
      if (typeof value === 'boolean') {
          return value ? 'Sí' : 'No';
      }
      if (value === null || value === undefined || value === '') {
          return <i className="text-muted-foreground">vacío</i>;
      }
      return String(value);
  }

  const renderChange = (item: AforoCaseUpdate) => {
    if (item.field === 'creation') {
         return (
             <div className="pl-4 border-l-2 border-blue-500">
                <div className="flex items-center gap-2 font-semibold text-blue-500">
                    <p>Caso Creado</p>
                </div>
                <div className="mt-2 text-sm italic bg-muted/50 p-2 rounded-md whitespace-pre-wrap">
                    "{item.comment}"
                </div>
             </div>
         )
    }

    if (item.field === 'status_change') {
      let Icon, title, color;
      switch(item.newValue as AforoCase['revisorStatus']) {
        case 'Aprobado':
            Icon = CheckCircle; title = 'Caso Aprobado'; color = 'text-green-500';
            break;
        case 'Rechazado':
            Icon = XCircle; title = 'Caso Rechazado'; color = 'text-destructive';
            break;
        case 'Revalidación Solicitada':
            Icon = Repeat; title = 'Revalidación Solicitada'; color = 'text-amber-500';
            break;
        default:
            Icon = Edit2; title = 'Cambio de Estado'; color = 'text-foreground';
      }
      return (
        <div className={cn('pl-4 border-l-2', color.replace('text-', 'border-'))}>
            <div className={`flex items-center gap-2 font-semibold ${color}`}>
                <Icon className="h-4 w-4" />
                <p>{title}</p>
            </div>
            {item.comment && (
                <div className="mt-2 text-sm italic bg-muted/50 p-2 rounded-md whitespace-pre-wrap">
                    "{item.comment}"
                </div>
            )}
        </div>
      );
    }

    return (
        <div className="text-sm">
            <p className="font-medium text-muted-foreground">Campo actualizado: <code className="bg-primary/10 text-primary px-2 py-1 rounded-sm">{item.field}</code></p>
            <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 items-center">
                <span className="text-destructive/80">De:</span> <span className="text-destructive/80">{formatValue(item.oldValue)}</span>
                <span className="text-green-600">A:</span> <span className="text-green-600 font-semibold">{formatValue(item.newValue)}</span>
            </div>
        </div>
    )
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History /> Bitácora de Cambios</DialogTitle>
          <DialogDescription>
            Historial de actualizaciones para el caso NE: <span className="font-bold text-foreground">{caseData?.ne}</span>
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] -mx-6 px-6">
            <div className="space-y-6 py-4">
                {isLoading && (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                {!isLoading && history.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                        No hay historial de cambios para este caso.
                    </div>
                )}
                {!isLoading && history.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-card shadow-sm relative">
                        <div className="flex flex-col sm:flex-row justify-between items-start text-xs text-muted-foreground mb-3 border-b pb-2">
                            <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                <span className="font-medium">{item.updatedBy}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                <span className="mt-1 sm:mt-0">{formatDate(item.updatedAt)}</span>
                            </div>
                        </div>

                        {renderChange(item)}
                    </div>
                ))}
            </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
