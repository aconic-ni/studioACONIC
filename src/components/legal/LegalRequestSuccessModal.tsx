
"use client";

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Download, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import Image from 'next/image';
import type { LegalServiceItem } from '@/types';


interface TicketData {
    id: string;
    date: Date;
    ne: string;
    services: LegalServiceItem[];
    consignee: string;
    observations?: string;
    authorizedByClient: boolean;
}

interface LegalRequestSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketData: TicketData;
}

export function LegalRequestSuccessModal({ isOpen, onClose, ticketData }: LegalRequestSuccessModalProps) {
    const ticketRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        if (ticketRef.current) {
            const captureDiv = ticketRef.current;
            html2canvas(captureDiv, { scale: 2 }).then(canvas => {
                const link = document.createElement('a');
                link.download = `ticket-legal-${ticketData.ne}.jpg`;
                link.href = canvas.toDataURL('image/jpeg', 0.95);
                link.click();
            });
        }
    };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader className="items-center text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <DialogTitle className="text-xl font-semibold text-foreground">Solicitud Legal Enviada</DialogTitle>
            </DialogHeader>
            <DialogDescription asChild>
                <div className="text-center text-muted-foreground space-y-3">
                    <p>Su solicitud ha sido registrada con éxito. Puede descargar el ticket de seguimiento.</p>
                </div>
            </DialogDescription>

            <div ref={ticketRef} id="capture" className="p-4 my-4 border rounded-lg bg-card text-card-foreground">
                <Image
                    src="/AconicExaminer/imagenes/HEADERSEXA.svg"
                    alt="Examen Header"
                    width={800}
                    height={100}
                    className="w-full h-auto mb-4"
                    priority
                />
                <h3 className="font-bold text-center text-lg mb-4">Ticket de Servicio Legal</h3>
                <div className="text-sm space-y-2 border-t pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>ID de Ticket:</strong> {ticketData.id}</p>
                      <p><strong>Fecha:</strong> {format(ticketData.date, 'PPP p', { locale: es })}</p>
                      <p><strong>NE:</strong> {ticketData.ne}</p>
                      <p><strong>Consignatario:</strong> {ticketData.consignee}</p>
                    </div>

                    <div className="pt-2">
                      <h4 className="font-semibold mb-1">Servicios Solicitados:</h4>
                       <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Servicio</TableHead><TableHead className="text-right">Cantidad</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {ticketData.services.map((s, i) => (
                                    <React.Fragment key={i}>
                                    <TableRow>
                                        <TableCell>{s.serviceType}</TableCell>
                                        <TableCell className="text-right">{s.quantity}</TableCell>
                                    </TableRow>
                                     {s.serviceType === 'Dictamen Tecnico INE' && (
                                        <TableRow className="bg-secondary/30">
                                            <TableCell colSpan={2} className="p-2">
                                                <div className="text-xs text-muted-foreground grid grid-cols-3 gap-x-4 gap-y-1 pl-4">
                                                    <p><strong>Factura:</strong> {s.factura || 'N/A'}</p>
                                                    <p><strong>Contenedor:</strong> {s.contenedor || 'N/A'}</p>
                                                    <p><strong>Item:</strong> {s.item || 'N/A'}</p>
                                                    <p><strong>Marca:</strong> {s.marcaEquipo || 'N/A'}</p>
                                                    <p><strong>Modelo:</strong> {s.modeloEquipo || 'N/A'}</p>
                                                    <p><strong>Tipo:</strong> {s.equipoType || 'N/A'}</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                     )}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                      </div>
                    </div>
                    
                    {ticketData.observations && (
                       <div className="pt-2">
                          <h4 className="font-semibold mb-1">Observaciones:</h4>
                          <p className="p-2 border rounded-md bg-secondary/30 text-xs">{ticketData.observations}</p>
                       </div>
                    )}
                    
                    <div className="flex items-center pt-2">
                        {ticketData.authorizedByClient ? <CheckSquare className="h-4 w-4 text-green-600 mr-2"/> : <Square className="h-4 w-4 text-muted-foreground mr-2"/>}
                        <span className="font-medium">Autorizado por el cliente</span>
                    </div>

                </div>
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button onClick={handleDownload} variant="secondary" className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" /> Descargar Ticket
                </Button>
                <Button onClick={onClose} className="btn-primary w-full sm:w-auto">
                    Cerrar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
