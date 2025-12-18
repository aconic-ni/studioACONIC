
"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, getDoc, doc, getDocs, where } from 'firebase/firestore';
import type { Worksheet, no existeUpdate } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Inbox, Users, ChevronsUpDown, Download, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GestionLocalTable } from '@/components/gestion-local/GestionLocalTable';
import { useToast } from '@/hooks/use-toast';
import { AssignUserModal } from '@/components/gestion-local/AssignUserModal';
import { AforoCommentModal } from '@/components/gestion-local/AforoCommentModal';
import { WorksheetDetailModal } from '@/components/reporter/WorksheetDetailModal';
import { downloadAforoReportAsExcel } from '@/lib/fileExporterAforo';
import { ClaimCaseModal } from '@/components/gestion-local/ClaimCaseModal';

export default function GestionLocalPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [neFilter, setNeFilter] = useState('');
  const [consigneeFilter, setConsigneeFilter] = useState('');
  
  const [assignmentModal, setAssignmentModal] = useState<{ isOpen: boolean; type: 'aforador' | 'revisor' | 'digitador' | 'bulk-aforador' | 'bulk-revisor' | 'bulk-digitador'; worksheet?: Worksheet | null; } | null>(null);
  const [commentModal, setCommentModal] = useState<{ isOpen: boolean; worksheet: Worksheet } | null>(null);
  const [viewModal, setViewModal] = useState<{ isOpen: boolean; worksheet: Worksheet } | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);


  const fetchWorksheets = useCallback(() => {
    if (!user) return;
    setIsLoading(true);

    const q = query(
        collection(db, 'worksheets'), 
        where('worksheetType', 'in', ['hoja_de_trabajo', null]),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedWorksheetsPromises = snapshot.docs.map(async (docSnapshot) => {
        const worksheetData = { id: docSnapshot.id, ...docSnapshot.data() } as Worksheet;
        
        const aforoRef = doc(db, `worksheets/${docSnapshot.id}/aforo/metadata`);
        const aforoSnap = await getDoc(aforoRef);
        if (aforoSnap.exists()) {
          (worksheetData as any).aforo = aforoSnap.data();
        }
        
        return worksheetData;
      });

      const fetchedWorksheets = await Promise.all(fetchedWorksheetsPromises);
      setWorksheets(fetchedWorksheets);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching worksheets:", error);
      toast({ title: "Error", description: "No se pudieron cargar las hojas de trabajo.", variant: "destructive" });
      setIsLoading(false);
    });

    return unsubscribe;
  }, [user, toast]);

  useEffect(() => {
    const unsubscribe = fetchWorksheets();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchWorksheets]);

  const handleExport = async () => {
    if (filteredWorksheets.length === 0) {
      toast({ title: "No hay datos", description: "No hay casos en la tabla para exportar.", variant: "secondary" });
      return;
    }
    setIsExporting(true);
    
    const casesToExport = filteredWorksheets.map(ws => ({
        id: ws.id,
        ne: ws.ne,
        consignee: ws.consignee,
        merchandise: ws.description,
        declarationPattern: ws.patternRegime,
        ...((ws as any).aforo || {}) 
    }));

    const auditLogs: (no existeUpdate & { caseNe: string })[] = [];
    for (const ws of filteredWorksheets) {
        const logsQuery = query(collection(db, 'worksheets', ws.id, 'actualizaciones'), orderBy('updatedAt', 'asc'));
        const logSnapshot = await getDocs(logsQuery);
        logSnapshot.forEach(logDoc => {
            auditLogs.push({
                ...(logDoc.data() as no existeUpdate),
                caseNe: ws.ne
            });
        });
    }

    try {
      await downloadAforoReportAsExcel(casesToExport, auditLogs);
    } catch(e) {
      console.error("Error exporting:", e);
      toast({ title: "Error de Exportación", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };


  const filteredWorksheets = useMemo(() => {
    return worksheets.filter(ws => {
      const neMatch = neFilter ? ws.ne.toLowerCase().includes(neFilter.toLowerCase()) : true;
      const consigneeMatch = consigneeFilter ? ws.consignee.toLowerCase().includes(consigneeFilter.toLowerCase()) : true;
      return neMatch && consigneeMatch;
    });
  }, [worksheets, neFilter, consigneeFilter]);

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-screen-2xl mx-auto custom-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Gestión Local de Aforo</CardTitle>
                <CardDescription>Nueva vista optimizada para la asignación y seguimiento de aforos sobre hojas de trabajo.</CardDescription>
              </div>
              <Button onClick={() => setIsClaimModalOpen(true)}>
                <Edit className="mr-2 h-4 w-4" /> Reclamar Caso
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
              <Input placeholder="Filtrar por NE..." value={neFilter} onChange={e => setNeFilter(e.target.value)} className="max-w-xs" />
              <Input placeholder="Filtrar por Consignatario..." value={consigneeFilter} onChange={e => setConsigneeFilter(e.target.value)} className="max-w-xs" />
              <div className="flex gap-2 flex-wrap">
                 <Button variant="outline" onClick={() => setAssignmentModal({ isOpen: true, type: 'bulk-aforador' })} disabled={selectedRows.length === 0}>Asignar Aforador ({selectedRows.length})</Button>
                 <Button variant="outline" onClick={() => setAssignmentModal({ isOpen: true, type: 'bulk-revisor' })} disabled={selectedRows.length === 0}>Asignar Revisor ({selectedRows.length})</Button>
                 <Button variant="outline" onClick={() => setAssignmentModal({ isOpen: true, type: 'bulk-digitador' })} disabled={selectedRows.length === 0}>Asignar Digitador ({selectedRows.length})</Button>
                 <Button onClick={handleExport} variant="outline" disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                    Exportar
                 </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : filteredWorksheets.length === 0 ? (
              <div className="text-center py-10"><Inbox className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-lg font-medium">No hay hojas de trabajo</h3><p className="text-muted-foreground">No se encontraron hojas de trabajo con los filtros actuales.</p></div>
            ) : (
              <GestionLocalTable
                worksheets={filteredWorksheets}
                setWorksheets={setWorksheets}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                onAssign={(worksheet, type) => setAssignmentModal({ isOpen: true, type, worksheet })}
                onComment={(worksheet) => setCommentModal({ isOpen: true, worksheet })}
                onView={(worksheet) => setViewModal({ isOpen: true, worksheet })}
                isLoading={isLoading}
              />
            )}
          </CardContent>
        </Card>
      </div>

       {assignmentModal && (
        <AssignUserModal
          isOpen={assignmentModal.isOpen}
          onClose={() => setAssignmentModal(null)}
          worksheet={assignmentModal.worksheet}
          type={assignmentModal.type}
          selectedWorksheetIds={selectedRows}
          onAssignSuccess={() => {
            if (assignmentModal.worksheet || selectedRows.length > 0) {
              setWorksheets(prev => [...prev]); // Trigger re-render by creating a new array reference
            }
          }}
        />
      )}

      {commentModal && (
        <AforoCommentModal
            isOpen={commentModal.isOpen}
            onClose={() => setCommentModal(null)}
            worksheet={commentModal.worksheet}
        />
      )}

      {viewModal && (
        <WorksheetDetailModal
          isOpen={viewModal.isOpen}
          onClose={() => setViewModal(null)}
          worksheet={viewModal.worksheet}
        />
      )}
      
      <ClaimCaseModal 
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        onCaseClaimed={fetchWorksheets}
      />
    </AppShell>
  );
}
