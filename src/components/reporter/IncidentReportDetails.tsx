"use client";
import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { X, Printer, FileText, User, Building, FileCheck, FileX, Calendar, Hash, Receipt, Banknote, PenSquare, MessageSquare, DollarSign } from 'lucide-react';
import type { AforoCase } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' });
};

const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; icon?: React.ElementType; className?: string }> = ({ label, value, icon: Icon, className }) => {
  let displayValue: React.ReactNode;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div className={className}>
      <div className="flex items-center">
        {Icon && <Icon className="mr-2 h-4 w-4 text-primary print:h-3 print:w-3" />}
        <p className="text-xs font-medium text-muted-foreground print:text-[8pt]">{label}</p>
      </div>
      <p className="text-sm text-foreground ml-6 break-words print:text-[9pt] print:ml-5">{displayValue}</p>
    </div>
  );
};


export const IncidentReportDetails: React.FC<{ caseData: AforoCase; onClose: () => void; }> = ({ caseData, onClose }) => {

  const handlePrint = () => {
    window.print();
  };
  
  const getStatusBadge = () => {
    if (caseData.incidentStatus === 'Aprobada') return <Badge variant="default" className="bg-green-600 print:text-[9pt]"><FileCheck className="mr-2 h-4 w-4 print:h-3 print:w-3"/> Aprobada</Badge>
    if (caseData.incidentStatus === 'Rechazada') return <Badge variant="destructive" className="print:text-[9pt]"><FileX className="mr-2 h-4 w-4 print:h-3 print:w-3"/> Rechazada</Badge>
    return <Badge variant="secondary" className="print:text-[9pt]">Pendiente</Badge>
  }


  return (
    <Card className="w-full max-w-4xl mx-auto custom-shadow" id="printable-area">
      <Image
          src="/AconicExaminer/imagenes/HEADERSEXA.svg"
          alt="Header"
          width={800}
          height={100}
          className="w-full h-auto mb-4 hidden print:block"
          priority
      />
      <CardHeader className="print:p-0">
          <div className="flex justify-between items-start no-print">
              <CardTitle className="text-xl md:text-2xl font-semibold text-foreground print:text-base">Solicitud de Rectificación: {caseData.ne}</CardTitle>
              <button onClick={onClose} className="p-1 text-destructive hover:text-destructive/80 no-print">
                  <X className="h-6 w-6" />
              </button>
          </div>
         <div className="pt-2 pb-4 mb-4 border-b print:pt-1 print:mb-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Building className="h-4 w-4 text-primary print:h-3 print:w-3" />
              <span>Consignatario:</span>
            </div>
            <p className="text-xl font-semibold text-foreground print:text-lg">{caseData.consignee}</p>
            <p className="text-xs text-muted-foreground text-left mt-1 print:text-[9pt] print:mt-1">Creado: {formatTimestamp(caseData.createdAt)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 print:space-y-0.5 print:p-2">
        {/* Main Info */}
        <div className="p-4 rounded-md shadow-sm text-sm print:p-1 print:border-none print:shadow-none">
            <h4 className="text-base font-medium mb-2 text-foreground print:text-sm print:mb-1">Información General</h4>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 print:grid-cols-3 print:p-0 print:gap-x-4 print:gap-y-1">
                <DetailItem label="NE" value={caseData.ne} icon={FileText} />
                <DetailItem label="Reportado Por" value={caseData.incidentReportedBy} icon={User} />
                <DetailItem label="Fecha de Reporte" value={formatTimestamp(caseData.incidentReportedAt)} icon={Calendar} />
                <DetailItem label="Revisado Por" value={caseData.incidentReviewedBy} icon={User} />
                <DetailItem label="Fecha de Revisión" value={formatTimestamp(caseData.incidentReviewedAt)} icon={Calendar} />
                 <div className="md:col-span-1">
                  <div className="flex items-center">
                      <FileCheck className="mr-2 h-4 w-4 text-primary print:h-3 print:w-3" />
                      <p className="text-xs font-medium text-muted-foreground print:text-[8pt]">Estado de la Incidencia</p>
                  </div>
                  <div className="ml-6 print:ml-5">{getStatusBadge()}</div>
                </div>
            </div>
        </div>
        
        {/* Payment and Liquidation */}
        <div>
            <h4 className="text-base font-medium mb-2 text-foreground print:text-sm print:mb-1">Detalles de Liquidación y Pago</h4>
            <div className="space-y-2 border p-4 rounded-md print:p-1 print:space-y-1 print:border-none">
                <div className="grid grid-cols-2 gap-4 print:grid-cols-2 print:gap-x-8">
                    <DetailItem label="Declaración Aduanera" value={caseData.declaracionAduanera} icon={Hash} />
                    <DetailItem label="No. de Liquidación" value={caseData.noLiquidacion} icon={Hash} />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2 border-t print:grid-cols-3 print:gap-x-8 print:pt-1 print:border-t-0">
                    <DetailItem label="Pago Inicial" value={caseData.pagoInicialRealizado ? 'Sí' : 'No'} icon={Banknote} />
                    {caseData.pagoInicialRealizado && (
                        <>
                            <DetailItem label="Recibo" value={caseData.reciboDeCajaPagoInicial} icon={Receipt} />
                            <DetailItem label="Monto (USD)" value={caseData.montoPagoInicial ? `$${caseData.montoPagoInicial.toFixed(2)}` : 'N/A'} icon={DollarSign} />
                        </>
                    )}
                </div>
            </div>
        </div>
        
        {/* Reasons and Observations */}
        <div>
          <h4 className="text-base font-medium mb-2 text-foreground print:text-sm print:mb-1">Motivos y Observaciones</h4>
          <div className="space-y-3 print:space-y-1">
              <div className="p-4 border rounded-md print:p-1 print:border-none">
                  <DetailItem label="Motivo de la Rectificación" value={caseData.motivoRectificacion} icon={PenSquare}/>
              </div>
              <div className="p-4 border rounded-md print:p-1 print:border-none">
                  <DetailItem label="Observaciones" value={caseData.observaciones} icon={MessageSquare}/>
              </div>
          </div>
        </div>

        {/* Accounting Observations */}
        <div>
            <h4 className="text-base font-medium mb-2 text-foreground print:text-sm print:mb-1">Observaciones (Contabilidad)</h4>
            <div className="p-4 border rounded-md bg-muted/50 min-h-[4rem] print:p-2">
                 <p className="text-sm text-foreground print:text-xs">{caseData.observacionesContabilidad || ''}</p>
            </div>
        </div>

        {/* Signature Section */}
        <div className="pt-8 print:pt-4">
            <h4 className="text-base font-medium mb-2 text-foreground print:text-sm print:mb-1 sr-only">Firmas de Aprobación</h4>
            <div className="grid grid-cols-2 gap-4 print:gap-4">
                <div>
                    <h5 className="text-sm text-center font-medium mb-2 print:text-xs print:mb-1">Firma Ejecutivo</h5>
                    <div className="p-4 border rounded-md bg-muted/30 min-h-[2.5rem] print:p-1 print:min-h-[2.5rem]"></div>
                </div>
                <div>
                    <h5 className="text-sm text-center font-medium mb-2 print:text-xs print:mb-1">Firma Agente Aduanero</h5>
                    <div className="p-4 border rounded-md bg-muted/30 min-h-[2.5rem] print:p-1 print:min-h-[2.5rem]"></div>
                </div>
            </div>
        </div>


      </CardContent>
      <CardFooter className="justify-end gap-2 no-print border-t pt-4">
          <Button type="button" onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
      </CardFooter>
      <Image
          src="/AconicExaminer/imagenes/FOOTEREXA.svg"
          alt="Footer"
          width={800}
          height={50}
          className="w-full h-auto mt-6 hidden print:block"
          priority
      />
    </Card>
  );
};
