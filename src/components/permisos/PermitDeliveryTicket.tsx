
"use client";

import React, { useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import type { PermitRow } from '@/app/permisos/page';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas';

interface PermitDeliveryTicketProps {
  data: {
    permits: PermitRow[];
    recipient: string;
  };
  onClose: () => void;
}

export const PermitDeliveryTicket: React.FC<PermitDeliveryTicketProps> = ({ data, onClose }) => {
  const ticketRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = () => {
    if (ticketRef.current) {
      const captureDiv = ticketRef.current;
      html2canvas(captureDiv, { scale: 2 }).then((canvas) => {
        const link = document.createElement('a');
        link.download = `entrega_permisos_${data.recipient.replace(/\s/g, '_')}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
      });
    }
  };

  return (
    <div className="bg-background min-h-screen p-4 sm:p-8" id="printable-area">
      <div className="max-w-4xl mx-auto">
        <div className="no-print mb-6 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
          <div className="flex gap-2">
            <Button onClick={handleDownloadImage}><Download className="mr-2 h-4 w-4" /> Descargar</Button>
            <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
          </div>
        </div>
        
        <div ref={ticketRef}>
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
                  <h1 className="font-bold text-xl print:text-lg">Entrega de Permisos</h1>
                  <p className="text-sm text-muted-foreground print:text-xs">Generado el: {format(new Date(), 'PPP p', { locale: es })}</p>
                </div>
              </CardHeader>
              <CardContent className="print:p-0">
                <div className="text-sm space-y-4 print:text-xs mb-6">
                  <p>Estimado/a <span className="font-semibold">{data.recipient}</span>;</p>
                  <p>Por este medio se hace entrega de los siguientes {data.permits.length} permisos gestionados:</p>
                </div>
                
                <div className="border rounded-lg overflow-hidden print:border-gray-400">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="print:text-[8pt]">NE</TableHead>
                        <TableHead className="print:text-[8pt]">Consignatario</TableHead>
                        <TableHead className="print:text-[8pt]">Referencia</TableHead>
                        <TableHead className="print:text-[8pt]">Factura</TableHead>
                        <TableHead className="print:text-[8pt]">Permiso</TableHead>
                        <TableHead className="print:text-[8pt]">Tipo Trámite</TableHead>
                        <TableHead className="print:text-[8pt]">Fecha Entrega</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.permits.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium print:text-[8pt] print:p-1">{p.ne}</TableCell>
                          <TableCell className="print:text-[8pt] print:p-1">{p.consignee}</TableCell>
                          <TableCell className="print:text-[8pt] print:p-1">{p.reference || 'N/A'}</TableCell>
                          <TableCell className="print:text-[8pt] print:p-1">{p.facturaNumber || 'N/A'}</TableCell>
                          <TableCell className="print:text-[8pt] print:p-1">{p.name}</TableCell>
                          <TableCell className="print:text-[8pt] print:p-1">{p.tipoTramite || 'N/A'}</TableCell>
                          <TableCell className="print:text-[8pt] print:p-1">{p.estimatedDeliveryDate ? format(p.estimatedDeliveryDate.toDate(), 'dd/MM/yy') : 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="text-sm space-y-4 print:text-xs mt-6">
                    <p>Sin más a que hacer referencia, esperando se encuentre bien.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-16 print:pt-12">
                  <div>
                    <div className="border-t-2 border-black pt-2">
                        <p className="text-sm text-center font-medium print:text-xs">Firma de Recibido</p>
                    </div>
                  </div>
                  <div>
                    <div className="border-t-2 border-black pt-2">
                        <p className="text-sm text-center font-medium print:text-xs">Firma de Entregado</p>
                    </div>
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
    </div>
  );
};
