
"use client";
import React from 'react';
import type { AforoData, FacturacionStatus, no existeStatus, DigitacionStatus, PreliquidationStatus, WorksheetWithCase } from '@/types';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Timestamp } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FilePlus, BookOpen, Banknote, Bell as BellIcon, AlertTriangle, ShieldAlert,
  History, Eye, MessageSquare, PlusSquare, Search, CheckCircle, Info, Send, Copy, Archive
} from 'lucide-react';
import { StatusBadges } from './StatusBadges';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Switch } from '@/components/ui/switch';
import { LastUpdateTooltip } from './LastUpdateTooltip';
import { cn } from '@/lib/utils';
import { DatePickerWithTime } from '@/components/reports/DatePickerWithTime';
import { ExecutiveTableHeader } from './ExecutiveTableHeader';

interface ExecutiveCasesTableProps {
  cases: WorksheetWithCase[];
  savingState: { [key: string]: boolean };
  onAutoSave: (caseId: string, field: keyof AforoData, value: any, isTriggerFromFieldUpdate?: boolean) => void;
  approvePreliquidation: (caseId: string) => void;
  caseActions: any;
  selectedRows: string[];
  onSelectRow: React.Dispatch<React.SetStateAction<string[]>>;
  onSelectAllRows: () => void;
  columnFilters: { ne: string; ejecutivo: string; consignatario: string; factura: string; selectividad: string; incidentType: string; };
  setColumnFilters: React.Dispatch<React.SetStateAction<{ ne: string; ejecutivo: string; consignatario: string; factura: string; selectividad: string; incidentType: string; }>>;
  handleSendToFacturacion: (caseId: string) => void;
  onSearch: () => void;
  getIncidentTypeDisplay: (c: AforoData) => string;
}

const getOverallStatus = (caseData: AforoData): { text: string; variant: "default" | "destructive" | "secondary" | "outline" } => {
    if (caseData.digitacionStatus === 'Trámite Completo') return { text: 'Trámite Completo', variant: 'default' };
    if (caseData.digitacionStatus === 'Almacenado') return { text: 'Almacenado', variant: 'default' };
    if (caseData.digitacionStatus === 'En Proceso') return { text: 'En Digitación', variant: 'secondary' };
    if (caseData.preliquidationStatus === 'Aprobada') return { text: 'Preliquidación Aprobada', variant: 'default' };
    if (caseData.revisorStatus === 'Aprobado') return { text: 'Aprobado por Agente', variant: 'default' };
    if (caseData.revisorStatus === 'Rechazado') return { text: 'Rechazado por Agente', variant: 'destructive' };
    if (caseData.aforadorStatus === 'En revisión') return { text: 'En Revisión (Aforo)', variant: 'secondary' };
    if (caseData.aforadorStatus === 'En proceso') return { text: 'En Proceso (Aforo)', variant: 'secondary' };
    if (caseData.aforadorStatus === 'Incompleto') return { text: 'Incompleto (Aforo)', variant: 'destructive' };
    return { text: 'Pendiente de Aforo', variant: 'outline' };
};


export function ExecutiveCasesTable({
  cases,
  savingState,
  onAutoSave,
  approvePreliquidation,
  caseActions,
  selectedRows,
  onSelectRow,
  onSelectAllRows,
  columnFilters,
  setColumnFilters,
  handleSendToFacturacion,
  onSearch,
  getIncidentTypeDisplay
}: ExecutiveCasesTableProps) {
  const { user } = useAuth();
  
  return (
    <div className="overflow-x-auto table-container rounded-lg border">
            <TooltipProvider>
            <Table>
              <ExecutiveTableHeader
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    onSearch={onSearch}
                    onSelectAllRows={onSelectAllRows}
                    areAllSelected={selectedRows.length > 0 && selectedRows.length === cases.length}
              />
            <TableBody>
                {cases.map(c => {
                    const aforoData = (c as any).aforo || c;
                    const facturas = c.worksheet?.worksheetType === 'corporate_report' 
                        ? (c.worksheet.documents?.filter(d => d.type === 'FACTURA').map(d => d.number) || [])
                        : (c.facturaNumber ? c.facturaNumber.split(';').map(f => f.trim()) : []);

                    const firstFactura = facturas[0] || '';
                    const remainingFacturasCount = facturas.length > 1 ? facturas.length - 1 : 0;
                    const isPsmt = c.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA";
                    const daysUntilDue = aforoData.resaDueDate ? differenceInDays(aforoData.resaDueDate.toDate(), new Date()) : null;
                    const isResaCritical = daysUntilDue !== null && daysUntilDue < -15;
                    const overallStatus = getOverallStatus(aforoData);

                    return (
                    <TableRow key={c.id} className={savingState[c.id] ? "bg-amber-100" : (isResaCritical ? "bg-red-200 hover:bg-red-200/80" : "")} data-state={selectedRows.includes(c.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.includes(c.id)}
                            onCheckedChange={() => onSelectRow(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                            aria-label={`Seleccionar caso ${c.ne}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">Ver</Button></DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => caseActions.handleViewWorksheet(c)} disabled={!c.worksheetId}>
                                    <BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo
                                </DropdownMenuItem>
                                 <DropdownMenuItem onSelect={() => caseActions.handleSearchPrevio(c.ne)}>
                                    <Search className="mr-2 h-4 w-4" /> Buscar Previo
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/managerpermisos?id=${c.id}`}><FilePlus className="mr-2 h-4 w-4" /> Docs y Permisos</Link></DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForQuickRequest(c)} disabled={!c.worksheet}>
                                    <FilePlus className="mr-2 h-4 w-4" /> Solicitar Previo
                                </DropdownMenuItem>
                                 <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForPayment(c)} disabled={!c}>
                                    <Banknote className="mr-2 h-4 w-4" /> Solicitud de Pago
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForPaymentList(c)} disabled={!c}>
                                    <Banknote className="mr-2 h-4 w-4 text-blue-500" /> Ver Pagos
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForResa(c)} disabled={!c}>
                                    <BellIcon className="mr-2 h-4 w-4 text-orange-500" /> Notificar RESA
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForIncident(c)} disabled={!c}>
                                    <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForValueDoubt(c)} disabled={!c}>
                                    <ShieldAlert className="mr-2 h-4 w-4 text-rose-600" /> Reportar Duda de Valor
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForHistory(c)} disabled={!c}><History className="mr-2 h-4 w-4" /> Ver Bitácora</DropdownMenuItem>
                                {c.incidentReported && (<DropdownMenuItem onSelect={() => caseActions.handleViewIncidents(c)}><Eye className="mr-2 h-4 w-4" /> Ver Incidencia</DropdownMenuItem>)}
                                {user?.role === 'admin' && <DropdownMenuItem onClick={() => caseActions.setCaseToArchive(c)} className="text-destructive"><Archive className="mr-2 h-4 w-4" /> Archivar</DropdownMenuItem>}
                                {(user?.role === 'admin' || user?.role === 'coordinadora') && c.worksheet?.worksheetType === 'hoja_de_trabajo' && (
                                  <DropdownMenuItem onClick={() => { caseActions.setCaseToDuplicate(c); caseActions.setDuplicateAndRetireModalOpen(true); }} className="text-destructive"><Copy className="mr-2 h-4 w-4" /> Duplicar y Retirar</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => caseActions.setSelectedCaseForComment(c)}>
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Añadir/Ver Comentarios</p></TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{c.ne}</TableCell>
                        <TableCell>
                            <StatusBadges caseData={c} />
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1">
                                <span>{c.executive}</span>
                                <LastUpdateTooltip lastUpdate={{ by: c.executive, at: c.createdAt }} caseCreation={c.createdAt} />
                            </div>
                        </TableCell>
                        <TableCell>
                            {c.consignee.length > 13 ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1 cursor-help">
                                            {`${c.consignee.substring(0, 13)}...`}
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{c.consignee}</p></TooltipContent>
                                </Tooltip>
                            ) : ( c.consignee )}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <span>{firstFactura}</span>
                                {remainingFacturasCount > 0 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="secondary" className="cursor-pointer">
                                                +{remainingFacturasCount}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <ul className="list-disc list-inside">
                                                {facturas.slice(1).map((f, i) => <li key={i}>{f}</li>)}
                                            </ul>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-1">
                            <Badge variant={overallStatus.variant}>{overallStatus.text}</Badge>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => caseActions.setSelectedCaseForProcess(c)}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Ver Línea de Proceso</p></TooltipContent>
                            </Tooltip>
                           </div>
                        </TableCell>
                         <TableCell>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={c.selectividad || ''}
                                    onValueChange={(value) => onAutoSave(c.id, 'selectividad', value)}
                                    disabled={savingState[c.id] || !aforoData.declaracionAduanera}
                                >
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VERDE">VERDE</SelectItem>
                                        <SelectItem value="AMARILLO">AMARILLO</SelectItem>
                                        <SelectItem value="ROJO">ROJO</SelectItem>
                                    </SelectContent>
                                </Select>
                                {c.selectividad === 'AMARILLO' && (
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Badge variant="secondary" className="cursor-help"><Info className="h-4 w-4" /></Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>CONSULTA DE VALORES</p></TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild><div><DatePickerWithTime date={(c.fechaDespacho as Timestamp)?.toDate()} onDateChange={(d) => onAutoSave(c.id, 'fechaDespacho', d ? Timestamp.fromDate(d) : null)} disabled={savingState[c.id] || (c.selectividad !== 'VERDE' && c.selectividad !== 'ROJO')} /></div></TooltipTrigger>
                                    {(c.selectividad !== 'VERDE' && c.selectividad !== 'ROJO') && (<TooltipContent><p>Debe seleccionar un estado de selectividad (Verde o Rojo) antes de registrar el despacho.</p></TooltipContent>)}
                                </Tooltip>
                            </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                           <span>{getIncidentTypeDisplay(c)}</span>
                            <LastUpdateTooltip lastUpdate={c.incidentStatusLastUpdate} caseCreation={c.createdAt}/>
                          </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center justify-center">
                                {isPsmt ? (<Button size="sm" variant="outline" onClick={() => handleSendToFacturacion(c.id)} disabled={savingState[c.id] || !c.fechaDespacho || c.facturacionStatus === 'Facturado'}><Send className="mr-2 h-4 w-4" />{c.facturacionStatus === 'Enviado a Facturacion' ? 'Re-enviar' : 'Enviar'}</Button>)
                                : (<Switch checked={!!c.facturado} onCheckedChange={(checked) => onAutoSave(c.id, 'facturado', checked)} disabled={savingState[c.id]} />)}
                            </div>
                        </TableCell>
                    </TableRow>
                )})}
            </TableBody></Table>
            </TooltipProvider>
    </div>
  );
}
