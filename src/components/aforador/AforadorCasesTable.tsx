
"use client";
import React, { useState, useMemo } from 'react';
import type { Worksheet } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye } from 'lucide-react';
import { WorksheetDetailModal } from '../reporter/WorksheetDetailModal';
import { Timestamp } from 'firebase/firestore';
import { AssignmentTypeBadge } from '../gestion-local/AssignmentTypeBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';


interface AforadorCasesTableProps {
  cases: Worksheet[];
}

export function AforadorCasesTable({ cases }: AforadorCasesTableProps) {
  const [worksheetToView, setWorksheetToView] = useState<Worksheet | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return cases.slice(startIndex, startIndex + itemsPerPage);
  }, [cases, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(cases.length / itemsPerPage);

  if (cases.length === 0) {
    return <p className="text-center text-muted-foreground p-4">No tiene casos asignados pendientes.</p>;
  }

  return (
    <>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Modelo (Patrón)</TableHead>
            <TableHead>Fecha Asignación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedCases.map((c) => {
            const aforoData = (c as any).aforo;
            const assignedAt = aforoData?.aforadorAssignedAt;
            const digitadorAssignedAt = aforoData?.digitadorAssignedAt;
            return (
            <TableRow key={c.id}>
              <TableCell>
                <AssignmentTypeBadge assignmentDate={assignedAt} digitadorAssignedAt={digitadorAssignedAt} />
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => setWorksheetToView(c)}>
                    <Eye className="mr-2 h-4 w-4"/> Ver Hoja
                </Button>
              </TableCell>
              <TableCell className="font-medium">{c.ne}</TableCell>
              <TableCell>{c.consignee}</TableCell>
              <TableCell>{c.patternRegime || 'N/A'}</TableCell>
              <TableCell>{assignedAt instanceof Timestamp ? format(assignedAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A'}</TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>

    {cases.length > itemsPerPage && (
        <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Filas por página</p>
                <Select
                value={`${itemsPerPage}`}
                onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                }}
                >
                <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                    {[10, 20, 30, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="text-sm text-muted-foreground">
                Total de casos hoy: {cases.length}
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-sm">
                    Página {currentPage} de {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                >
                    Siguiente
                </Button>
            </div>
        </div>
    )}

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
