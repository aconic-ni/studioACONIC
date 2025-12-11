
"use client";
import React from 'react';
import type { AforoCase, AforoCaseStatus, AforadorStatus, DigitacionStatus, PreliquidationStatus, WorksheetWithCase } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Timestamp } from 'firebase/firestore';
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  FilePlus,
  BookOpen,
  Banknote,
  Bell as BellIcon,
  AlertTriangle,
  ShieldAlert,
  History,
  Eye,
  MessageSquare,
  PlusSquare,
  CheckCircle,
  Search
} from 'lucide-react';
import { DatePickerWithTime } from '../reports/DatePickerWithTime';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { StatusBadges } from './StatusBadges';

interface MobileCaseCardProps {
    caseData: WorksheetWithCase;
    savingState: { [key: string]: boolean };
    caseActions: any;
    onAutoSave: (caseId: string, field: keyof AforoCase, value: any) => void;
    approvePreliquidation: (caseId: string) => void;
}

const formatDate = (date: Date | Timestamp | null | undefined, includeTime: boolean = true): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : toDate(date);
    const formatString = includeTime ? "dd/MM/yy HH:mm" : "dd/MM/yy";
    return format(d, formatString, { locale: es });
};

const getRevisorStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) { case 'Aprobado': return 'default'; case 'Rechazado': return 'destructive'; case 'Revalidación Solicitada': return 'secondary'; default: return 'outline'; }
};
const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) { case 'En revisión': return 'default'; case 'Incompleto': return 'destructive'; case 'En proceso': return 'secondary'; case 'Pendiente': return 'destructive'; default: return 'outline'; }
};
const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Trámite Completo') { return <Badge variant="default" className="bg-green-600">{declaracion || 'Finalizado'}</Badge> }
    if (status) { return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>; }
    return <Badge variant="outline">Pendiente</Badge>;
}
const getPreliquidationStatusBadge = (status?: PreliquidationStatus) => {
    switch(status) {
      case 'Aprobada': return <Badge variant="default" className="bg-green-600">Aprobada</Badge>;
      default: return <Badge variant="outline">Pendiente</Badge>;
    }
};

const getIncidentTypeDisplay = (c: AforoCase) => {
    const types = [];
    if (c.incidentType === 'Rectificacion') types.push('Rectificación');
    if (c.hasValueDoubt) types.push('Duda de Valor');
    return types.length > 0 ? types.join(' / ') : 'N/A';
  };


const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);

export const MobileCaseCard: React.FC<MobileCaseCardProps> = ({
    caseData: c,
    savingState,
    caseActions,
    onAutoSave,
    approvePreliquidation
}) => {
    const facturas = c.facturaNumber ? c.facturaNumber.split(';').map(f => f.trim()) : [];
    const firstFactura = facturas[0] || 'N/A';

    return (
        <Card key={c.id} className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-bold text-lg text-primary">{c.ne}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{c.consignee}</p>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir</span><PlusSquare className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => caseActions.handleViewWorksheet(c)} disabled={!c.worksheetId}>
                                <BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => caseActions.handleSearchPrevio(c.ne)}>
                                <Search className="mr-2 h-4 w-4" /> Buscar Previo
                            </DropdownMenuItem>
                             <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForDocs(c)} disabled={!c}>
                                <FilePlus className="mr-2 h-4 w-4" /> Docs y Permisos
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForQuickRequest(c)} disabled={!c.worksheet}>
                                <FilePlus className="mr-2 h-4 w-4" /> Solicitar Previo
                            </DropdownMenuItem>
                             <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForPayment(c)} disabled={!c}>
                                <Banknote className="mr-2 h-4 w-4" /> Solicitud de Pago
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForPaymentList(c)} disabled={!c}>
                                <Banknote className="mr-2 h-4 w-4 text-blue-500" /> Ver Pagos
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForResa(c)} disabled={!c}>
                                <BellIcon className="mr-2 h-4 w-4 text-orange-500" /> Notificar RESA
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForIncident(c)} disabled={!c}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForValueDoubt(c)} disabled={!c}>
                                <ShieldAlert className="mr-2 h-4 w-4 text-rose-600" /> Reportar Duda de Valor
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForHistory(c)} disabled={!c}><History className="mr-2 h-4 w-4" /> Ver Bitácora</DropdownMenuItem>
                            {c.incidentReported && (<DropdownMenuItem onSelect={() => caseActions.setSelectedIncidentForDetails(c)}><Eye className="mr-2 h-4 w-4" /> Ver Incidencia</DropdownMenuItem>)}
                             <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForComment(c)}><MessageSquare className="mr-2 h-4 w-4" /> Añadir/Ver Comentarios</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-center items-center mb-4">
                    <StatusBadges caseData={c} />
                </div>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Ver Detalles Completos</AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-2 pt-2">
                                <DetailRow label="Ejecutivo">{c.executive}</DetailRow>
                                <DetailRow label="Factura">{firstFactura}</DetailRow>
                                <DetailRow label="Estado Aforador"><Badge variant={getAforadorStatusBadgeVariant(c.aforadorStatus)}>{c.aforadorStatus || 'Pendiente'}</Badge></DetailRow>
                                <DetailRow label="Estado Revisor"><Badge variant={getRevisorStatusBadgeVariant(c.revisorStatus)}>{c.revisorStatus || 'Pendiente'}</Badge></DetailRow>
                                <DetailRow label="Preliquidación">
                                    {c.revisorStatus === 'Aprobado' && c.preliquidationStatus !== 'Aprobada' ? (
                                        <Button size="sm" onClick={() => approvePreliquidation(c.id)} disabled={savingState[c.id]}>
                                            <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                                        </Button>
                                    ) : ( getPreliquidationStatusBadge(c.preliquidationStatus) )}
                                </DetailRow>
                                <DetailRow label="Estado Digitación">{getDigitacionBadge(c.digitacionStatus, c.declaracionAduanera)}</DetailRow>
                                <DetailRow label="Tipo Incidencia">{getIncidentTypeDisplay(c)}</DetailRow>
                                <DetailRow label="Facturado">
                                     {c.facturado ? <Badge variant="default" className="bg-green-600">Facturado</Badge> : 'No'}
                                </DetailRow>
                                <div className="py-2">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Selectividad</p>
                                    <Select
                                        value={c.selectividad || ''}
                                        onValueChange={(value) => onAutoSave(c.id, 'selectividad', value)}
                                        disabled={savingState[c.id] || !c.declaracionAduanera}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="VERDE">VERDE</SelectItem>
                                            <SelectItem value="AMARILLO">AMARILLO</SelectItem>
                                            <SelectItem value="ROJO">ROJO</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="py-2">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Fecha Despacho</p>
                                    <DatePickerWithTime
                                        date={(c.fechaDespacho as Timestamp)?.toDate()}
                                        onDateChange={(d) => onAutoSave(c.id, 'fechaDespacho', d ? Timestamp.fromDate(d) : null)}
                                        disabled={savingState[c.id] || (c.selectividad !== 'VERDE' && c.selectividad !== 'ROJO')}
                                    />
                                </div>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
};
