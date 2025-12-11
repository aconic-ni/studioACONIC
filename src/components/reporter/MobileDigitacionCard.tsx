"use client";
import React from 'react';
import type { AforoCase, DigitacionStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '../ui/input';
import { History, Edit, User, PlusSquare } from 'lucide-react';

interface MobileDigitacionCardProps {
  caseItem: AforoCase;
  canEdit: boolean;
  isDigitador: boolean;
  savingState: { [key: string]: boolean };
  handleStatusChange: (caseId: string, value: DigitacionStatus) => void;
  handleAutoSave: (caseId: string, field: keyof AforoCase, value: any) => void;
  openCommentModal: (caseItem: AforoCase) => void;
  openHistoryModal: (caseItem: AforoCase) => void;
  setSelectedCaseForAssignment: (caseItem: AforoCase) => void;
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);

export const MobileDigitacionCard: React.FC<MobileDigitacionCardProps> = ({
  caseItem,
  canEdit,
  isDigitador,
  savingState,
  handleStatusChange,
  handleAutoSave,
  openCommentModal,
  openHistoryModal,
  setSelectedCaseForAssignment
}) => {
    const isCompleted = caseItem.digitacionStatus === 'Trámite Completo';
    const currentStatus = caseItem.digitacionStatus === 'Pendiente' ? 'Pendiente de Digitación' : caseItem.digitacionStatus;

    return (
        <Card key={caseItem.id} className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-bold text-lg text-primary">{caseItem.ne}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{caseItem.consignee}</p>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir</span><PlusSquare className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openCommentModal(caseItem)}><Edit className="mr-2 h-4 w-4" /> Ver/Editar Observación</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openHistoryModal(caseItem)}><History className="mr-2 h-4 w-4" /> Ver Bitácora</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <DetailRow label="Ejecutivo">{caseItem.executive}</DetailRow>
                <DetailRow label="Digitador Asignado">
                     <div className="flex items-center gap-2">
                        <span>{caseItem.digitadorAsignado || 'Sin asignar'}</span>
                        {canEdit && !isCompleted && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedCaseForAssignment(caseItem)}>
                                {caseItem.digitadorAsignado ? 'Cambiar' : 'Asignar'}
                            </Button>
                        )}
                    </div>
                </DetailRow>
                <div className="py-2">
                     <p className="text-sm font-medium text-muted-foreground mb-1">Estado Digitación</p>
                     <Select
                        value={currentStatus ?? ''}
                        onValueChange={(value: DigitacionStatus) => handleStatusChange(caseItem.id, value)}
                        disabled={(!isDigitador && !canEdit) || isCompleted}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pendiente de Digitación">Pendiente de Digitación</SelectItem>
                            <SelectItem value="En Proceso">En Proceso</SelectItem>
                            <SelectItem value="Almacenado">Almacenado</SelectItem>
                            <SelectItem value="Completar Trámite">Completar Trámite</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="py-2">
                     <p className="text-sm font-medium text-muted-foreground mb-1">Declaración Aduanera</p>
                    {isCompleted ? (
                        <Badge variant="default">{caseItem.declaracionAduanera}</Badge>
                    ) : (
                        <Input
                            placeholder="Ingrese No. Declaración"
                            defaultValue={caseItem.declaracionAduanera ?? ''}
                            onBlur={(e) => handleAutoSave(caseItem.id, 'declaracionAduanera', e.target.value)}
                            disabled={!isDigitador && !canEdit}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
