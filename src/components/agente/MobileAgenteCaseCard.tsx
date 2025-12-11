
"use client";
import React from 'react';
import type { AforoCase, AforoCaseStatus, PreliquidationStatus, DigitacionStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BookOpen, AlertTriangle, History, CheckCircle, XCircle, Clock } from 'lucide-react';

interface MobileAgenteCaseCardProps {
  caseItem: AforoCase;
  caseActions: {
    openActionModal: (caseItem: AforoCase, action: 'observation' | 'history') => void;
    handleViewWorksheet: (caseItem: AforoCase) => void;
    setIncidentToView: (caseItem: AforoCase) => void;
  };
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-start py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);

const getStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) {
        case 'Aprobado': return 'default';
        case 'Rechazado': return 'destructive';
        case 'Revalidación Solicitada': return 'secondary';
        default: return 'outline';
    }
};

const getStatusIcon = (status?: AforoCaseStatus) => {
    switch (status) {
        case 'Aprobado': return <CheckCircle className="h-4 w-4 text-green-500"/>;
        case 'Rechazado': return <XCircle className="h-4 w-4 text-red-500"/>;
        default: return <Clock className="h-4 w-4 text-gray-500"/>;
    }
}

const getPreliquidationStatusBadge = (status?: PreliquidationStatus) => {
    switch(status) {
      case 'Aprobada': return <Badge variant="default" className="bg-green-600">Aprobada</Badge>;
      default: return <Badge variant="outline">Pendiente</Badge>;
    }
};

const getDigitacionBadge = (status?: DigitacionStatus) => {
    if (status) return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>;
    return <Badge variant="outline">Pendiente</Badge>;
};

export const MobileAgenteCaseCard: React.FC<MobileAgenteCaseCardProps> = ({ caseItem: c, caseActions }) => {
    const isPending = c.revisorStatus === 'Pendiente' || !c.revisorStatus;

    return (
        <Card key={c.id} className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-bold text-lg text-primary">{c.ne}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{c.consignee}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(c.revisorStatus)} className="flex items-center gap-1">
                        {getStatusIcon(c.revisorStatus)}
                        {c.revisorStatus || 'Pendiente'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 mb-4">
                    <DetailRow label="Aforador">{c.aforador || 'N/A'}</DetailRow>
                    <DetailRow label="Modelo">{c.declarationPattern}</DetailRow>
                    <DetailRow label="Posiciones">{c.totalPosiciones || 'N/A'}</DetailRow>
                </div>
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Más Detalles</AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-2 pt-2">
                                <DetailRow label="Estado Preliquidación">{getPreliquidationStatusBadge(c.preliquidationStatus)}</DetailRow>
                                <DetailRow label="Digitador">{c.digitadorAsignado || 'N/A'}</DetailRow>
                                <DetailRow label="Estado Digitación">{getDigitacionBadge(c.digitacionStatus)}</DetailRow>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
            <CardFooter className="flex justify-between gap-2">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Ver...</Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => caseActions.handleViewWorksheet(c)}><BookOpen className="mr-2 h-4 w-4" /> Hoja de Trabajo</DropdownMenuItem>
                        {c.incidentReported && <DropdownMenuItem onSelect={() => caseActions.setIncidentToView(c)}><AlertTriangle className="mr-2 h-4 w-4" /> Incidencia</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => caseActions.openActionModal(c, 'history')}><History className="mr-2 h-4 w-4" /> Bitácora</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => caseActions.openActionModal(c, 'observation')} disabled={!isPending}>Rechazar</Button>
                    <Button size="sm" onClick={() => caseActions.openActionModal(c, 'observation')} disabled={!isPending}>Aprobar</Button>
                 </div>
            </CardFooter>
        </Card>
    );
}
    