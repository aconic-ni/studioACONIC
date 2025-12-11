"use client";
import React, { useState } from 'react';
import { useFieldArray, Control, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { permitOptions } from '@/lib/formData';
import type { RequiredPermit, DocumentStatus, WorksheetDocument } from '@/types';
import { corporateReportSchema } from '@/app/executive/corporate-report/page';
import { z } from 'zod';

type CorporateReportFormData = z.infer<typeof corporateReportSchema>;

interface PermitManagementProps {
  control: Control<CorporateReportFormData>;
}

export function PermitManagement({ control }: PermitManagementProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "requiredPermits",
  });

  const [permitName, setPermitName] = useState('');
  const [otherPermitName, setOtherPermitName] = useState('');
  const [permitStatus, setPermitStatus] = useState<DocumentStatus>('Pendiente');
  const [selectedFactura, setSelectedFactura] = useState('');

  const documents = useWatch({ control, name: 'documents' }) as (WorksheetDocument[] | undefined);
  const facturas = documents?.filter(doc => doc.type === 'FACTURA') || [];

  const handleAddPermit = () => {
    const finalPermitName = permitName === 'OTROS' ? otherPermitName.trim() : permitName.trim();
    if (finalPermitName) {
      append({
        id: uuidv4(),
        name: finalPermitName,
        status: permitStatus,
        facturaNumber: selectedFactura,
      } as RequiredPermit);
      setPermitName('');
      setOtherPermitName('');
      setPermitStatus('Pendiente');
      setSelectedFactura('');
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <h3 className="text-lg font-medium">Permisos Requeridos</h3>
      <div className="space-y-4 p-3 border rounded-md bg-secondary/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div className="grid gap-2">
            <Label>Nombre del Permiso</Label>
            <Select value={permitName} onValueChange={setPermitName}>
              <SelectTrigger><SelectValue placeholder="Seleccionar permiso..." /></SelectTrigger>
              <SelectContent>{permitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
            </Select>
            {permitName === 'OTROS' && <Input value={otherPermitName} onChange={e => setOtherPermitName(e.target.value)} placeholder="Indique cuál" />}
          </div>
          <div>
            <Label>Factura Relacionada</Label>
            <Select value={selectedFactura} onValueChange={setSelectedFactura} disabled={facturas.length === 0}>
              <SelectTrigger><SelectValue placeholder={facturas.length === 0 ? "Añada una factura primero" : "Seleccionar factura..."} /></SelectTrigger>
              <SelectContent>
                {facturas.map(f => (
                  <SelectItem key={f.id} value={f.number}>{f.number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={permitStatus} onValueChange={(v: any) => setPermitStatus(v)}>
                <SelectTrigger><SelectValue placeholder="Estado..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="En Trámite">En Trámite</SelectItem>
                    <SelectItem value="Entregado">Entregado</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="button" onClick={handleAddPermit} className="w-full md:w-auto"><PlusCircle className="mr-2 h-4 w-4"/> Añadir Permiso</Button>
      </div>

      {fields.length > 0 && (
        <div className="rounded-md border mt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Permiso</TableHead><TableHead>Factura</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>{(field as any).name}</TableCell>
                  <TableCell>{(field as any).facturaNumber || 'N/A'}</TableCell>
                  <TableCell>{(field as any).status}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
