"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc, addDoc, getDocs, writeBatch, getCountFromServer } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, DigitacionStatus, AforoCaseUpdate, AppUser, LastUpdateInfo, Worksheet, WorksheetWithCase } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, History, Edit, User, PlusSquare, FileText, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AforoCaseHistoryModal } from './AforoCaseHistoryModal';
import { DigitizationCommentModal } from './DigitizationCommentModal';
import { CompleteDigitizationModal } from './CompleteDigitizationModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AssignUserModal } from './AssignUserModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDigitacionCard } from './MobileDigitacionCard';

interface DigitizationCasesTableProps {
  filters: {
    ne?: string;
  };
  setAllFetchedCases: (cases: WorksheetWithCase[]) => void;
  displayCases: WorksheetWithCase[];
}

const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    if (d instanceof Date && !isNaN(d.getTime())) {
        const formatString = 'dd/MM/yy HH:mm';
        return format(d, formatString, { locale: es });
    }
    return 'Fecha Inválida';
};

const LastUpdateTooltip = ({ lastUpdate, caseCreation }: { lastUpdate?: LastUpdateInfo | null, caseCreation: Timestamp }) => {
    if (!lastUpdate || !lastUpdate.at) return null;

    const isInitialEntry = lastUpdate.at.isEqual(caseCreation);
    const label = isInitialEntry ? "Registro realizado por" : "Modificado por";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground ml-2 cursor-pointer"/>
            </TooltipTrigger>
            <TooltipContent>
                <p>{label}: {lastUpdate.by}</p>
                <p>Fecha: {formatDate(lastUpdate.at)}</p>
            </TooltipContent>
        </Tooltip>
    );
};


export function DigitizationCasesTable({ filters, setAllFetchedCases, displayCases }: DigitizationCasesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForComment, setSelectedCaseForComment] = useState<AforoCase | null>(null);
  const [selectedCaseForCompletion, setSelectedCaseForCompletion] = useState<AforoCase | null>(null);
  const [selectedCaseForAssignment, setSelectedCaseForAssignment] = useState<AforoCase | null>(null);


  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any) => {
    if (!user || !user.displayName) {
        toast({ title: "No autenticado", description: "Debe iniciar sesión para guardar cambios." });
        return;
    }

    const originalCase = displayCases.find(c => c.id === caseId);
    if (!originalCase) return;

    const oldValue = originalCase[field as keyof AforoCase];
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
        return;
    }
    
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const updateData: { [key: string]: any } = { [field]: value };
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        if (field === 'digitacionStatus') {
            updateData.digitacionStatusLastUpdate = userInfo;
        }
        if (field === 'digitadorAsignado') {
            updateData.digitadorAsignadoLastUpdate = userInfo;
        }
        
        batch.update(caseDocRef, updateData);

        const updateLog: AforoCaseUpdate = {
            updatedAt: now,
            updatedBy: user.displayName,
            field: field as keyof AforoCase,
            oldValue: oldValue ?? null,
            newValue: value,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);

        await batch.commit();

        toast({ title: "Guardado Automático", description: `El campo se ha actualizado.` });

    } catch (error) {
        console.error("Error updating case:", error);
        toast({ title: "Error", description: `No se pudo guardar el cambio.`, variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, displayCases, toast]);


  useEffect(() => {
    setIsLoading(true);

    const fetchAssignableUsers = async () => {
        const usersMap = new Map<string, AppUser>();
        const rolesToFetch = ['aforador', 'coordinadora', 'supervisor', 'digitador'];
        
        try {
            const usersQuery = query(collection(db, 'users'), where('role', 'in', rolesToFetch));
            const querySnapshot = await getDocs(usersQuery);
            querySnapshot.forEach(doc => {
                const userData = { uid: doc.id, ...doc.data() } as AppUser;
                if (!usersMap.has(userData.uid) && userData.displayName) {
                    usersMap.set(userData.uid, userData);
                }
            });
            setAssignableUsers(Array.from(usersMap.values()));
        } catch (e) {
            console.error("Error fetching users for digitization table", e);
        }
    };

    fetchAssignableUsers();
    
    let qCases;

    if (filters.ne?.trim()) {
        qCases = query(collection(db, 'AforoCases'), where('ne', '==', filters.ne.trim().toUpperCase()));
    } else {
        const statuses = ['Pendiente de Digitación', 'En Proceso', 'Almacenado'];
        qCases = query(
            collection(db, 'AforoCases'),
            where('digitacionStatus', 'in', statuses),
            orderBy('revisorStatus', 'desc'), 
            orderBy('createdAt', 'desc')
        );
    }

    const unsubscribe = onSnapshot(qCases, async (snapshot) => {
        const aforoCasesData: AforoCase[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        
        const worksheetsSnap = await getDocs(collection(db, 'worksheets'));
        const worksheetsMap = new Map(worksheetsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Worksheet]));

        const casesWithWorksheetInfo = aforoCasesData
            .map(caseItem => ({
                ...caseItem,
                worksheet: worksheetsMap.get(caseItem.worksheetId || '') || null,
            }))
             .filter(c => 
                c.worksheet?.worksheetType === 'hoja_de_trabajo' || 
                c.worksheet?.worksheetType === undefined
            );


        let filtered = casesWithWorksheetInfo;
        
        if (filters.ne) {
            filtered = filtered.filter(c => c.ne.toUpperCase().includes(filters.ne!.toUpperCase()));
        }

        filtered.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        
        setAllFetchedCases(filtered);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching digitization cases: ", error);
        toast({ title: "Error", description: "No se pudieron cargar los casos para digitación.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [filters, toast, setAllFetchedCases]);

  const handleAssignDigitador = (caseId: string, digitadorName: string) => {
     handleAutoSave(caseId, 'digitadorAsignado', digitadorName);
     handleAutoSave(caseId, 'digitadorAsignadoAt', Timestamp.now());
  };

  const handleStatusChange = (caseId: string, value: DigitacionStatus) => {
    if (value === 'Completar Trámite') {
        const caseToComplete = displayCases.find(c => c.id === caseId);
        if (caseToComplete) {
            setSelectedCaseForCompletion(caseToComplete);
        }
    } else {
        handleAutoSave(caseId, 'digitacionStatus', value);
    }
  }

  const openHistoryModal = (caseItem: AforoCase) => setSelectedCaseForHistory(caseItem);
  const openCommentModal = (caseItem: AforoCase) => setSelectedCaseForComment(caseItem);
    
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Cargando registros para digitación...</p>
      </div>
    );
  }

  if (displayCases.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No hay casos pendientes</h3>
        <p className="mt-1 text-muted-foreground">No hay casos de aforo aprobados esperando digitación con los filtros actuales.</p>
      </div>
    );
  }
  
  const canEdit = user?.role === 'admin' || user?.role === 'coordinadora' || user?.roleTitle === 'supervisor';
  const isDigitador = user?.role === 'digitador';
  
  if (isMobile) {
    return (
        <div className="space-y-4">
            {displayCases.map((caseItem) => (
                <MobileDigitacionCard 
                    key={caseItem.id}
                    caseItem={caseItem}
                    canEdit={canEdit}
                    isDigitador={isDigitador}
                    savingState={savingState}
                    handleStatusChange={handleStatusChange}
                    handleAutoSave={handleAutoSave}
                    openCommentModal={openCommentModal}
                    openHistoryModal={openHistoryModal}
                    setSelectedCaseForAssignment={setSelectedCaseForAssignment}
                />
            ))}
        </div>
    )
  }

  return (
    <>
     <TooltipProvider>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Acciones</TableHead>
            <TableHead>Ejecutivo</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Asignar Digitador</TableHead>
            <TableHead>Estado Digitación</TableHead>
            <TableHead>Declaración Aduanera</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayCases.map((caseItem) => {
            const isCompleted = caseItem.digitacionStatus === 'Trámite Completo';
            const currentStatus = caseItem.digitacionStatus === 'Pendiente' ? 'Pendiente de Digitación' : caseItem.digitacionStatus;

            return (
                <TableRow key={caseItem.id} className={savingState[caseItem.id] ? "bg-amber-100" : ""}>
                <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <PlusSquare className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openCommentModal(caseItem)}>
                                <Edit className="mr-2 h-4 w-4" /> Ver/Editar Observación
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openHistoryModal(caseItem)}>
                                <History className="mr-2 h-4 w-4" /> Ver Bitácora
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                      <span>{caseItem.executive}</span>
                       <LastUpdateTooltip lastUpdate={{by: caseItem.executive, at: caseItem.createdAt}} caseCreation={caseItem.createdAt} />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{caseItem.ne}</TableCell>
                <TableCell>{caseItem.consignee}</TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <span>{caseItem.digitadorAsignado || 'Sin asignar'}</span>
                        {canEdit && !isCompleted && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedCaseForAssignment(caseItem)}>
                                {caseItem.digitadorAsignado ? 'Cambiar' : 'Asignar'}
                            </Button>
                        )}
                        <LastUpdateTooltip lastUpdate={caseItem.digitadorAsignadoLastUpdate} caseCreation={caseItem.createdAt} />
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center">
                    <Select
                        value={currentStatus ?? ''}
                        onValueChange={(value: DigitacionStatus) => handleStatusChange(caseItem.id, value)}
                        disabled={(!isDigitador && !canEdit) || isCompleted}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Seleccionar estado..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pendiente de Digitación">Pendiente de Digitación</SelectItem>
                            <SelectItem value="En Proceso">En Proceso</SelectItem>
                            <SelectItem value="Almacenado">Almacenado</SelectItem>
                            <SelectItem value="Completar Trámite">Completar Trámite</SelectItem>
                        </SelectContent>
                    </Select>
                    <LastUpdateTooltip lastUpdate={caseItem.digitacionStatusLastUpdate} caseCreation={caseItem.createdAt} />
                    </div>
                </TableCell>
                <TableCell>
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
                </TableCell>
                </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    </TooltipProvider>
    {selectedCaseForHistory && (
        <AforoCaseHistoryModal
            isOpen={!!selectedCaseForHistory}
            onClose={() => setSelectedCaseForHistory(null)}
            caseData={selectedCaseForHistory}
        />
    )}
     {selectedCaseForComment && (
        <DigitizationCommentModal
            isOpen={!!selectedCaseForComment}
            onClose={() => setSelectedCaseForComment(null)}
            caseData={selectedCaseForComment}
        />
    )}
    {selectedCaseForCompletion && (
        <CompleteDigitizationModal
            isOpen={!!selectedCaseForCompletion}
            onClose={() => setSelectedCaseForCompletion(null)}
            caseData={selectedCaseForCompletion}
        />
    )}
    {selectedCaseForAssignment && (
        <AssignUserModal
            isOpen={!!selectedCaseForAssignment}
            onClose={() => setSelectedCaseForAssignment(null)}
            caseData={selectedCaseForAssignment}
            assignableUsers={assignableUsers.filter(u => u.role === 'digitador' || u.role === 'coordinadora' || u.role === 'supervisor' || u.role === 'aforador')}
            onAssign={handleAssignDigitador}
            title="Asignar Digitador"
            description={`Seleccione un usuario para asignar al caso NE: ${selectedCaseForAssignment.ne}`}
        />
    )}
    </>
  );
}
