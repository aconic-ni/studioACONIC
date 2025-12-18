
"use client"
import React from 'react';
import type { no existe, no existeStatus, AforadorStatus, DigitacionStatus, PreliquidationStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
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
  Repeat,
  Send,
  Search,
  CheckCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { DatePickerWithTime } from '../reports/DatePickerWithTime';
import { Timestamp } from 'firebase/firestore';
import { StatusBadges } from '../executive/StatusBadges';


interface MobileAforoCardProps {
    caseItem: no existe;
    savingState: { [key: string]: boolean };
    canEditFields: boolean;
    handleAutoSave: (caseId: string, field: keyof no existe, value: any, isTriggerFromFieldUpdate?: boolean) => void;
    handleValidatePattern: (caseId: string) => void;
    openAssignmentModal: (caseItem: no existe, type: 'aforador' | 'revisor') => void;
    openHistoryModal: (caseItem: no existe) => void;
    openIncidentModal: (caseItem: no existe) => void;
    openAforadorCommentModal: (caseItem: no existe) => void;
    openObservationModal: (caseItem: no existe) => void;
    handleRequestRevalidation: (caseItem: no existe) => void;
    handleAssignToDigitization: (caseItem: no existe) => void;
    handleViewWorksheet: (caseItem: no existe) => void;
    setSelectedIncidentForDetails: (caseItem: no existe) => void;
}

const getRevisorStatusBadgeVariant = (status?: no existeStatus) => {
    switch (status) { case 'Aprobado': return 'default'; case 'Rechazado': return 'destructive'; case 'Revalidación Solicitada': return 'secondary'; default: return 'outline'; }
};
const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) { case 'En revisión': return 'default'; case 'Incompleto': return 'destructive'; case 'En proceso': return 'secondary'; case 'Pendiente': return 'destructive'; default: return 'outline'; }
};


const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);


export const MobileAforoCard: React.FC<MobileAforoCardProps> = ({
  caseItem: c,
  savingState,
  canEditFields,
  handleAutoSave,
  handleValidatePattern,
  openAssignmentModal,
  openHistoryModal,
  openIncidentModal,
  openAforadorCommentModal,
  openObservationModal,
  handleRequestRevalidation,
  handleAssignToDigitization,
  handleViewWorksheet,
  setSelectedIncidentForDetails
}) => {
    const canEditThisRow = canEditFields || (c.aforador && c.aforador === c.aforador); // Simplified logic
    const isPatternValidated = c.isPatternValidated === true;
    const allowPatternEdit = c.revisorStatus === 'Rechazado';

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
                            {c.worksheetId && <DropdownMenuItem onSelect={() => handleViewWorksheet(c)}><BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo</DropdownMenuItem>}
                            <DropdownMenuItem onSelect={() => handleSearchPrevio(c.ne)}><Search className="mr-2 h-4 w-4" /> Buscar Previo</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openObservationModal(c)}><Eye className="mr-2 h-4 w-4" /> Ver/Editar Observación</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openHistoryModal(c)}><History className="mr-2 h-4 w-4" /> Ver Bitácora</DropdownMenuItem>
                            {canEditThisRow && <DropdownMenuItem onSelect={() => openIncidentModal(c)}><AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia</DropdownMenuItem>}
                            {c.incidentReported && <DropdownMenuItem onSelect={() => setSelectedIncidentForDetails(c)}><Eye className="mr-2 h-4 w-4" /> Ver Incidencia</DropdownMenuItem>}
                            {(c.aforador || canEditFields) && c.revisorStatus === 'Rechazado' && <DropdownMenuItem onSelect={() => handleRequestRevalidation(c)}><Repeat className="mr-2 h-4 w-4" /> Solicitar Revalidación</DropdownMenuItem>}
                            {canEditFields && c.revisorStatus === 'Aprobado' && <DropdownMenuItem onSelect={() => handleAssignToDigitization(c)} disabled={c.preliquidationStatus !== 'Aprobada'}><Send className="mr-2 h-4 w-4" /> Asignar a Digitación</DropdownMenuItem>}
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
                                <DetailRow label="Aforador">{c.aforador || 'Sin asignar'}</DetailRow>
                                <DetailRow label="Estado Aforador"><Badge variant={getAforadorStatusBadgeVariant(c.aforadorStatus)}>{c.aforadorStatus || 'Pendiente'}</Badge></DetailRow>
                                <DetailRow label="Revisor">{c.revisorAsignado || 'Sin asignar'}</DetailRow>
                                <DetailRow label="Estado Revisor"><Badge variant={getRevisorStatusBadgeVariant(c.revisorStatus)}>{c.revisorStatus || 'Pendiente'}</Badge></DetailRow>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
};