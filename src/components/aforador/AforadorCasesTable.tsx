
"use client";
import React, { useState } from 'react';
import type { WorksheetWithCase, Worksheet } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye } from 'lucide-react';
import { WorksheetDetailModal } from '../reporter/WorksheetDetailModal';

interface AforadorCasesTableProps {
  cases: WorksheetWithCase[];
  onRefresh: () => void;
}

export function AforadorCasesTable({ cases, onRefresh }: AforadorCasesTableProps) {
  const [worksheetToView, setWorksheetToView] = useState<Worksheet | null>(null);

  if (cases.length === 0) {
    return <p className="text-center text-muted-foreground p-4">No tiene casos asignados pendientes.</p>;
  }

  return (
    <>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Modelo (Patrón)</TableHead>
            <TableHead>Fecha Asignación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => {
            const aforoData = c.aforo;
            return (
            <TableRow key={c.id}>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => setWorksheetToView(c)}>
                    <Eye className="mr-2 h-4 w-4"/> Ver Hoja
                </Button>
              </TableCell>
              <TableCell className="font-medium">{c.ne}</TableCell>
              <TableCell>{c.consignee}</TableCell>
              <TableCell>{c.declarationPattern || 'N/A'}</TableCell>
              <TableCell>{aforoData?.aforadorAssignedAt ? format(aforoData.aforadorAssignedAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A'}</TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
    {worksheetToView && (
      <WorksheetDetailModal
        isOpen={!!worksheetToView}
        onClose={() => setWorksheetToView(null)}
        worksheet={worksheetToView}
      />
    )}
    </>
  );
}
