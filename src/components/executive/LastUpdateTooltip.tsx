"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { LastUpdateInfo } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';

const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : toDate(date);
    if (d instanceof Date && !isNaN(d.getTime())) {
        const formatString = 'dd/MM/yy HH:mm';
        return format(d, formatString, { locale: es });
    }
    return 'Fecha Inválida';
};

export const LastUpdateTooltip: React.FC<{ lastUpdate?: LastUpdateInfo | null; defaultUser?: string; defaultDate?: Timestamp | Date | null; caseCreation?: Timestamp | Date | null; }> = ({ lastUpdate, defaultUser, defaultDate, caseCreation }) => {
    const displayUser = lastUpdate?.by || defaultUser;
    let displayDate = lastUpdate?.at || defaultDate;

    // This handles the case where initial creation might be passed as `caseCreation`
    if (!displayDate && caseCreation) {
      displayDate = caseCreation;
    }
    
    if (!displayUser || !displayDate) return null;

    let isInitialEntry = false;
    if (caseCreation && displayDate && 'isEqual' in displayDate) {
        isInitialEntry = (displayDate as Timestamp).isEqual(caseCreation as Timestamp);
    }
    const label = isInitialEntry ? "Registro realizado por" : "Modificado por";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground ml-1 cursor-pointer"/>
            </TooltipTrigger>
            <TooltipContent>
                <p>{label}: {displayUser}</p>
                <p>Fecha: {formatDate(displayDate)}</p>
            </TooltipContent>
        </Tooltip>
    );
};
