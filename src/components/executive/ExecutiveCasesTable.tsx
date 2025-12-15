
"use client";
import React from 'react';
import type { AforoCase, AforadorStatus, DigitacionStatus, PreliquidationStatus, WorksheetWithCase, FacturacionStatus } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Timestamp } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { DatePickerWithTime } from '@/components/reports/DatePickerWithTime';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FilePlus, BookOpen, Banknote, Bell as BellIcon, AlertTriangle, ShieldAlert,
  History, Eye, MessageSquare, PlusSquare, Search, CheckCircle, Info, Send, Copy, Archive
} from 'lucide-react';
import { StatusBadges } from './StatusBadges';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface ExecutiveCasesTableProps {
  cases: WorksheetWithCase[];
  savingState: { [key: string]: boolean };
  onAutoSave: (caseId: string, field: keyof AforoCase, value: any) => void;
  approvePreliquidation: (caseId: string) => void;
  caseActions: any;
  selectedRows: string[];
  onSelectRow: React.Dispatch<React.SetStateAction<string[]>>;
  onSelectAllRows: () => void;
  neFilter: string; setNeFilter: (value: string) => void;
  ejecutivoFilter: string; setEjecutivoFilter: (value: string) => void;
  consignatarioFilter: string; setConsignatarioFilter: (value: string) => void;
  facturaFilter: string; setFacturaFilter: (value: string) => void;
  selectividadFilter: string; setSelectividadFilter: (value: string) => void;
  incidentTypeFilter: string; setIncidentTypeFilter: (value: string) => void;
  handleSendToFacturacion: (caseId: string) => void;
}

const formatDate = (date: Date | Timestamp | null | undefined, includeTime: boolean = true): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    const formatString = includeTime ? "dd/MM/yy HH:mm" : "dd/MM/yy";
    return format(d, formatString, { locale: es });
};

const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Trámite Completo') { return <Badge variant="default" className="bg-green-600">{declaracion || 'Finalizado'}</Badge> }
    if (status) { return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>; }
    return <Badge variant="outline">Pendiente</Badge>;
};

const getPreliquidationStatusBadge = (status?: PreliquidationStatus) => {
    switch(status) {
      case 'Aprobada': return <Badge variant="default" className="bg-green-600">Aprobada</Badge>;
      default: return <Badge variant="outline">Pendiente</Badge>;
    }
};

const getIncidentTypeDisplay = (c: AforoCase) => {
    const types = [];
    if (c.incidentType === 'Rectificacion') types.push('Rectificación');
    if (c.hasValueDoubt) types.push('Duda de Valor');
    return types.length > 0 ? types.join(' / ') : 'N/A';
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
  neFilter, setNeFilter,
  ejecutivoFilter, setEjecutivoFilter,
  consignatarioFilter, setConsignatarioFilter,
  facturaFilter, setFacturaFilter,
  selectividadFilter, setSelectividadFilter,
  incidentTypeFilter, setIncidentTypeFilter,
  handleSendToFacturacion
}: ExecutiveCasesTableProps) {
  const { user } = useAuth();
  
  return (
    <div className="overflow-x-auto table-container rounded-lg border">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRows.length > 0 && selectedRows.length === cases.filter(c => c.revisorStatus === 'Aprobado' && c.preliquidationStatus !== 'Aprobada').length}
                  onCheckedChange={onSelectAllRows}
                  aria-label="Seleccionar todo para preliquidación"
                />
              </TableHead>
              <TableHead>Acciones</TableHead>
              <TableHead><Input placeholder="NE..." className="h-8 text-xs" value={neFilter} onChange={e => setNeFilter(e.target.value)}/></TableHead>
              <TableHead>Insignias</TableHead>
              <TableHead><Input placeholder="Ejecutivo..." className="h-8 text-xs" value={ejecutivoFilter} onChange={e => setEjecutivoFilter(e.target.value)}/></TableHead>
              <TableHead><Input placeholder="Consignatario..." className="h-8 text-xs" value={consignatarioFilter} onChange={e => setConsignatarioFilter(e.target.value)}/></TableHead>
              <TableHead><Input placeholder="Factura..." className="h-8 text-xs" value={facturaFilter} onChange={e => setFacturaFilter(e.target.value)}/></TableHead>
              <TableHead>Preliquidación</TableHead>
              <TableHead>Estado General</TableHead>
              <TableHead><Input placeholder="Selectividad..." className="h-8 text-xs" value={selectividadFilter} onChange={e => setSelectividadFilter(e.target.value)}/></TableHead>
              <TableHead>Fecha Despacho</TableHead>
              <TableHead><Input placeholder="Incidencia..." className="h-8 text-xs" value={incidentTypeFilter} onChange={e => setIncidentTypeFilter(e.target.value)}/></TableHead>
              <TableHead>Facturado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map(c => {
              const facturas = c.worksheet?.worksheetType === 'corporate_report' 
                ? (c.worksheet.documents?.filter(d => d.type === 'FACTURA').map(d => d.number) || [])
                : (c.facturaNumber ? c.facturaNumber.split(';').map(f => f.trim()) : []);
              const firstFactura = facturas[0] || '';
              const remainingFacturasCount = facturas.length > 1 ? facturas.length - 1 : 0;
              const isPsmt = c.consignee.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA";
              const daysUntilDue = c.resaDueDate ? differenceInDays(c.resaDueDate.toDate(), new Date()) : null;
              const isResaCritical = daysUntilDue !== null && daysUntilDue < -15;

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
                          <DropdownMenuItem onSelect={() => caseActions.handleViewWorksheet(c)} disabled={!c.worksheetId}><BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => caseActions.handleSearchPrevio(c.ne)}><Search className="mr-2 h-4 w-4" /> Buscar Previo</DropdownMenuItem>
                          <DropdownMenuItem asChild><Link href={`/managerpermisos?id=${c.id}`}><FilePlus className="mr-2 h-4 w-4" /> Docs y Permisos</Link></DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForQuickRequest(c)} disabled={!c.worksheet}><FilePlus className="mr-2 h-4 w-4" /> Solicitar Previo</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForPayment(c)} disabled={!c}><Banknote className="mr-2 h-4 w-4" /> Solicitud de Pago</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForPaymentList(c)} disabled={!c}><Banknote className="mr-2 h-4 w-4 text-blue-500" /> Ver Pagos</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForResa(c)} disabled={!c}><BellIcon className="mr-2 h-4 w-4 text-orange-500" /> Notificar RESA</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForIncident(c)} disabled={!c}><AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => caseActions.setSelectedCaseForValueDoubt(c)} disabled={!c}><ShieldAlert className="mr-2 h-4 w-4 text-rose-600" /> Reportar Duda de Valor</DropdownMenuItem>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => caseActions.setSelectedCaseForComment(c)}><MessageSquare className="h-4 w-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Añadir/Ver Comentarios</p></TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{c.ne}</TableCell>
                  <TableCell><StatusBadges caseData={c} /></TableCell>
                  <TableCell>{c.executive}</TableCell>
                  <TableCell>{c.consignee}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{firstFactura}</span>
                      {remainingFacturasCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-pointer">+{remainingFacturasCount}</Badge>
                          </TooltipTrigger>
                          <TooltipContent><ul className="list-disc list-inside">{facturas.slice(1).map((f, i) => <li key={i}>{f}</li>)}</ul></TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {c.revisorStatus === 'Aprobado' && c.preliquidationStatus !== 'Aprobada' ? (
                        <Button size="sm" onClick={() => approvePreliquidation(c.id)} disabled={savingState[c.id]}><CheckCircle className="mr-2 h-4 w-4" /> Aprobar</Button>
                      ) : (getPreliquidationStatusBadge(c.preliquidationStatus))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center group relative">
                      {getDigitacionBadge(c.digitacionStatus, c.declaracionAduanera)}
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => caseActions.setSelectedCaseForProcess(c)}><Eye className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select value={c.selectividad || ''} onValueChange={(value) => onAutoSave(c.id, 'selectividad', value)} disabled={savingState[c.id] || !c.declaracionAduanera}>
                        <SelectTrigger className="w-[120px]"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VERDE">VERDE</SelectItem>
                          <SelectItem value="AMARILLO">AMARILLO</SelectItem>
                          <SelectItem value="ROJO">ROJO</SelectItem>
                        </SelectContent>
                      </Select>
                      {c.selectividad === 'AMARILLO' && (
                        <Tooltip>
                          <TooltipTrigger asChild><Badge variant="secondary" className="cursor-help"><Info className="h-4 w-4" /></Badge></TooltipTrigger>
                          <TooltipContent><p>CONSULTA DE VALORES</p></TooltipContent>
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
                  <TableCell>{getIncidentTypeDisplay(c)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {isPsmt ? (<Button size="sm" variant="outline" onClick={() => handleSendToFacturacion(c.id)} disabled={savingState[c.id] || !c.fechaDespacho || c.facturacionStatus === 'Facturado'}><Send className="mr-2 h-4 w-4" />{c.facturacionStatus === 'Enviado a Facturacion' ? 'Re-enviar' : 'Enviar'}</Button>)
                        : (<Switch checked={!!c.facturado} onCheckedChange={(checked) => onAutoSave(c.id, 'facturado', checked)} disabled={savingState[c.id]} />)}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TooltipProvider>
    </div>
  );
}
