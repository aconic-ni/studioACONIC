"use client";
import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Printer } from 'lucide-react';
import type { Remision } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RemisionDetailViewProps {
  remision: Remision;
  onClose: () => void;
}

export const RemisionDetailView: React.FC<RemisionDetailViewProps> = ({ remision, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-background min-h-screen p-4 sm:p-8" id="printable-area">
      <div className="max-w-4xl mx-auto">
        <div className="no-print mb-6 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
          <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir Remisión</Button>
        </div>
        
        <Card className="shadow-lg print:shadow-none print:border-none print:bg-transparent">
          <CardHeader className="print:p-0">
            <Image
              src="/AconicExaminer/imagenes/HEADERSEXA.svg"
              alt="Header"
              width={800}
              height={100}
              className="w-full h-auto"
              priority
            />
            <div className="text-center my-4 print:my-2">
              <h1 className="font-bold text-xl print:text-lg">Remisión de Cuentas</h1>
              <p className="text-sm text-muted-foreground print:text-xs">Generado el: {format(remision.createdAt.toDate(), 'PPP', { locale: es })}</p>
            </div>
          </CardHeader>
          <CardContent className="print:p-0">
            <div className="text-sm space-y-4 print:text-xs">
              <p>Estimado Lic. {remision.recipientName};</p>
              <p>Por este medio se le remiten las siguientes {remision.totalCases} cuentas:</p>
            </div>
            
            <div className="my-6 border rounded-lg overflow-hidden print:my-4 print:border-gray-400">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="print:text-xs">NE</TableHead>
                    <TableHead className="print:text-xs">Referencia</TableHead>
                    <TableHead className="print:text-xs">Consignatario</TableHead>
                    <TableHead className="print:text-xs">Cuenta de Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remision.cases.map(c => (
                    <TableRow key={c.ne}>
                      <TableCell className="font-medium print:text-xs">{c.ne}</TableCell>
                      <TableCell className="print:text-xs">{c.reference || 'N/A'}</TableCell>
                      <TableCell className="print:text-xs">{c.consignee}</TableCell>
                      <TableCell className="print:text-xs">{c.cuentaDeRegistro}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="text-sm space-y-4 print:text-xs mt-6">
                <p>Sin más a que hacer referencia, esperando se encuentre bien. Atentamente Equipo ACONIC.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-8 print:pt-4">
              <div>
                <h5 className="text-sm text-center font-medium mb-2 print:text-xs print:mb-1">Recibido</h5>
                <div className="p-4 border rounded-md bg-muted/30 min-h-[2.5rem] print:p-1 print:min-h-[2.5rem]"></div>
              </div>
              <div>
                <h5 className="text-sm text-center font-medium mb-2 print:text-xs print:mb-1">Entregado</h5>
                <div className="p-4 border rounded-md bg-muted/30 min-h-[2.5rem] print:p-1 print:min-h-[2.5rem]"></div>
              </div>
            </div>
            <Image
              src="/AconicExaminer/imagenes/FOOTERSOLICITUDETAIL.svg"
              alt="Footer"
              width={800}
              height={50}
              className="w-full h-auto mt-12 print:mt-8"
              priority
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
