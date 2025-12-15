
import type { PermitRow } from '@/app/permisos/page';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatTimestampForExcel = (ts: any, includeTime = false): string => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (date instanceof Date && !isNaN(date.getTime())) {
        const formatString = includeTime ? 'dd/MM/yy HH:mm' : 'dd/MM/yy';
        return format(date, formatString, { locale: es });
    }
    return 'Fecha Inválida';
};

export const downloadPermisosAsExcel = (permits: PermitRow[]) => {
  const now = new Date();
  const fechaHoraExportacion = format(now, 'dd/MM/yy HH:mm', { locale: es });

  const headers = [
    "NE", "Consignatario", "ETA", "Referencia", "Factura Asociada", "Permiso", "Tipo de Trámite",
    "Estado", "Ejecutivo Asignado", "Fecha Sometido", "Fecha Retiro Estimada", 
    "Entregado a", "Fecha de Remisión"
  ];

  const rows = permits.map(p => [
    p.ne,
    p.consignee || 'N/A',
    formatTimestampForExcel(p.eta, false),
    p.reference || 'N/A',
    p.facturaNumber || 'N/A',
    p.name,
    p.tipoTramite || 'N/A',
    p.status,
    p.assignedExecutive || p.executive,
    formatTimestampForExcel(p.tramiteDate, false),
    formatTimestampForExcel(p.estimatedDeliveryDate, false),
    p.permitDelivery?.deliveredTo || 'Pendiente',
    formatTimestampForExcel(p.permitDelivery?.deliveredAt, true)
  ]);

  const ws_data = [
    [`Reporte de Gestión de Permisos`],
    [`Generado el: ${fechaHoraExportacion}`],
    [],
    headers,
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  
  const colWidths = headers.map((header, i) => ({
    wch: Math.max(header.length, ...rows.map(row => String(row[i] || '').length)) + 2
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte Permisos");
  XLSX.writeFile(wb, `Reporte_Permisos_${now.toISOString().split('T')[0]}.xlsx`);
};

    