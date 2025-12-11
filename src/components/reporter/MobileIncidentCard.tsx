
"use client";

import React from 'react';
import type { AforoCase, IncidentStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Clock, CheckCircle, XCircle, User } from 'lucide-react';

interface MobileIncidentCardProps {
  incident: AforoCase;
  onReview: (incident: AforoCase) => void;
}

const formatDate = (timestamp: Timestamp | Date | null | undefined): string => {
    if (!timestamp) return 'N/A';
    const d = (timestamp as Timestamp)?.toDate ? (timestamp as Timestamp).toDate() : (timestamp as Date);
    return format(d, "dd/MM/yy HH:mm", { locale: es });
};

const getStatusBadgeVariant = (status?: IncidentStatus) => {
    switch (status) {
        case 'Aprobada': return 'default';
        case 'Rechazada': return 'destructive';
        case 'Pendiente':
        default: return 'secondary';
    }
};

const getStatusIcon = (status?: IncidentStatus) => {
    switch (status) {
        case 'Aprobada': return <CheckCircle className="h-4 w-4 text-green-500"/>;
        case 'Rechazada': return <XCircle className="h-4 w-4 text-red-500"/>;
        default: return <Clock className="h-4 w-4 text-gray-500"/>;
    }
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-start py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);

export const MobileIncidentCard: React.FC<MobileIncidentCardProps> = ({ incident, onReview }) => {

    return (
        <Card key={incident.id} className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-bold text-lg text-primary">{incident.ne}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{incident.consignee}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(incident.incidentStatus)} className="flex items-center gap-1">
                        {getStatusIcon(incident.incidentStatus)}
                        {incident.incidentStatus}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 mb-4">
                    <DetailRow label="Reportado Por">
                        <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{incident.incidentReportedBy}</span>
                        </div>
                    </DetailRow>
                    <DetailRow label="Fecha de Reporte">{formatDate(incident.incidentReportedAt)}</DetailRow>
                </div>
            </CardContent>
            <CardFooter>
                 <Button variant="default" size="sm" onClick={() => onReview(incident)} className="w-full">
                    <Eye className="mr-2 h-4 w-4" /> Revisar Esquela
                </Button>
            </CardFooter>
        </Card>
    );
}
