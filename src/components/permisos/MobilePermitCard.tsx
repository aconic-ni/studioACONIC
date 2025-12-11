
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PermitRow } from '@/app/permisos/page';
import type { DocumentStatus } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Briefcase, FileText, Hash, Calendar, Clock, User, CheckCircle, XCircle, Hourglass, MessageSquare, Building } from 'lucide-react';
import { PermitCommentModal } from '../executive/PermitCommentModal';
import type { RequiredPermit } from '@/types';

interface MobilePermitCardProps {
  permit: PermitRow;
  getStatusBadgeVariant: (status: DocumentStatus) => "default" | "destructive" | "secondary" | "outline" | null | undefined;
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode; icon: React.ElementType }> = ({ label, children, icon: Icon }) => (
    <div className="flex justify-between items-start py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground flex items-center">
            <Icon className="h-4 w-4 mr-2"/> {label}
        </p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);

const formatDate = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return format(date, 'dd/MM/yy', { locale: es });
};

export const MobilePermitCard: React.FC<MobilePermitCardProps> = ({ permit, getStatusBadgeVariant }) => {
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

    const StatusIcon = () => {
        switch (permit.status) {
            case 'Entregado': return <CheckCircle className="h-4 w-4 text-green-500"/>;
            case 'Rechazado': return <XCircle className="h-4 w-4 text-red-500"/>;
            case 'En Trámite': return <Hourglass className="h-4 w-4 text-blue-500"/>;
            default: return <Clock className="h-4 w-4 text-gray-500"/>;
        }
    }

    return (
        <>
        <Card className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-bold text-lg text-primary">{permit.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{permit.ne}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(permit.status)} className="flex items-center gap-1">
                        <StatusIcon />
                        {permit.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <DetailRow label="Consignatario" icon={Building}>
                    {permit.consignee || 'N/A'}
                </DetailRow>
                 <DetailRow label="Tipo de Trámite" icon={FileText}>
                    {permit.tipoTramite || 'N/A'}
                </DetailRow>
                <DetailRow label="Referencia" icon={FileText}>
                    {permit.reference || 'N/A'}
                </DetailRow>
                <DetailRow label="Factura Asociada" icon={Hash}>
                    {permit.facturaNumber || 'N/A'}
                </DetailRow>
                <DetailRow label="Ejecutivo Asignado" icon={User}>
                    {permit.assignedExecutive || permit.executive}
                </DetailRow>
                 <DetailRow label="Fecha Sometido" icon={Calendar}>
                    {formatDate(permit.tramiteDate)}
                </DetailRow>
                 <DetailRow label="Fecha Entrega Estimada" icon={Calendar}>
                    {formatDate(permit.estimatedDeliveryDate)}
                </DetailRow>
                 <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setIsCommentModalOpen(true)}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Ver Comentarios ({permit.comments?.length || 0})
                </Button>
            </CardContent>
        </Card>
        {permit && (
            <PermitCommentModal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                permit={permit}
                worksheetId={permit.ne}
                onCommentsUpdate={() => {}} // This is a read-only view, so no update logic needed here
            />
        )}
        </>
    );
}
