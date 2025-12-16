
"use client";
import React from 'react';
import type { Worksheet } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserCheck, MessageSquare, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface GestionLocalTableProps {
  worksheets: Worksheet[];
  selectedRows: string[];
  setSelectedRows: React.Dispatch<React.SetStateAction<string[]>>;
  onAssign: (worksheet: Worksheet, type: 'aforador' | 'revisor') => void;
  onComment: (worksheet: Worksheet) => void;
  onView: (worksheet: Worksheet) => void;
}

export function GestionLocalTable({ worksheets, selectedRows, setSelectedRows, onAssign, onComment, onView }: GestionLocalTableProps) {

  const handleSelectAll = () => {
    if (selectedRows.length === worksheets.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(worksheets.map(ws => ws.id));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const formatDate = (timestamp: any) => {
      if (!timestamp) return 'N/A';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'dd/MM/yyyy');
  };

  return (
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedRows.length > 0 && selectedRows.length === worksheets.length}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Modelo (Patrón)</TableHead>
            <TableHead>Fecha Creación</TableHead>
            <TableHead>Aforador Asignado</TableHead>
            <TableHead>Revisor Asignado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {worksheets.map(ws => (
            <TableRow key={ws.id} data-state={selectedRows.includes(ws.id) ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  checked={selectedRows.includes(ws.id)}
                  onCheckedChange={() => handleSelectRow(ws.id)}
                />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(ws)}><Eye className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAssign(ws, 'aforador')}><UserCheck className="mr-2 h-4 w-4" /> Asignar Aforador</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAssign(ws, 'revisor')}><UserCheck className="mr-2 h-4 w-4" /> Asignar Revisor</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onComment(ws)}><MessageSquare className="mr-2 h-4 w-4" /> Ver/Añadir Comentarios</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
              <TableCell>{ws.ne}</TableCell>
              <TableCell>{ws.consignee}</TableCell>
              <TableCell>{ws.patternRegime || 'N/A'}</TableCell>
              <TableCell>{formatDate(ws.createdAt)}</TableCell>
              <TableCell>{(ws as any).aforo?.aforador || 'N/A'}</TableCell>
              <TableCell>{(ws as any).aforo?.revisor || 'N/A'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
