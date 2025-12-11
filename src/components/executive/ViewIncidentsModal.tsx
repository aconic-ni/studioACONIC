
"use client";

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface ViewIncidentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRectificacion: () => void;
  onSelectDudaValor: () => void;
}

export function ViewIncidentsModal({ isOpen, onClose, onSelectRectificacion, onSelectDudaValor }: ViewIncidentsModalProps) {

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seleccionar Incidencia</DialogTitle>
          <DialogDescription>
            Este caso tiene múltiples incidencias reportadas. Por favor, seleccione cuál desea visualizar o editar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
            <Button onClick={onSelectRectificacion} variant="secondary" size="lg" className="justify-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Ver/Editar Reporte de Rectificación</span>
            </Button>
            <Button onClick={onSelectDudaValor} variant="secondary" size="lg" className="justify-start gap-3">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <span>Ver/Editar Reporte de Duda de Valor</span>
            </Button>
        </div>
        <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

