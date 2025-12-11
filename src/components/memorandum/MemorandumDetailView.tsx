
"use client";
import React, { useState, useEffect, type ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp as FirestoreTimestamp } from 'firebase/firestore'; 
import type { SolicitudRecord, InitialDataContext, SolicitudData } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, CheckSquare, Square, Banknote, Landmark, Hash, User, FileText, Mail, MessageSquare, Building, Code, CalendarDays, Info, Send, Users, Settings2, StickyNote, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean | Date; icon?: React.ElementType; className?: string }> = ({ label, value, icon: Icon, className }) => {
  let displayValue: string;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else if (value instanceof Date) { 
    displayValue = format(value, "PPP", { locale: es });
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div className={cn("py-1 flex items-baseline print:py-0", className)}>
      <p className="text-xs font-medium text-muted-foreground flex items-center shrink-0 print:text-xs">
        {Icon && <Icon className="h-3.5 w-3.5 mr-1.5 text-primary/70 print:h-3 print:w-3" />}
        {label}:&nbsp;
      </p>
      <p className="text-sm text-foreground break-words print:text-xs print:font-semibold">{displayValue}</p>
    </div>
  );
};

const CheckboxDetailItem: React.FC<{ label: string; checked?: boolean; subLabel?: string }> = ({ label, checked, subLabel }) => (
  <div className="flex items-center py-1 print:py-0.5">
    {checked ? <CheckSquare className="h-4 w-4 text-green-600 mr-2 print:h-3 print:w-3" /> : <Square className="h-4 w-4 text-muted-foreground mr-2 print:h-3 print:w-3" />}
    <span className="text-sm text-foreground print:text-xs">{label}</span>
    {subLabel && <span className="text-xs text-muted-foreground ml-1 print:text-xs">{subLabel}</span>}
  </div>
);

const formatCurrency = (amount?: number | string, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';
    return `${prefix}${num.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface MemorandumDetailViewProps {
  solicitud: SolicitudRecord;
  onBackToList?: () => void;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function MemorandumDetailView({ solicitud, onBackToList }: MemorandumDetailViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialData: InitialDataContext = {
    ne: solicitud.examNe,
    reference: solicitud.examReference || undefined,
    manager: solicitud.examManager,
    date: solicitud.examDate || new Date(),
    recipient: solicitud.examRecipient,
    isMemorandum: solicitud.isMemorandum
  }

  const handlePrint = () => {
    window.print();
  };

  const getBancoDisplay = (s: SolicitudRecord) => {
    if (s.banco === 'ACCION POR CHEQUE/NO APLICA BANCO') return 'Acción por Cheque / No Aplica Banco';
    if (s.banco === 'Otros') return s.bancoOtros || 'Otros (No especificado)';
    return s.banco;
  };

  const getMonedaCuentaDisplay = (s: SolicitudRecord) => {
    if (s.monedaCuenta === 'Otros') return s.monedaCuentaOtros || 'Otros (No especificado)';
    return s.monedaCuenta;
  };
  
  const content = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    if (error) {
      return <div className="text-center p-10 text-destructive">{error}</div>;
    }
    if (!solicitud || !initialData) {
      return <div className="text-center p-10 text-muted-foreground">Datos de la solicitud no encontrados.</div>;
    }
    
    return (
        <div id="printable-area">
          <div className="hidden print:block">
              <Image src={`/AconicExaminer/imagenes/HEADERSEXA.svg`} alt="Header Solicitud Detail" width={800} height={100} className="w-full h-auto object-contain" data-ai-hint="company logo banner" priority/>
          </div>
          <CardHeader className="p-0 mb-4 no-print">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Detalle de Memorando</CardTitle>
              {onBackToList && <Button variant="ghost" size="icon" onClick={onBackToList}><X className="h-5 w-5" /></Button>}
            </div>
            <CardDescription className="text-muted-foreground">Mostrando información del memorando seleccionado.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 print:p-0">
               <div className="mb-3 p-4 border rounded-md bg-secondary/5 print:border print:mb-2">
                  <div className="flex justify-between items-center">
                      <DetailItem label="ID de Solicitud" value={solicitud.solicitudId} icon={Info} />
                       <div className='flex items-center gap-2'>
                          <Badge variant="destructive" className="text-sm font-semibold px-3 py-1 print:text-xs">
                            <StickyNote className="h-4 w-4 mr-1.5" /> Memorándum
                          </Badge>
                      </div>
                  </div>
              </div>
              <div className="mb-3 p-4 border rounded-md bg-secondary/30 print:border print:mb-2">
                  <h3 className="text-lg font-semibold mb-2 text-primary print:text-base print:mb-1">Información General</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0 print:grid-cols-2 print:gap-x-8">
                    <div className="space-y-1">
                        <DetailItem label="A" value={initialData.recipient} icon={Send} />
                        <DetailItem label="Fecha de Solicitud" value={initialData.date} icon={CalendarDays} />
                        <DetailItem label="Referencia" value={initialData.reference || 'N/A'} icon={FileText}/>
                    </div>
                    <div className="space-y-1">
                        <DetailItem label="De (Usuario)" value={initialData.manager} icon={User} />
                        <DetailItem label="NE (Tracking NX1)" value={initialData.ne} icon={Info} />
                    </div>
                  </div>
              </div>

               {solicitud.isMemorandum && solicitud.memorandumCollaborators && solicitud.memorandumCollaborators.length > 0 && (
                  <div className="mb-3 p-4 border border-destructive/50 rounded-md bg-destructive/5 print:border print:mb-2">
                      <h3 className="text-lg font-semibold mb-2 text-destructive print:text-base print:mb-1">Colaboradores del Memorándum</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 print:grid-cols-2 print:gap-x-8">
                          {solicitud.memorandumCollaborators.map(collab => (
                              <div key={collab.id} className="p-2 border-b border-destructive/20 print:p-1 print:border-0">
                                  <DetailItem label="Nombre" value={collab.name} icon={User} />
                                  <DetailItem label="Número Colaborador" value={collab.number} icon={Hash} />
                              </div>
                          ))}
                      </div>
                  </div>
              )}
              
              <div className="mb-3 p-4 border border-border rounded-md bg-secondary/30 print:border print:mb-2">
                <p className="text-sm font-medium text-muted-foreground mb-2 print:text-xs">Por este medio me dirijo a usted para solicitarle que elabore cheque por la cantidad de:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 items-start mb-3 print:grid-cols-2 print:gap-x-8 print:mb-2">
                  <div className="flex items-baseline py-1"><Banknote className="h-4 w-4 mr-1.5 text-primary shrink-0 print:h-3 print:w-3" /><p className="text-sm text-foreground break-words print:text-xs print:font-bold">{formatCurrency(solicitud.monto, solicitud.montoMoneda || undefined)}</p></div>
                  <div className="flex items-baseline py-1"><FileText className="h-4 w-4 mr-1.5 text-primary shrink-0 print:h-3 print:w-3" /><p className="text-sm text-foreground break-words print:text-xs print:font-bold">{solicitud.cantidadEnLetras || 'N/A'}</p></div>
                </div>

                <div className="space-y-3 divide-y divide-border print:space-y-1">
                  <div className="pt-3 print:pt-1"><div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 print:grid-cols-3 print:gap-x-8"><DetailItem label="Consignatario" value={solicitud.consignatario} icon={Users} /><DetailItem label="Declaración Número" value={solicitud.declaracionNumero} icon={Hash} /><DetailItem label="Unidad Recaudadora" value={solicitud.unidadRecaudadora} icon={Building} /><DetailItem label="Código 1" value={solicitud.codigo1} icon={Code} /><DetailItem label="Codigo MUR" value={solicitud.codigo2} icon={Code} /></div></div>
                  <div className="pt-3 print:pt-1"><div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 items-start print:grid-cols-3 print:gap-x-8"><DetailItem label="Banco" value={getBancoDisplay(solicitud)} icon={Landmark} />{solicitud.banco !== 'ACCION POR CHEQUE/NO APLICA BANCO' && (<><DetailItem label="Número de Cuenta" value={solicitud.numeroCuenta} icon={Hash} /><DetailItem label="Moneda de la Cuenta" value={getMonedaCuentaDisplay(solicitud)} icon={Banknote} /></>)}</div></div>
                  <div className="pt-3 print:pt-1"><div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 print:grid-cols-2 print:gap-x-8"><DetailItem label="Elaborar Cheque A" value={solicitud.elaborarChequeA} icon={User} /><DetailItem label="Elaborar Transferencia A" value={solicitud.elaborarTransferenciaA} icon={User} /></div></div>
                  <div className="pt-3 print:pt-1"><div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 print:grid-cols-2 print:gap-x-8"><div className="space-y-1"><CheckboxDetailItem label="Impuestos pendientes de pago por el cliente" checked={solicitud.impuestosPendientesCliente} /><CheckboxDetailItem label="Soporte" checked={solicitud.soporte} /><CheckboxDetailItem label="Impuestos pagados por el cliente mediante:" checked={solicitud.impuestosPagadosCliente} />{solicitud.impuestosPagadosCliente && (<div className="ml-6 pl-2 border-l border-dashed"><DetailItem label="R/C No." value={solicitud.impuestosPagadosRC} /><DetailItem label="T/B No." value={solicitud.impuestosPagadosTB} /><DetailItem label="Cheque No." value={solicitud.impuestosPagadosCheque} /></div>)}</div><div className="space-y-1"><CheckboxDetailItem label="Se añaden documentos adjuntos" checked={solicitud.documentosAdjuntos} /><CheckboxDetailItem label="Constancias de no retención" checked={solicitud.constanciasNoRetencion} />{solicitud.constanciasNoRetencion && (<div className="ml-6 pl-2 border-l border-dashed"><CheckboxDetailItem label="1%" checked={solicitud.constanciasNoRetencion1} /><CheckboxDetailItem label="2%" checked={solicitud.constanciasNoRetencion2} /></div>)}</div></div></div>
                  {solicitud.pagoServicios && (<div className="pt-3 print:pt-1"><h4 className="text-md font-medium text-primary mb-1 print:text-sm">Pago de Servicios</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 print:grid-cols-2 print:gap-x-8"><DetailItem label="Tipo de Servicio" value={solicitud.tipoServicio === 'OTROS' ? solicitud.otrosTipoServicio : solicitud.tipoServicio} icon={Settings2} /><DetailItem label="Factura Servicio" value={solicitud.facturaServicio} icon={FileText} /><DetailItem label="Institución Servicio" value={solicitud.institucionServicio} icon={Building} /></div></div>)}
                  <div className="pt-3 print:pt-1"><DetailItem label="Correos de Notificación" value={solicitud.correo} icon={Mail} /><DetailItem label="Observación" value={solicitud.observation} icon={MessageSquare} /></div>
                </div>
              </div>
              <div className="hidden print:block">
                <Image src={`/AconicExaminer/imagenes/FOOTERSOLICITUDETAIL.svg`} alt="Footer Solicitud Detail" width={800} height={100} className="w-full h-auto object-contain mt-6" data-ai-hint="company seal official" priority />
              </div>
              <div className="no-print mt-4 flex justify-end">
                   <Button onClick={handlePrint}>
                       <Printer className="mr-2 h-4 w-4" /> Imprimir
                   </Button>
               </div>
          </CardContent>
        </div>
    );
  };
  
  return (
    <Card className="w-full shadow-lg">
      {content()}
    </Card>
  );
}

    