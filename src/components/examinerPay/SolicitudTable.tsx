
"use client";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import type { SolicitudData } from '@/types';
import { Eye, Edit3, Trash2, MoreHorizontal, FileText, AlertTriangle, Info, CalendarDays } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function SolicitudTable() {
  const { initialContextData, solicitudes, openAddProductModal, deleteSolicitud, setSolicitudToViewInline } = useAppContext();

  const formatCurrency = (amount?: number | string, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return 'Inválido';

    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';

    return `${prefix}${num.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderStatusBadges = (solicitud: SolicitudData) => {
    const badges = [];
    if (solicitud.documentosAdjuntos) badges.push(<Badge key="docs" variant="outline" className="bg-blue-100 text-blue-800 whitespace-nowrap flex items-center"><FileText className="h-3 w-3 mr-1" /> Docs</Badge>);
    if (solicitud.soporte) badges.push(<Badge key="soporte" variant="outline" className="bg-orange-100 text-orange-800 whitespace-nowrap flex items-center"><AlertTriangle className="h-3 w-3 mr-1"/> Soporte</Badge>);
    if (solicitud.impuestosPendientesCliente) badges.push(<Badge key="impuestos" variant="outline" className="bg-orange-100 text-orange-800 whitespace-nowrap flex items-center"><AlertTriangle className="h-3 w-3 mr-1"/> Imp. Pend.</Badge>);
    if (solicitud.constanciasNoRetencion) badges.push(<Badge key="retencion" variant="outline" className="bg-purple-100 text-purple-800 whitespace-nowrap flex items-center"><FileText className="h-3 w-3 mr-1" /> No Ret.</Badge>);

    if (badges.length === 0) {
      return <Badge variant="outline">Sin Estados</Badge>;
    }
    return <div className="flex flex-wrap gap-1">{badges}</div>;
  };


  if (solicitudes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay solicitudes añadidas. Haga clic en &quot;Añadir Nueva Solicitud&quot; para comenzar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader className="bg-secondary/50">
          <TableRow>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[150px]">
              <Info className="inline-block h-3.5 w-3.5 mr-1 align-middle" />
              Estado
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              ID Solicitud
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              <CalendarDays className="inline-block h-3.5 w-3.5 mr-1 align-middle" />
              Fecha de Solicitud
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">NE</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Consignatario</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Declaracion</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card divide-y divide-border">
          {solicitudes.map((solicitud) => (
            <TableRow key={solicitud.id} className="hover:bg-muted/50">
              <TableCell className="px-4 py-3 text-sm text-muted-foreground">{renderStatusBadges(solicitud)}</TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{solicitud.id}</TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                {initialContextData?.date ? format(new Date(initialContextData.date), "PPP", { locale: es }) : 'N/A'}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{initialContextData?.ne || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{formatCurrency(solicitud.monto, solicitud.montoMoneda)}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">{solicitud.consignatario || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">{solicitud.declaracionNumero || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Abrir menú</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSolicitudToViewInline(solicitud)}>
                      <Eye className="mr-2 h-4 w-4" /> Ver Detalle
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAddProductModal(solicitud)}>
                      <Edit3 className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (confirm('¿Está seguro de que desea eliminar esta solicitud?')) {
                        deleteSolicitud(solicitud.id);
                      }
                    }} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
