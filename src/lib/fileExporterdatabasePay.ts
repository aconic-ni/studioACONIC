
import type { InitialDataContext, SolicitudData, ExportableSolicitudContextData, SolicitudRecord } from '@/types';
import type { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatDateForExport = (dateValue: Date | Timestamp | string | null | undefined): string => {
  if (!dateValue) return 'N/A';
  if (typeof dateValue === 'string') return dateValue;
  const dateObj = dateValue instanceof Date ? dateValue : (dateValue as Timestamp).toDate();
  return format(dateObj, "yyyy-MM-dd HH:mm:ss", { locale: es });
};

const formatCurrencyForExportDisplay = (amount?: number | string, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';
    return `${prefix}${num.toFixed(2)}`;
};

const formatBooleanForExport = (value?: boolean): string => {
  return value ? 'Sí' : 'No';
};


export function downloadTxtFile(initialContextData: InitialDataContext, solicitudes: SolicitudData[]) {
  const fechaSolicitud = initialContextData.date ? format(new Date(initialContextData.date), "PPP", { locale: es }) : 'Fecha no especificada';
  const userName = initialContextData.manager || 'Usuario no especificado';
  const solicitudIDs = solicitudes.map(s => s.id).join(', ') || 'ninguna solicitud';
  const ne = initialContextData.ne || 'N/A';
  const referencia = initialContextData.reference || 'N/A';

  let content = `Buen día Contabilidad;\n${fechaSolicitud}\n\n`;
  content += `Por este medio, yo ${userName}, he generado ID de Solicitud No. (${solicitudIDs}) debidamente guardadas en CustomsFA-L, Sistema de Gestión de Pagos de ACONIC, solicito su apoyo validando la operación en su integración de sistema local, se entrega Solicitud de Cheque física firmada.\n\n`;
  content += `NE: ${ne}\n`;
  content += `Referencia: ${referencia}\n\n`;
  content += `Sin más a que hacer referencia.\n\n`;
  content += `Atentamente,`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SolicitudCheque_${initialContextData.ne || 'SIN_NE'}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExcelFileFromTable(data: Record<string, any>[], headers: string[], fileName: string) {
  const wb = XLSX.utils.book_new();

  const ws_data = [
    headers,
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (value instanceof Date) {
        return format(value, "yyyy-MM-dd HH:mm:ss", { locale: es });
      }
      return value ?? 'N/A';
    }))
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  const colWidths = headers.map((_, i) => {
    let maxLen = 0;
    ws_data.forEach(row => {
      const cellContent = row[i] ? String(row[i]) : '';
      if (cellContent.length > maxLen) {
        maxLen = cellContent.length;
      }
    });
    return { wch: Math.min(Math.max(maxLen, 10), 50) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Resultados de Búsqueda");
  XLSX.writeFile(wb, fileName);
}


export function downloadDetailedExcelFile(data: ExportableSolicitudContextData) {
  const wb = XLSX.utils.book_new();
  const generalInfo = data;
  const solicitudesToExport = Array.isArray(data.solicitudes) ? data.solicitudes : [];
  let currentNumRows = 0;

  solicitudesToExport.forEach((solicitud, index) => {
    const sheetData: (string | number | Date | null | undefined)[][] = [];
    currentNumRows = 0; // Reset for each sheet

    const addRow = (rowData: (string | number | Date | null | undefined)[]) => {
      sheetData.push(rowData);
      currentNumRows++;
    };
    
    const ensureCellExists = (ws: XLSX.WorkSheet, r: number, c: number, value?: any, type?: string) => {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { v: value !== undefined ? value : '', t: type || (value !== undefined ? (typeof value === 'number' ? 'n' : 's') : 's') };
      } else {
        if (value !== undefined) ws[cellAddress].v = value;
        if (type) ws[cellAddress].t = type;
        else if (value !== undefined && !ws[cellAddress].t) ws[cellAddress].t = (typeof value === 'number' ? 'n' : 's');

      }
      if (!ws[cellAddress].s) ws[cellAddress].s = {};
      if (!ws[cellAddress].s.alignment) ws[cellAddress].s.alignment = {};
      return ws[cellAddress];
    };


    addRow(['SOLICITUD DE CHEQUE - CustomsFA-L']); // Row 1 (index 0)
    addRow([]); // Row 2 (index 1)

    addRow(['INFORMACIÓN GENERAL:']); // Row 3 (index 2)
    addRow(['A (Destinatario):', generalInfo.recipient]);
    addRow(['De (Usuario):', generalInfo.manager]);
    addRow(['Fecha de Solicitud:', generalInfo.date ? format(generalInfo.date instanceof Date ? generalInfo.date : (generalInfo.date as Timestamp).toDate(), "PPP", { locale: es }) : 'N/A']);
    addRow(['NE (Tracking NX1):', generalInfo.ne]);
    addRow(['Referencia:', generalInfo.reference || 'N/A']);
    addRow([]); // Row 9 (index 8)

    addRow(['DETALLES DE LA SOLICITUD (ID: ' + solicitud.id + '):']); // Row 10 (index 9)
    addRow([]); // Row 11 (index 10)
    
    // Section: Monto y Cantidad - Row 12 (index 11) starts here
    addRow(['Por este medio me dirijo a usted para solicitarle que elabore cheque por la cantidad de:']); // Row 12 (index 11), Col A
    addRow([formatCurrencyForExportDisplay(solicitud.monto, solicitud.montoMoneda)]); // Row 13 (index 12), Col A
    addRow(['Cantidad en Letras:', solicitud.cantidadEnLetras || 'N/A']); // Row 14 (index 13), Col A & B
    addRow([]); // Row 15 (index 14)

    addRow(['INFORMACIÓN ADICIONAL DE SOLICITUD:']); // Row 16
    addRow(['  Consignatario:', solicitud.consignatario || 'N/A']);
    addRow(['  Declaración Número:', solicitud.declaracionNumero || 'N/A']);
    addRow(['  Unidad Recaudadora:', solicitud.unidadRecaudadora || 'N/A']);
    addRow(['  Código 1:', solicitud.codigo1 || 'N/A']);
    addRow(['  Codigo MUR:', solicitud.codigo2 || 'N/A']);
    addRow([]);

    addRow(['CUENTA BANCARIA:']);
    let bancoDisplay = solicitud.banco || 'N/A';
    if (solicitud.banco === 'Otros' && solicitud.bancoOtros) {
      bancoDisplay = `${solicitud.bancoOtros} (Otros)`;
    } else if (solicitud.banco === 'ACCION POR CHEQUE/NO APLICA BANCO') {
      bancoDisplay = 'Acción por Cheque / No Aplica Banco';
    }
    addRow(['  Banco:', bancoDisplay]);
    if (solicitud.banco !== 'ACCION POR CHEQUE/NO APLICA BANCO') {
      addRow(['  Número de Cuenta:', solicitud.numeroCuenta || 'N/A']);
      let monedaCuentaDisplay = solicitud.monedaCuenta || 'N/A';
      if (solicitud.monedaCuenta === 'Otros' && solicitud.monedaCuentaOtros) {
        monedaCuentaDisplay = `${solicitud.monedaCuentaOtros} (Otros)`;
      }
      addRow(['  Moneda de la Cuenta:', monedaCuentaDisplay]);
    }
    addRow([]);

    addRow(['BENEFICIARIO DEL PAGO:']);
    addRow(['  Elaborar Cheque A:', solicitud.elaborarChequeA || 'N/A']);
    addRow(['  Elaborar Transferencia A:', solicitud.elaborarTransferenciaA || 'N/A']);
    addRow([]);

    addRow(['DETALLES ADICIONALES Y DOCUMENTACIÓN:']);
    addRow(['  Impuestos pagados por el cliente mediante:', formatBooleanForExport(solicitud.impuestosPagadosCliente)]);
    if (solicitud.impuestosPagadosCliente) {
      addRow(['    R/C No.:', solicitud.impuestosPagadosRC || 'N/A']);
      addRow(['    T/B No.:', solicitud.impuestosPagadosTB || 'N/A']);
      addRow(['    Cheque No.:', solicitud.impuestosPagadosCheque || 'N/A']);
    }
    addRow(['  Impuestos pendientes de pago por el cliente:', formatBooleanForExport(solicitud.impuestosPendientesCliente)]);
    addRow(['  Soporte:', formatBooleanForExport(solicitud.soporte)]);
    addRow(['  Se añaden documentos adjuntos:', formatBooleanForExport(solicitud.documentosAdjuntos)]);
    addRow(['  Constancias de no retención:', formatBooleanForExport(solicitud.constanciasNoRetencion)]);
    if (solicitud.constanciasNoRetencion) {
      addRow(['    1%:', formatBooleanForExport(solicitud.constanciasNoRetencion1)]);
      addRow(['    2%:', formatBooleanForExport(solicitud.constanciasNoRetencion2)]);
    }
    addRow([]);

    if(solicitud.pagoServicios){
        addRow(['PAGO DE SERVICIOS:']);
        addRow(['  Tipo de Servicio:', solicitud.tipoServicio === 'OTROS' ? solicitud.otrosTipoServicio : solicitud.tipoServicio || 'N/A']);
        addRow(['  Factura Servicio:', solicitud.facturaServicio || 'N/A']);
        addRow(['  Institución Servicio:', solicitud.institucionServicio || 'N/A']);
        addRow([]);
    }

    addRow(['COMUNICACIÓN Y OBSERVACIONES:']); // Label
    addRow(['  Correos de Notificación:', solicitud.correo || 'N/A']);
    addRow(['  Observación:']); // Label
    addRow([solicitud.observation || 'N/A']); // Value on new line

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    ws['!cols'] = [{wch: 39.93}, {wch: 41.86}];
    ws['!rows'] = []; // Crucial: Allow Excel to auto-adjust row heights for wrapped text

    let cantidadEnLetrasRowIndex = -1;
    let observacionRowIndex = -1;

    // Base styling loop
    for (let r = 0; r < currentNumRows; ++r) {
        for (let c = 0; c < 2; ++c) { // Iterate only columns A (0) and B (1)
            const cellAddress = XLSX.utils.encode_cell({ r, c });
            const cellValue = sheetData[r]?.[c];

            if (cellValue === null || cellValue === undefined || String(cellValue).trim() === '') {
                ensureCellExists(ws, r, c, '', 's'); // Ensure cell exists even if empty for styling
            } else {
                ensureCellExists(ws, r, c, String(cellValue), typeof cellValue === 'number' ? 'n' : 's');
            }

            // Base alignment: wrap text, vertical top, horizontal left
            ws[cellAddress].s.alignment.wrapText = true;
            ws[cellAddress].s.alignment.vertical = 'top';
            ws[cellAddress].s.alignment.horizontal = 'left';


            // Bolding logic
            const isLabelCellInColA = c === 0 && typeof cellValue === 'string' && cellValue.endsWith(':');
            const isValueCellInColB = c === 1 && typeof sheetData[r]?.[0] === 'string' && (sheetData[r][0] as string).endsWith(':');
            // For single values in Col A (like monto, or cantidadEnLetras/observacion values now in Col A)
            const isSingleValueInColA = c === 0 && 
                                       (sheetData[r].length === 1 || sheetData[r][1] === null || sheetData[r][1] === undefined) &&
                                       cellValue && String(cellValue).trim() !== 'N/A' && String(cellValue).trim() !== '' &&
                                       !(typeof cellValue === 'string' && cellValue === cellValue.toUpperCase() && cellValue.endsWith(':'));


            if (isLabelCellInColA && !(typeof cellValue === 'string' && cellValue === cellValue.toUpperCase() && cellValue.endsWith(':'))) { // Non-all-caps labels
                ws[cellAddress].s.font = { bold: true };
            } else if ((isValueCellInColB || isSingleValueInColA) && cellValue && String(cellValue).trim() !== 'N/A' && String(cellValue).trim() !== '') {
                ws[cellAddress].s.font = { bold: true };
            }
            
            // Find rows for specific formatting
            if (c === 0 && typeof cellValue === 'string') {
                if (cellValue.startsWith('Cantidad en Letras:')) cantidadEnLetrasRowIndex = r + 1; // Value is on next row in Col A
                if (cellValue.startsWith('  Observación:')) observacionRowIndex = r + 1; // Value is on next row in Col A
            }
        }
    }
    
    // Main Title Styling
    const mainTitleCell = ensureCellExists(ws, 0, 0);
    mainTitleCell.s.font = { name: 'Calibri', sz: 14, bold: true };
    mainTitleCell.s.alignment.horizontal = 'center';
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });

    // Section Headers Styling (e.g., "INFORMACIÓN GENERAL:")
    sheetData.forEach((row, rIndex) => {
      if (row.length === 1 && typeof row[0] === 'string' && row[0] === row[0].toUpperCase() && row[0].endsWith(':')) {
        const sectionHeaderCell = ensureCellExists(ws, rIndex, 0);
        sectionHeaderCell.s.font = { name: 'Calibri', sz: 11, bold: true };
        sectionHeaderCell.s.alignment.horizontal = 'left';
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: rIndex, c: 0 }, e: { r: rIndex, c: 1 } });
      }
    });

    // Specific styling for "Cantidad en Letras" value (now in Col A)
    if (cantidadEnLetrasRowIndex !== -1 && cantidadEnLetrasRowIndex < currentNumRows) {
        const cellAddr = XLSX.utils.encode_cell({ r: cantidadEnLetrasRowIndex, c: 0 });
        ensureCellExists(ws, cantidadEnLetrasRowIndex, 0, sheetData[cantidadEnLetrasRowIndex][0], 's');
        ws[cellAddr].s.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }; // Was justify, changed to left
        if (ws[cellAddr].v && String(ws[cellAddr].v).trim() !== 'N/A' && String(ws[cellAddr].v).trim() !== '') {
             ws[cellAddr].s.font = { ...ws[cellAddr].s.font, bold: true };
        }
    }
    // Specific styling for "Observación" value (now in Col A)
    if (observacionRowIndex !== -1 && observacionRowIndex < currentNumRows) {
        const cellAddr = XLSX.utils.encode_cell({ r: observacionRowIndex, c: 0 });
        ensureCellExists(ws, observacionRowIndex, 0, sheetData[observacionRowIndex][0], 's');
        ws[cellAddr].s.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
         if (ws[cellAddr].v && String(ws[cellAddr].v).trim() !== 'N/A' && String(ws[cellAddr].v).trim() !== '') {
            ws[cellAddr].s.font = { ...ws[cellAddr].s.font, bold: true };
        }
    }


    if (!ws['!printSetup']) ws['!printSetup'] = {};
    ws['!printSetup'].paperSize = 9; // US Letter
    ws['!printSetup'].orientation = 'portrait';
    ws['!printSetup'].printArea = `A1:B${Math.min(currentNumRows, 50)}`; 
    ws['!printSetup'].fitToWidth = 1;
    ws['!printSetup'].fitToHeight = 1; 

    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 1, r: Math.min(currentNumRows - 1, 49) }});


    const sheetName = `Solicitud ${index + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const fileName = `SolicitudesCheque_${generalInfo.ne || 'SIN_NE'}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
