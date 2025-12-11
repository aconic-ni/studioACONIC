
"use client";
import React, { useMemo } from 'react';
import type { SolicitudRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Search, Download, Eye, MessageSquare, Info as InfoIcon, AlertCircle, CheckCircle2, FileSignature, Trash2, ShieldCheck, ListCollapse, RotateCw, MessageSquareText, CheckSquare as CheckSquareIcon, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileSolicitudCard } from './MobileSolicitudCard';

const formatCurrencyFetched = (amount?: number | string | null, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num) && typeof amount === 'string' && amount.trim() === '') return 'N/A';
    if (isNaN(num)) return String(amount);

    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';
    return `${prefix}${num.toFixed(2)}`;
};

const renderSolicitudStatusBadges = (solicitud: SolicitudRecord) => {
  const badges = [];
  if (solicitud.isMemorandum) badges.push(<Badge key="memo" variant="destructive" className="whitespace-nowrap text-xs">Memorandum</Badge>);
  if (solicitud.documentosAdjuntos) badges.push(<Badge key="docs" variant="outline" className="bg-blue-100 text-blue-700 whitespace-nowrap text-xs">Docs Adjuntos</Badge>);
  if (solicitud.soporte) badges.push(<Badge key="soporte" variant="outline" className="bg-amber-100 text-amber-700 whitespace-nowrap text-xs">Soporte</Badge>);
  if (solicitud.impuestosPendientesCliente) badges.push(<Badge key="impuestos" variant="outline" className="bg-red-100 text-red-700 whitespace-nowrap text-xs">Imp. Pendientes</Badge>);
  if (solicitud.constanciasNoRetencion) badges.push(<Badge key="retencion" variant="outline" className="bg-purple-100 text-purple-700 whitespace-nowrap text-xs">Const. No Ret.</Badge>);
  if (solicitud.pagoServicios) badges.push(<Badge key="servicios" variant="outline" className="bg-teal-100 text-teal-700 whitespace-nowrap text-xs">Pago Serv.</Badge>);

  if (badges.length === 0) {
    return <Badge variant="secondary" className="text-xs">Sin Estados</Badge>;
  }
  return <div className="flex flex-wrap gap-1">{badges}</div>;
};

export interface SearchResultsTableProps {
  solicitudes: SolicitudRecord[];
  searchType: "dateToday" | "dateSpecific" | "dateRange" | "dateCurrentMonth";
  searchTerm?: string;
  currentUserRole?: string;
  isMinutaValidationEnabled: boolean;
  onUpdatePaymentStatus: (solicitudId: string, newPaymentStatus: string | null) => Promise<void>;
  onUpdateRecepcionDCStatus: (solicitudId: string, status: boolean) => Promise<void>;
  onUpdateEmailMinutaStatus: (solicitudId: string, status: boolean) => Promise<void>;
  onOpenMessageDialog: (solicitudId: string) => void;
  onOpenMinutaDialog: (solicitudId: string) => void;
  onSaveMinuta: (solicitudId: string, minutaNum?: string | null) => Promise<void>;
  onViewDetails: (solicitud: SolicitudRecord) => void;
  onOpenCommentsDialog: (solicitudId: string) => void;
  onDeleteSolicitud: (solicitudId: string) => void; 
  onRefreshSearch: () => void;
  onFilterByDuplicateSet: (ids: string[]) => void;
  filterRecpDocsInput: string;
  setFilterRecpDocsInput: (value: string) => void;
  filterNotMinutaInput: string;
  setFilterNotMinutaInput: (value: string) => void;
  filterSolicitudIdInput: string;
  setFilterSolicitudIdInput: (value: string) => void;
  filterNEInput: string;
  setFilterNEInput: (value: string) => void;
  filterEstadoPagoInput: string;
  setFilterEstadoPagoInput: (value: string) => void;
  filterFechaSolicitudInput: string;
  setFilterFechaSolicitudInput: (value: string) => void;
  filterMontoInput: string;
  setFilterMontoInput: (value: string) => void;
  filterConsignatarioInput: string;
  setFilterConsignatarioInput: (value: string) => void;
  filterDeclaracionInput: string;
  setFilterDeclaracionInput: (value: string) => void;
  filterReferenciaInput: string;
  setFilterReferenciaInput: (value: string) => void;
  filterGuardadoPorInput: string;
  setFilterGuardadoPorInput: (value: string) => void;
  filterEstadoSolicitudInput: string;
  setFilterEstadoSolicitudInput: (value: string) => void;
  duplicateWarning?: string | null;
  duplicateSets: Map<string, string[]>;
  onResolveDuplicate: (key: string, resolution: "validated_not_duplicate" | "deletion_requested") => void;
  resolvedDuplicateKeys: string[]; 
  permanentlyResolvedDuplicateKeys: string[]; 
  onOpenViewErrorDialog: (errorMessage: string) => void;
}

export const SearchResultsTable: React.FC<SearchResultsTableProps> = ({
  solicitudes,
  searchType,
  searchTerm,
  currentUserRole,
  isMinutaValidationEnabled,
  onUpdatePaymentStatus,
  onUpdateRecepcionDCStatus,
  onUpdateEmailMinutaStatus,
  onOpenMessageDialog,
  onOpenMinutaDialog,
  onSaveMinuta,
  onViewDetails,
  onOpenCommentsDialog,
  onDeleteSolicitud, 
  onRefreshSearch,
  onFilterByDuplicateSet,
  filterRecpDocsInput,
  setFilterRecpDocsInput,
  filterNotMinutaInput,
  setFilterNotMinutaInput,
  filterSolicitudIdInput,
  setFilterSolicitudIdInput,
  filterNEInput,
  setFilterNEInput,
  filterEstadoPagoInput,
  setFilterEstadoPagoInput,
  filterFechaSolicitudInput,
  setFilterFechaSolicitudInput,
  filterMontoInput,
  setFilterMontoInput,
  filterConsignatarioInput,
  setFilterConsignatarioInput,
  filterDeclaracionInput,
  setFilterDeclaracionInput,
  filterReferenciaInput,
  setFilterReferenciaInput,
  filterGuardadoPorInput,
  setFilterGuardadoPorInput,
  filterEstadoSolicitudInput,
  setFilterEstadoSolicitudInput,
  duplicateSets,
  onResolveDuplicate,
  resolvedDuplicateKeys,
  permanentlyResolvedDuplicateKeys,
  onOpenViewErrorDialog,
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const allDuplicateIdsFromSets = useMemo(() => {
    const ids = new Set<string>();
    duplicateSets.forEach(idArray => idArray.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [duplicateSets]);

  const combinedResolvedKeys = useMemo(() => {
    return new Set([...resolvedDuplicateKeys, ...permanentlyResolvedDuplicateKeys]);
  }, [resolvedDuplicateKeys, permanentlyResolvedDuplicateKeys]);

  if (!solicitudes || solicitudes.length === 0) {
    let message = "No se encontraron solicitudes para los criterios ingresados.";
    if (searchType === "dateToday") message = "No se encontraron solicitudes para hoy."
    else if (searchType === "dateCurrentMonth") message = "No se encontraron solicitudes para el mes actual."
    return <p className="text-muted-foreground text-center py-4">{message}</p>;
  }

  const getTitle = () => {
    if (searchType === "dateToday") return `Solicitudes de Hoy (${format(new Date(), "PPP", { locale: es })})`;
    if (searchType === "dateCurrentMonth") return `Solicitudes del Mes Actual (${format(new Date(), "MMMM yyyy", { locale: es })})`;
    if (searchType === "dateSpecific" && searchTerm) return `Solicitudes del ${searchTerm}`;
    if (searchType === "dateRange" && searchTerm) return `Solicitudes para ${searchTerm}`;
    return "Solicitudes Encontradas";
  };

  const isGuardadoPorFilterDisabled = currentUserRole === 'autorevisor' || currentUserRole === 'autorevisor_plus';
  const canUserValidateDuplicates = currentUserRole === 'calificador' || currentUserRole === 'admin' || currentUserRole === 'supervisor';
  const canModifyPaymentStatus = currentUserRole === 'calificador' || currentUserRole === 'admin' || currentUserRole === 'supervisor' || currentUserRole === 'revisor';
  
  const cardActions = {
      onViewDetails,
      onOpenCommentsDialog,
      onDeleteSolicitud,
      onOpenViewErrorDialog,
  };
  
  if (isMobile) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{getTitle()} <Badge variant="secondary">{solicitudes.length}</Badge></h3>
        {solicitudes.map(solicitud => (
          <MobileSolicitudCard 
            key={solicitud.solicitudId}
            solicitud={solicitud}
            cardActions={cardActions}
            currentUserRole={currentUserRole}
          />
        ))}
      </div>
    );
  }

  return (
    <Card className="mt-6 w-full custom-shadow">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">{getTitle()}</CardTitle>
        <CardDescription className="text-muted-foreground">Se encontraron {solicitudes.length} solicitud(es) asociadas.</CardDescription>
        {duplicateSets.size > 0 && (
          <div className="mt-4 space-y-3">
            {Array.from(duplicateSets.entries()).map(([key, ids]) => {
              if (combinedResolvedKeys.has(key)) { 
                return null;
              }
              const neFromKey = key.split('-')[0];
              return (
                <div key={key} className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md" role="alert">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                    <p className="font-semibold">Alerta de Duplicado Potencial (NE: {neFromKey})</p>
                  </div>
                  <p>Se encontraron múltiples solicitudes con el mismo NE, Monto y Moneda. IDs: {ids.join(', ')}.</p>
                  <p className="mt-1">Por favor, revise y valide esta situación.</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary/10 hover:text-primary-darker"
                      onClick={() => onFilterByDuplicateSet(ids)}
                    >
                      <Search className="mr-2 h-4 w-4" /> Ver solo este conjunto
                    </Button>
                    {canUserValidateDuplicates && (
                        <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-green-600 text-green-700 hover:bg-green-100 hover:text-green-800"
                            onClick={() => onResolveDuplicate(key, 'validated_not_duplicate')}
                        >
                            <ShieldCheck className="mr-2 h-4 w-4" /> Validado (No Duplicado)
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-orange-600 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                            onClick={() => onResolveDuplicate(key, 'deletion_requested')}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Solicitar Eliminación
                        </Button>
                        </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto table-container rounded-lg border">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={onRefreshSearch} className="h-6 w-6 p-0 mr-1">
                        <RotateCw className="h-4 w-4 text-primary" />
                    </Button>
                    Acciones
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Estado de Pago
                  <Input
                    type="text"
                    placeholder="Filtrar Estado Pago..."
                    value={filterEstadoPagoInput}
                    onChange={(e) => setFilterEstadoPagoInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  RECP. DOCS
                  <Input
                    type="text"
                    placeholder="Filtrar (Recibido/Pendiente)..."
                    value={filterRecpDocsInput}
                    onChange={(e) => setFilterRecpDocsInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Estado Solicitud
                  <Input
                    type="text"
                    placeholder="Filtrar Estado Sol..."
                    value={filterEstadoSolicitudInput}
                    onChange={(e) => setFilterEstadoSolicitudInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Consignatario
                  <Input
                    type="text"
                    placeholder="Filtrar Consignatario..."
                    value={filterConsignatarioInput}
                    onChange={(e) => setFilterConsignatarioInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Declaracion
                  <Input
                    type="text"
                    placeholder="Filtrar Declaracion..."
                    value={filterDeclaracionInput}
                    onChange={(e) => setFilterDeclaracionInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Fecha
                  <Input
                    type="text"
                    placeholder="Filtrar Fecha (dd/MM/yy)..."
                    value={filterFechaSolicitudInput}
                    onChange={(e) => setFilterFechaSolicitudInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  NE
                  <Input
                    type="text"
                    placeholder="Filtrar NE..."
                    value={filterNEInput}
                    onChange={(e) => setFilterNEInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Monto
                  <Input
                    type="text"
                    placeholder="Filtrar Monto..."
                    value={filterMontoInput}
                    onChange={(e) => setFilterMontoInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Referencia
                  <Input
                    type="text"
                    placeholder="Filtrar Referencia..."
                    value={filterReferenciaInput}
                    onChange={(e) => setFilterReferenciaInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Guardado Por
                  <Input
                    type="text"
                    placeholder={isGuardadoPorFilterDisabled ? "Filtrado por rol" : "Filtrar Guardado Por..."}
                    value={filterGuardadoPorInput}
                    onChange={(e) => setFilterGuardadoPorInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    disabled={isGuardadoPorFilterDisabled}
                    readOnly={isGuardadoPorFilterDisabled}
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  ID Solicitud
                  <Input
                    type="text"
                    placeholder="Filtrar ID..."
                    value={filterSolicitudIdInput}
                    onChange={(e) => setFilterSolicitudIdInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-y divide-border">
              {solicitudes.map((solicitud) => {
                const isMarkedAsDuplicate = allDuplicateIdsFromSets.includes(solicitud.solicitudId);
                const duplicateKeyForThisRow = `${solicitud.examNe?.trim()}-${solicitud.monto}-${solicitud.montoMoneda?.trim()}`;
                const isResolvedInSession = resolvedDuplicateKeys.includes(duplicateKeyForThisRow);
                const isPermanentlyResolved = permanentlyResolvedDuplicateKeys.includes(duplicateKeyForThisRow);
                const isEffectivelyResolved = isResolvedInSession || isPermanentlyResolved;
                const isUrgent = solicitud.hasOpenUrgentComment;

                let rowClass = 'hover:bg-muted/50 dark:hover:bg-muted/80';
                if (isUrgent) {
                  rowClass = 'bg-red-200 hover:bg-red-300 dark:bg-red-600/40 dark:hover:bg-red-600/50';
                } else if (isMarkedAsDuplicate && !isEffectivelyResolved) {
                  rowClass = 'bg-rose-200 hover:bg-rose-300 dark:bg-rose-500/50 dark:hover:bg-rose-500/60';
                } else if (isMarkedAsDuplicate && isEffectivelyResolved) {
                  rowClass = 'bg-emerald-200 hover:bg-emerald-300 dark:bg-emerald-500/50 dark:hover:bg-emerald-500/60';
                } else if (solicitud.soporte) { 
                  rowClass = 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-700/30 dark:hover:bg-amber-700/40'; 
                }

                return (
                <TableRow
                  key={solicitud.solicitudId}
                  className={cn(rowClass)}
                >
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-1">
                        {currentUserRole === 'admin' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onDeleteSolicitud(solicitud.solicitudId)}
                                  className="px-2 py-1 h-auto text-destructive hover:bg-destructive/10"
                                  aria-label="Eliminar Solicitud"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar Solicitud</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewDetails(solicitud)}
                                className="px-2 py-1 h-auto"
                                aria-label="Ver Detalles"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ver Detalles</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenCommentsDialog(solicitud.solicitudId)}
                                className="px-2 py-1 h-auto"
                                aria-label="Comentarios"
                              >
                                <MessageSquareText className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Comentarios</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge variant="secondary" className="h-6 min-w-[1.5rem] flex items-center justify-center px-1.5 py-0.5 text-xs">
                          {solicitud.commentsCount ?? 0}
                        </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={solicitud.paymentStatus === 'Pagado'}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (isMinutaValidationEnabled) {
                                onOpenMinutaDialog(solicitud.solicitudId);
                              } else {
                                onSaveMinuta(solicitud.solicitudId, null); 
                              }
                            } else {
                              if (solicitud.paymentStatus === 'Pagado') {
                                onUpdatePaymentStatus(solicitud.solicitudId, null);
                              }
                            }
                          }}
                          disabled={!canModifyPaymentStatus || solicitud.isMemorandum}
                          aria-label="Marcar como pagado / pendiente"
                        />
                        <Button variant="ghost" size="icon" onClick={() => onOpenMessageDialog(solicitud.solicitudId)} aria-label="Añadir mensaje de error" className="h-7 w-7 p-0" disabled={solicitud.isMemorandum}>
                          <MessageSquare className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        {solicitud.paymentStatus === 'Pagado' && (
                          <div className="flex items-center space-x-1">
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Pagado</Badge>
                            {solicitud.minutaNumber && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                      <FileSignature className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    <p>Minuta No: {solicitud.minutaNumber}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}
                        {solicitud.paymentStatus && solicitud.paymentStatus.startsWith('Error:') ? (
                            <Button variant="link" className="p-0 h-auto" onClick={() => onOpenViewErrorDialog(solicitud.paymentStatus!.substring("Error: ".length))}>
                            <Badge variant="destructive" className="cursor-pointer flex items-center">
                                <AlertCircle className="h-3.5 w-3.5 mr-1"/> Error
                            </Badge>
                         </Button>
                        ) : null}
                        {(!solicitud.paymentStatus || (solicitud.paymentStatus && !solicitud.paymentStatus.startsWith('Error:') && solicitud.paymentStatus !== 'Pagado')) && (
                             <Badge variant="outline">Pendiente</Badge>
                        )}
                        {(solicitud.paymentStatusLastUpdatedAt || solicitud.paymentStatusLastUpdatedBy) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Última actualización (Pago):</p>
                                {solicitud.paymentStatusLastUpdatedBy && <p>Por: {solicitud.paymentStatusLastUpdatedBy}</p>}
                                {solicitud.paymentStatusLastUpdatedAt && solicitud.paymentStatusLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.paymentStatusLastUpdatedAt, "Pp", { locale: es })}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                     {currentUserRole === 'calificador' ? (
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={!!solicitud.recepcionDCStatus}
                                onCheckedChange={(checked) => {
                                    onUpdateRecepcionDCStatus(solicitud.solicitudId, !!checked);
                                }}
                                aria-label="Marcar como recibido / pendiente de documento"
                            />
                            {solicitud.recepcionDCStatus ? (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center">
                                    <CheckSquareIcon className="h-3.5 w-3.5 mr-1"/> Recibido
                                </Badge>
                            ) : (
                                <Badge variant="outline">Pendiente</Badge>
                            )}
                            {(solicitud.recepcionDCLastUpdatedAt || solicitud.recepcionDCLastUpdatedBy) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                      <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    <p>Última actualización (Recep. Doc.):</p>
                                    {solicitud.recepcionDCLastUpdatedBy && <p>Por: {solicitud.recepcionDCLastUpdatedBy}</p>}
                                    {solicitud.recepcionDCLastUpdatedAt && solicitud.recepcionDCLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.recepcionDCLastUpdatedAt, "Pp", { locale: es })}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                        </div>
                     ) : (
                        <div className="flex items-center space-x-1">
                        {solicitud.recepcionDCStatus ? (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center">
                                <CheckSquareIcon className="h-3.5 w-3.5 mr-1"/> Recibido
                            </Badge>
                        ) : (
                            <Badge variant="outline">Pendiente</Badge>
                        )}
                        {(solicitud.recepcionDCLastUpdatedAt || solicitud.recepcionDCLastUpdatedBy) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Última actualización (Recep. Doc.):</p>
                                {solicitud.recepcionDCLastUpdatedBy && <p>Por: {solicitud.recepcionDCLastUpdatedBy}</p>}
                                {solicitud.recepcionDCLastUpdatedAt && solicitud.recepcionDCLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.recepcionDCLastUpdatedAt, "Pp", { locale: es })}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        </div>
                     )}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                    {renderSolicitudStatusBadges(solicitud)}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {solicitud.consignatario && solicitud.consignatario.length > 21 ? (
                        <div className="flex items-center space-x-1">
                        <span>{`${solicitud.consignatario.substring(0, 21)}...`}</span>
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                <InfoIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs break-words">
                                <p>{solicitud.consignatario}</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        </div>
                    ) : (
                        solicitud.consignatario || 'N/A'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{solicitud.declaracionNumero || 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {solicitud.examDate instanceof Date
                      ? format(solicitud.examDate, "dd/MM/yy", { locale: es })
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{solicitud.examNe}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{formatCurrencyFetched(solicitud.monto ?? undefined, solicitud.montoMoneda || undefined)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{solicitud.examReference || 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                     <div className="flex items-center space-x-1">
                        <span>{solicitud.savedBy || 'N/A'}</span>
                        {solicitud.savedAt && solicitud.savedAt instanceof Date && (
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                                <p>Guardado el:</p>
                                <p>{format(solicitud.savedAt, "Pp", { locale: es })}</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{solicitud.solicitudId}</TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
