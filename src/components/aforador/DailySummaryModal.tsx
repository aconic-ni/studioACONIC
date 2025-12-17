
"use client";

import { useRef } from 'react';
import type { WorksheetWithCase } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '../ui/scroll-area';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DailySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedCases: WorksheetWithCase[];
  aforadorName: string;
}

export function DailySummaryModal({ isOpen, onClose, completedCases, aforadorName }: DailySummaryModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (printContent) {
      const printWindow = window.open('', '_blank', 'height=600,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Resumen Diario de Aforo</title>');
        printWindow.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid black; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } img { max-width: 100%; height: auto; } .no-print { display: none; } }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    }
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resumen Diario de Aforo</DialogTitle>
          <DialogDescription>
            Casos marcados como "En revisión" el día de hoy.
          </DialogDescription>
        </DialogHeader>
        <div ref={printRef}>
          <div className="my-4 text-center hidden print:block">
             <Image
                src="/AconicExaminer/imagenes/HEADERSEXA.svg"
                alt="Examen Header"
                width={700}
                height={80}
                className="w-full h-auto mb-4"
                priority
            />
            <h2 className="font-bold">Resumen de Aforos - {format(new Date(), 'PPP', { locale: es })}</h2>
            <p>Aforador: {aforadorName}</p>
          </div>
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NE</TableHead>
                  <TableHead>Consignatario</TableHead>
                  <TableHead className="text-right">Total Posiciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedCases.length > 0 ? (
                  completedCases.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.ne}</TableCell>
                      <TableCell>{c.consignee}</TableCell>
                      <TableCell className="text-right">{(c as any).aforo?.totalPosiciones || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No ha completado ningún caso hoy.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={handlePrint} disabled={completedCases.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

