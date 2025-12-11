"use client";
import React, { useState, useEffect, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { SolicitudRecord } from '@/types';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SolicitudDetailView from '@/components/shared/SolicitudDetailView';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DatabaseSolicitudDetailViewProps {
  solicitud: SolicitudRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DatabaseSolicitudDetailView({ solicitud, isOpen, onClose }: DatabaseSolicitudDetailViewProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (solicitud) {
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
  }, [solicitud]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 h-[90vh] flex flex-col">
         <DialogHeader className="sr-only">
          <DialogTitle>Detalles de la Solicitud</DialogTitle>
          <DialogDescription>Contenido detallado de la solicitud de pago seleccionada.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : solicitud ? (
           <ScrollArea className="flex-grow">
              <div className="p-6">
                <SolicitudDetailView
                    solicitud={solicitud}
                    isInlineView={true}
                    onBackToList={onClose}
                >
                    <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4">
                        <X className="h-5 w-5" />
                    </Button>
                </SolicitudDetailView>
              </div>
           </ScrollArea>
        ) : (
          <div className="flex justify-center items-center h-full">
            <p className="text-muted-foreground">No se pudo cargar la solicitud.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
