
"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GitBranch,
  Banknote,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Briefcase,
  FileText,
  Shield,
  ShieldCheck
} from 'lucide-react';
import type { WorksheetWithCase, AforoCaseUpdate } from '@/types';
import { cn } from "@/lib/utils";

interface StatusBadgesProps {
  caseData: WorksheetWithCase;
}

const BadgeIcon: React.FC<{
  Icon: React.ElementType;
  tooltipText: string;
  isComplete: boolean | null; // null means not applicable
  pulse?: boolean;
}> = ({ Icon, tooltipText, isComplete, pulse }) => {
  if (isComplete === null) {
    return null; // Don't render the badge if it's not applicable
  }

  const badgeClass = cn(
    "h-6 w-6 rounded-full flex items-center justify-center border",
    isComplete ? "bg-blue-500 text-white border-blue-600" : "bg-gray-300 text-gray-600 border-gray-400",
    pulse && "animate-pulse"
  );
  
  const iconClass = "h-4 w-4";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={badgeClass}>
          <Icon className={iconClass} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const AcuseBadge: React.FC<{ log: AforoCaseUpdate | null | undefined }> = ({ log }) => {
    if (!log) {
        return (
             <Tooltip>
                <TooltipTrigger asChild>
                    <div><Shield className="h-5 w-5 text-gray-400" /></div>
                </TooltipTrigger>
                <TooltipContent><p>Acuse de recibido pendiente</p></TooltipContent>
            </Tooltip>
        )
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div><ShieldCheck className="h-5 w-5 text-blue-500" /></div>
            </TooltipTrigger>
            <TooltipContent>
                <p>Recibido por {log.updatedBy}</p>
            </TooltipContent>
        </Tooltip>
    );
};


const DocumentTypeBadge: React.FC<{ worksheetType: WorksheetWithCase['worksheet']['worksheetType'] }> = ({ worksheetType }) => {
    let Icon, text, tooltipText, bgColor, textColor;

    switch (worksheetType) {
        case 'anexo_5':
            Icon = null;
            text = '5';
            tooltipText = 'Anexo 5';
            bgColor = 'bg-cyan-500';
            textColor = 'text-white';
            break;
        case 'anexo_7':
            Icon = null;
            text = '7';
            tooltipText = 'Anexo 7';
            bgColor = 'bg-purple-500';
            textColor = 'text-white';
            break;
        case 'corporate_report':
            Icon = Briefcase;
            text = null;
            tooltipText = 'Reporte Corporativo';
            bgColor = 'bg-gray-700';
            textColor = 'text-white';
            break;
        case 'hoja_de_trabajo':
        default:
            Icon = BookOpen;
            text = null;
            tooltipText = 'Hoja de Trabajo';
            bgColor = 'bg-gray-300';
            textColor = 'text-gray-700';
            break;
    }

    const badgeClass = cn(
        "h-6 w-6 rounded-full flex items-center justify-center border",
        bgColor,
        textColor
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={badgeClass}>
                    {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-bold">{text}</span>}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltipText}</p>
            </TooltipContent>
        </Tooltip>
    );
};


export function StatusBadges({ caseData }: StatusBadgesProps) {
  // Logic for each badge
  const hasPermits = caseData.worksheet?.requiredPermits && caseData.worksheet.requiredPermits.length > 0;
  const allPermitsDone = hasPermits ? caseData.worksheet.requiredPermits.every(p => p.status === 'Entregado') : false;

  const hasPayments = caseData.pagos && caseData.pagos.length > 0;
  const allPaymentsDone = hasPayments ? caseData.pagos.every(p => p.paymentStatus === 'Pagado') : false;

  const hasIncident = caseData.incidentType === 'Rectificacion';
  const incidentApproved = hasIncident ? caseData.incidentStatus === 'Aprobada' : false;

  const hasValueDoubt = caseData.hasValueDoubt;
  const valueDoubtProcessed = hasValueDoubt ? !!caseData.valueDoubtStatus : false;

  const hasPrevio = !!caseData.examenPrevio;
  const previoCompleted = hasPrevio ? caseData.examenPrevio?.status === 'complete' : false;

  return (
    <TooltipProvider>
        <div className="flex items-center gap-1.5">
            <AcuseBadge log={caseData.acuseLog} />
            <DocumentTypeBadge worksheetType={caseData.worksheet?.worksheetType} />
            <BadgeIcon Icon={GitBranch} tooltipText="Permisos" isComplete={hasPermits ? allPermitsDone : null} />
            <BadgeIcon Icon={Banknote} tooltipText="Pagos" isComplete={hasPayments ? allPaymentsDone : null} />
            <BadgeIcon Icon={AlertTriangle} tooltipText="Incidencia" isComplete={hasIncident ? incidentApproved : null} />
            <BadgeIcon Icon={ShieldAlert} tooltipText="Duda de Valor" isComplete={hasValueDoubt ? valueDoubtProcessed : null} />
            <BadgeIcon Icon={FileText} tooltipText="Previo" isComplete={hasPrevio ? previoCompleted : null} />
        </div>
    </TooltipProvider>
  );
}
