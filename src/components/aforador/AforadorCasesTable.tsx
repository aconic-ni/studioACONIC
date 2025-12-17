
"use client";
import React, { useState } from 'react';
import type { WorksheetWithCase, AforoCase } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, Timestamp, collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Save, Loader2 } from 'lucide-react';
import { WorksheetDetailModal } from '../reporter/WorksheetDetailModal';

interface AforadorCasesTableProps {
  cases: WorksheetWithCase[];
  onRefresh: () => void;
}

export function AforadorCasesTable({ cases, onRefresh }: AforadorCasesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [positions, setPositions] = useState<{ [key: string]: string }>({});
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  const [worksheetToView, setWorksheetToView] = useState<WorksheetWithCase['worksheet'] | null>(null);


  const handlePositionChange = (caseId: string, value: string) => {
    setPositions(prev => ({ ...prev, [caseId]: value }));
  };

  const handleSavePosition = async (caseData: WorksheetWithCase) => {
    const caseId = caseData.id;
    const newPositionValue = positions[caseId];

    if (!newPositionValue || isNaN(Number(newPositionValue))) {
      toast({ title: "Valor inválido", description: "Por favor, ingrese un número válido para las posiciones.", variant: "destructive" });
      return;
    }
    
    if (!user || !user.displayName) {
        toast({ title: "Error", description: "Debe estar autenticado.", variant: "destructive" });
        return;
    }

    setSavingState(prev => ({ ...prev, [caseId]: true }));

    const aforoMetadataRef = doc(db, 'worksheets', caseId, 'aforo', 'metadata');
    const updatesCollectionRef = collection(db, 'worksheets', caseId, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const updateData = {
            totalPosiciones: Number(newPositionValue),
            aforadorStatus: 'En revisión',
            aforadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        };

        batch.set(aforoMetadataRef, updateData, { merge: true });

        batch.set(doc(updatesCollectionRef), {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'totalPosiciones',
            oldValue: (caseData as any).aforo?.totalPosiciones || null,
            newValue: Number(newPositionValue),
            comment: 'Total de posiciones actualizado por aforador.'
        });

        await batch.commit();

        toast({
            title: "Guardado",
            description: `Total de posiciones para el NE ${caseData.ne} guardado y estado actualizado a "En revisión".`
        });
        onRefresh();

    } catch (error) {
        console.error("Error saving positions:", error);
        toast({ title: "Error", description: "No se pudo guardar la información.", variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  };

  if (cases.length === 0) {
    return <p className="text-center text-muted-foreground p-4">No tiene casos asignados pendientes.</p>;
  }

  return (
    <>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Modelo (Patrón)</TableHead>
            <TableHead>Fecha Asignación</TableHead>
            <TableHead>Total Posiciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => {
            const aforoData = (c as any).aforo;
            return (
            <TableRow key={c.id}>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => setWorksheetToView(c.worksheet)}>
                    <Eye className="mr-2 h-4 w-4"/> Ver Hoja
                </Button>
              </TableCell>
              <TableCell className="font-medium">{c.ne}</TableCell>
              <TableCell>{c.consignee}</TableCell>
              <TableCell>{aforoData?.declarationPattern || 'N/A'}</TableCell>
              <TableCell>{c.assignmentDate ? format(c.assignmentDate.toDate(), 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A'}</TableCell>
              <TableCell>
                {aforoData?.aforadorStatus === 'En revisión' ? (
                    <span className="font-semibold text-green-600">{aforoData.totalPosiciones}</span>
                ) : (
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="Ingrese posiciones"
                            defaultValue={aforoData?.totalPosiciones || ''}
                            onChange={(e) => handlePositionChange(c.id, e.target.value)}
                            disabled={savingState[c.id]}
                            className="w-40"
                        />
                        <Button
                            size="sm"
                            onClick={() => handleSavePosition(c)}
                            disabled={savingState[c.id] || !positions[c.id]}
                        >
                          {savingState[c.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                          Guardar
                        </Button>
                    </div>
                )}
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
    {worksheetToView && (
      <WorksheetDetailModal
        isOpen={!!worksheetToView}
        onClose={() => setWorksheetToView(null)}
        worksheet={worksheetToView}
      />
    )}
    </>
  );
}
