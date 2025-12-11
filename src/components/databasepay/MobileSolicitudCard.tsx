"use client";
import React from 'react';
import type { SolicitudRecord } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Banknote,
  CalendarDays,
  FileText,
  Info,
  User,
  Eye,
  MessageSquareText,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface MobileSolicitudCardProps {
  solicitud: SolicitudRecord;
  cardActions: {
    onViewDetails: (solicitud: SolicitudRecord) => void;
    onOpenCommentsDialog: (solicitudId: string) => void;
    onDeleteSolicitud: (solicitudId: string) => void;
    onOpenViewErrorDialog: (errorMessage: string) => void; // Added this prop
  };
  currentUserRole?: string;
}

const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    return format(date, "dd/MM/yy", { locale: es });
};

const formatCurrency = (amount?: number | string | null, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';
    return `${prefix}${num.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-start py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);

const getPaymentStatusBadge = (solicitud: SolicitudRecord, onViewError: () => void) => {
    if (solicitud.paymentStatus === 'Pagado') {
        return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1"/> Pagado
            </Badge>
        );
    }
    if (solicitud.paymentStatus?.startsWith('Error:')) {
        return (
            <Button variant="link" className="p-0 h-auto" onClick={onViewError}>
                <Badge variant="destructive" className="cursor-pointer flex items-center">
                    <AlertCircle className="h-3.5 w-3.5 mr-1"/> Error
                </Badge>
            </Button>
        );
    }
    return <Badge variant="outline">Pendiente</Badge>;
}

const getReceptionStatusBadge = (solicitud: SolicitudRecord) => {
    return solicitud.recepcionDCStatus ? (
        <Badge className="bg-blue-100 text-blue-700 flex items-center">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1"/> Recibido
        </Badge>
    ) : (
        <Badge variant="outline">Pendiente</Badge>
    );
};

export const MobileSolicitudCard: React.FC<MobileSolicitudCardProps> = ({
    solicitud,
    cardActions,
    currentUserRole
}) => {

    const isUrgent = solicitud.hasOpenUrgentComment;
    let cardClass = "w-full";
    if (isUrgent) {
      cardClass = `${cardClass} bg-red-100 dark:bg-red-900/40`;
    } else if (solicitud.soporte) {
      cardClass = `${cardClass} bg-amber-50 dark:bg-amber-800/30`;
    }

    return (
        <Card key={solicitud.solicitudId} className={cardClass}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-bold text-lg text-primary">{solicitud.examNe}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{solicitud.consignatario}</p>
                    </div>
                     <div className="flex flex-col items-end">
                        <span className="font-bold text-lg">{formatCurrency(solicitud.monto, solicitud.montoMoneda ?? undefined)}</span>
                         <span className="text-xs text-muted-foreground">{solicitud.solicitudId}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 mb-4">
                    <DetailRow label="Fecha Solicitud">
                        {formatDate(solicitud.examDate)}
                    </DetailRow>
                    <DetailRow label="Guardado Por">
                        <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{solicitud.savedBy}</span>
                        </div>
                    </DetailRow>
                    <DetailRow label="Estado Pago">
                        {getPaymentStatusBadge(solicitud, () => cardActions.onOpenViewErrorDialog(solicitud.paymentStatus!.substring("Error: ".length)))}
                    </DetailRow>
                     <DetailRow label="Recepción Docs">
                        {getReceptionStatusBadge(solicitud)}
                    </DetailRow>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="details">
                        <AccordionTrigger>Más Detalles</AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-2 pt-2">
                                <DetailRow label="Referencia">{solicitud.examReference || 'N/A'}</DetailRow>
                                <DetailRow label="Declaración">{solicitud.declaracionNumero || 'N/A'}</DetailRow>
                                <DetailRow label="ID Solicitud">{solicitud.solicitudId}</DetailRow>
                                 <DetailRow label="Estado Solicitud">
                                    <div className="flex flex-wrap gap-1 justify-end">
                                      {solicitud.isMemorandum && <Badge variant="destructive" className="text-xs">Memorandum</Badge>}
                                      {solicitud.documentosAdjuntos && <Badge className="text-xs bg-blue-100 text-blue-700">Docs Adjuntos</Badge>}
                                      {solicitud.soporte && <Badge className="text-xs bg-amber-100 text-amber-700">Soporte</Badge>}
                                    </div>
                                </DetailRow>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
             <CardFooter className="flex justify-end gap-2">
                {currentUserRole === 'admin' && (
                    <Button variant="outline" size="sm" onClick={() => cardActions.onDeleteSolicitud(solicitud.solicitudId)} className="text-destructive hover:text-destructive">
                       <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                 <Button variant="outline" size="sm" onClick={() => cardActions.onOpenCommentsDialog(solicitud.solicitudId)}>
                   <MessageSquareText className="h-4 w-4" />
                </Button>
                <Button variant="default" size="sm" onClick={() => cardActions.onViewDetails(solicitud)}>
                    <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                </Button>
            </CardFooter>
        </Card>
    );
};
