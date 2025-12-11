"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AforoCase, LastUpdateInfo } from "@/types";
import { ArrowRight, CheckCircle, Clock, Hourglass, XCircle } from "lucide-react";
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from "firebase/firestore";

interface StatusProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseData: AforoCase;
}

const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : toDate(date);
    return format(d, "dd/MM/yy HH:mm", { locale: es });
};

const StatusStep = ({ title, status, lastUpdate, icon }: { title: string; status: string; lastUpdate?: LastUpdateInfo | null; icon: React.ReactNode }) => {
    const getVariant = (status: string) => {
        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('aprobado') || lowerStatus.includes('completo')) return 'default';
        if (lowerStatus.includes('rechazado') || lowerStatus.includes('incompleto')) return 'destructive';
        if (lowerStatus.includes('proceso') || lowerStatus.includes('revisión')) return 'secondary';
        return 'outline';
    };

    return (
        <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
                <div className="rounded-full bg-primary/10 text-primary p-2">
                    {icon}
                </div>
                <div className="w-px h-12 bg-border mt-2"></div>
            </div>
            <div className="flex-1 pb-12">
                <p className="font-semibold text-foreground">{title}</p>
                <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getVariant(status)}>{status}</Badge>
                    {lastUpdate && lastUpdate.by && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p className="text-xs text-muted-foreground cursor-help">
                                        por {lastUpdate.by}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Fecha: {formatDate(lastUpdate.at)}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>
        </div>
    );
}

export function StatusProcessModal({ isOpen, onClose, caseData }: StatusProcessModalProps) {
    if (!isOpen) return null;

    const getStatusInfo = (status: string | undefined | null, defaultStatus: string, iconMapping: any) => {
        const currentStatus = status || defaultStatus;
        const Icon = iconMapping[currentStatus] || Clock;
        return { status: currentStatus, Icon };
    };

    const aforadorStatusInfo = getStatusInfo(caseData.aforadorStatus, 'Pendiente ', {
        'En revisión': Hourglass,
        'Pendiente ': Clock,
        'Incompleto': XCircle,
        'En proceso': Hourglass
    });

    const revisorStatusInfo = getStatusInfo(caseData.revisorStatus, 'Pendiente', {
        'Aprobado': CheckCircle,
        'Rechazado': XCircle,
        'Pendiente': Clock
    });
    
    const preliquidationStatusInfo = getStatusInfo(caseData.preliquidationStatus, 'Pendiente', {
        'Aprobada': CheckCircle,
        'Pendiente': Clock
    });

    const digitacionStatusInfo = getStatusInfo(caseData.digitacionStatus, 'Pendiente', {
        'Trámite Completo': CheckCircle,
        'Pendiente de Digitación': Clock,
        'En Proceso': Hourglass,
        'Almacenado': CheckCircle
    });


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Línea de Proceso del Caso</DialogTitle>
                    <DialogDescription>
                        Seguimiento del estado para el NE: <span className="font-bold text-foreground">{caseData.ne}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 -mb-12">
                    <StatusStep
                        title="1. Proceso de Aforo"
                        status={aforadorStatusInfo.status}
                        lastUpdate={caseData.aforadorStatusLastUpdate}
                        icon={<aforadorStatusInfo.Icon className="h-5 w-5" />}
                    />
                     <StatusStep
                        title="2. Revisión de Agente"
                        status={revisorStatusInfo.status}
                        lastUpdate={caseData.revisorStatusLastUpdate}
                        icon={<revisorStatusInfo.Icon className="h-5 w-5" />}
                    />
                    <StatusStep
                        title="3. Preliquidación"
                        status={preliquidationStatusInfo.status}
                        lastUpdate={caseData.preliquidationStatusLastUpdate}
                        icon={<preliquidationStatusInfo.Icon className="h-5 w-5" />}
                    />
                    <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                            <div className="rounded-full bg-primary/10 text-primary p-2">
                                <digitacionStatusInfo.Icon className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-foreground">4. Digitación</p>
                             <div className="flex items-center gap-2 mt-1">
                                <Badge variant={getVariant(digitacionStatusInfo.status)}>{digitacionStatusInfo.status}</Badge>
                                {caseData.digitacionStatusLastUpdate && caseData.digitacionStatusLastUpdate.by && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <p className="text-xs text-muted-foreground cursor-help">
                                                    por {caseData.digitacionStatusLastUpdate.by}
                                                </p>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Fecha: {formatDate(caseData.digitacionStatusLastUpdate.at)}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function getVariant(status: string) {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('aprobado') || lowerStatus.includes('completo') || lowerStatus.includes('almacenado')) return 'default';
    if (lowerStatus.includes('rechazado') || lowerStatus.includes('incompleto')) return 'destructive';
    if (lowerStatus.includes('proceso') || lowerStatus.includes('revisión')) return 'secondary';
    return 'outline';
}
