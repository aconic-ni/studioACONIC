import type { Worksheet } from '@/types';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const downloadCorporateReportAsExcel = async (worksheets: Worksheet[]) => {
  const now = new Date();
  const fechaHoraExportacion = format(now, 'dd/MM/yy HH:mm', { locale: es });

  const formatTimestamp = (ts: any, includeTime = false): string => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (!(date instanceof Date) || isNaN(date.getTime())) return 'Fecha Inválida';
    return format(date, includeTime ? 'dd/MM/yy HH:mm' : 'dd/MM/yy', { locale: es });
  };

  const headers = [
    "NE", "REFERENCIA", "ADUANA INGRESO", "ADUANA DESPACHO", "CONSIGNATARIO",
    "PROVEEDOR", "FACTURA", "No. ADMI", "FECHA ENVIO A CLIENTE", "PERMISO REQUERIDO",
    "ESTADO PERMISO", "FECHA SOMETIDO", "FECHA AUTORIZADO", "PROVEEDOR TRANSPORTE",
    "DECLARACION", "FECHA NACIONALIZACION", "SELECTIVIDAD", "FECHA DESPACHO",
    "OBSERVACIONES"
  ];

  const rows: (string | number)[][] = [];

  for (const ws of worksheets) {
    if (ws.documents && ws.documents.filter(d => d.type === 'FACTURA').length > 0) {
      for (const factura of ws.documents.filter(d => d.type === 'FACTURA')) {
        const relatedPermit = ws.requiredPermits?.find(p => p.facturaNumber === factura.number);
        rows.push([
          ws.ne, ws.reference || 'N/A', ws.entryCustoms, ws.dispatchCustoms, ws.consignee,
          ws.proveedor || 'N/A', factura.number, (factura as any).noADMI || 'N/A', formatTimestamp(ws.fechaEnvioCliente, false),
          relatedPermit?.name || 'N/A', relatedPermit?.status || 'N/A',
          formatTimestamp(relatedPermit?.tramiteDate, false),
          formatTimestamp(relatedPermit?.status === 'Entregado' ? relatedPermit.estimatedDeliveryDate : null, false), // Only show date if delivered
          ws.proveedorTransporte || 'N/A', ws.declaracionNumero || 'N/A',
          formatTimestamp(ws.fechaNacionalizacion, false), ws.selectividad || 'N/A',
          formatTimestamp(ws.fechaDespacho, false), ws.observations || ''
        ]);
      }
    } else {
      // Add a row even if there are no facturas, with factura details blank
      rows.push([
        ws.ne, ws.reference || 'N/A', ws.entryCustoms, ws.dispatchCustoms, ws.consignee,
        ws.proveedor || 'N/A', 'N/A', 'N/A', formatTimestamp(ws.fechaEnvioCliente, false),
        'N/A', 'N/A', 'N/A', 'N/A', // Permit details
        ws.proveedorTransporte || 'N/A', ws.declaracionNumero || 'N/A',
        formatTimestamp(ws.fechaNacionalizacion, false), ws.selectividad || 'N/A',
        formatTimestamp(ws.fechaDespacho, false), ws.observations || ''
      ]);
    }
  }

  const ws_data = [
    [`Reporte de Consignatarios Empresariales`],
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
  XLSX.utils.book_append_sheet(wb, ws, "Reporte Corporativo");
  XLSX.writeFile(wb, `Reporte_Corporativo_${now.toISOString().split('T')[0]}.xlsx`);
};
