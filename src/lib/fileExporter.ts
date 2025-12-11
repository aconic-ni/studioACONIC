
import type { ExamData, Product, ExamDocument, ExportableExamData, AforoCase, AforoCaseUpdate, Worksheet } from '@/types';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from './firebase';

export function downloadTxtFile(examData: ExamData, products: Product[]) {
  let content = `EXAMEN PREVIO AGENCIA ACONIC - CustomsEX-p\n`;
  content += `===========================================\n\n`;
  content += `INFORMACIÓN GENERAL DEL EXAMEN:\n`;
  content += `NE: ${examData.ne}\n`;
  content += `Referencia: ${examData.reference || 'N/A'}\n`;
  content += `Consignatario: ${examData.consignee}\n`;
  content += `Gestor: ${examData.manager}\n`;
  content += `Ubicación: ${examData.location}\n\n`;
  content += `PRODUCTOS:\n`;

  (Array.isArray(products) ? products : []).forEach((product, index) => {
    content += `\n--- Producto ${index + 1} ---\n`;
    content += `Número de Item: ${product.itemNumber || 'N/A'}\n`;
    content += `Numeración de Bultos: ${product.numberPackages || 'N/A'}\n`;
    content += `Cantidad de Bultos: ${product.quantityPackages || 0}\n`;
    content += `Cantidad de Unidades: ${product.quantityUnits || 0}\n`;
    content += `Descripción: ${product.description || 'N/A'}\n`;
    content += `Marca: ${product.brand || 'N/A'}\n`;
    content += `Modelo: ${product.model || 'N/A'}\n`;
    content += `Serie: ${product.serial || 'N/A'}\n`;
    content += `Origen: ${product.origin || 'N/A'}\n`;
    content += `Estado de Mercancía: ${product.packagingCondition || 'N/A'}\n`;
    content += `Unidad de Medida: ${product.unitMeasure || 'N/A'}\n`;
    content += `Peso: ${product.weight || 'N/A'}\n`;
    content += `Observación: ${product.observation || 'N/A'}\n`;
    
    const statuses = [];
    if (product.isConform) statuses.push("Conforme a factura");
    if (product.isExcess) statuses.push("Excedente");
    if (product.isMissing) statuses.push("Faltante");
    if (product.isFault) statuses.push("Avería");
    content += `Estado: ${statuses.length > 0 ? statuses.join(', ') : 'Sin estado específico'}\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CustomsEX-p_${examData.ne}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExcelFile(data: ExportableExamData) {
  const now = new Date();
  const fechaHoraExportacion = format(now, 'dd/MM/yy HH:mm', { locale: es });

  const photoLinkUrl = `https://aconisani-my.sharepoint.com/:f:/g/personal/asuntos_juridicos_aconic_com_ni/Emrpj4Ss8bhDifpuYc8U_bwBj9r29FGcXxzfxu4PSh2tEQ?e=FhIPTt`;

  // --- Hoja 1: Detalles del Examen y Productos ---
  const examDetailsSheetData: (string | number | Date | null | undefined | XLSX.CellObject)[][] = [
    ['EXAMEN PREVIO AGENCIA ACONIC - CustomsEX-p'],
    [],
    ['INFORMACIÓN GENERAL DEL EXAMEN:'],
    ['NE:', data.ne],
    ['Referencia:', data.reference || 'N/A'],
    ['Consignatario:', data.consignee],
    ['Gestor del Examen:', data.manager],
    ['Ubicación Mercancía:', data.location],
    ['Fotos:', { v: 'Abrir Carpeta de Fotos', t: 's', l: { Target: photoLinkUrl, Tooltip: 'Ir a la carpeta de fotos en SharePoint' } }],
    [],
    ['PRODUCTOS:']
  ];

  const productHeaders = [
    'Número de Item', 'Numeración de Bultos', 'Cantidad de Bultos', 'Cantidad de Unidades',
    'Descripción', 'Marca', 'Modelo', 'Origen', 'Estado de Mercancía',
    'Peso', 'Unidad de Medida', 'Serie', 'Observación', 'Estado'
  ];
  
  const productRows = (Array.isArray(data.products) ? data.products : []).map(product => {
    let statusText = '';
    const statuses = [];
    if (product.isConform) statuses.push("Conforme");
    if (product.isExcess) statuses.push("Excedente");
    if (product.isMissing) statuses.push("Faltante");
    if (product.isFault) statuses.push("Avería");
    statusText = statuses.length > 0 ? statuses.join('/') : 'S/E';

    return [
      product.itemNumber || 'N/A',
      product.numberPackages || 'N/A',
      product.quantityPackages || 0,
      product.quantityUnits || 0,
      product.description || 'N/A',
      product.brand || 'N/A',
      product.model || 'N/A',
      product.origin || 'N/A',
      product.packagingCondition || 'N/A',
      product.weight || 'N/A',
      product.unitMeasure || 'N/A',
      product.serial || 'N/A',
      product.observation || 'N/A',
      statusText
    ];
  });

  const ws_exam_details_data = [...examDetailsSheetData, productHeaders, ...productRows];
  const ws_exam_details = XLSX.utils.aoa_to_sheet(ws_exam_details_data);

  // Ajustar anchos de columna para la hoja de detalles del examen
  const examColWidths = productHeaders.map((header, i) => ({
    wch: Math.max(
      header.length,
      ...(ws_exam_details_data.slice(examDetailsSheetData.length) as string[][]).map(row => row[i] ? String(row[i]).length : 0)
    ) + 2 
  }));
  
  const generalInfoLabels = examDetailsSheetData.slice(0, examDetailsSheetData.length - 2).map(row => String(row[0] || ''));
  const generalInfoValues = examDetailsSheetData.slice(0, examDetailsSheetData.length - 2).map(row => {
    const cellValue = row[1];
    if (typeof cellValue === 'object' && cellValue !== null && 'v' in cellValue) {
      return String((cellValue as XLSX.CellObject).v || '');
    }
    return String(cellValue || '');
  });

  if (examColWidths.length > 0) {
    examColWidths[0].wch = Math.max(examColWidths[0]?.wch || 0, ...generalInfoLabels.map(label => label.length + 2));
  }
  if (examColWidths.length > 1) {
    examColWidths[1].wch = Math.max(examColWidths[1]?.wch || 0, ...generalInfoValues.map(value => value.length + 5));
  }
  ws_exam_details['!cols'] = examColWidths;

  // --- Hoja 2: Detalles del Sistema ---
  const systemDetailsSheetData: (string | number | Date | null | undefined)[][] = [
    ['DETALLES DE SISTEMA DEL EXAMEN:']
  ];

  if (data.savedBy) {
    systemDetailsSheetData.push(['Guardado por (correo):', data.savedBy]);
  } else {
    systemDetailsSheetData.push(['Guardado por (correo):', 'N/A (No guardado en BD aún o dato no disponible)']);
  }

  const toLocaleStringSafe = (timestamp: Timestamp | Date | null | undefined) => {
    if (!timestamp) return 'N/A';
    const date = (timestamp as Timestamp)?.toDate ? (timestamp as Timestamp).toDate() : (timestamp as Date);
    if (date instanceof Date && !isNaN(date.getTime())) {
      return format(date, 'dd/MM/yy HH:mm', { locale: es });
    }
    return 'Fecha inválida';
  }

  systemDetailsSheetData.push(['Fecha y Hora de Inicio:', toLocaleStringSafe(data.createdAt)]);
  systemDetailsSheetData.push(['Fecha y Hora de Último Guardado:', toLocaleStringSafe(data.savedAt)]);
  systemDetailsSheetData.push(['Fecha y Hora de Finalización:', data.completedAt ? toLocaleStringSafe(data.completedAt) : 'Examen no finalizado']);
  systemDetailsSheetData.push(['Fecha y Hora de Exportación:', fechaHoraExportacion]);


  const ws_system_details = XLSX.utils.aoa_to_sheet(systemDetailsSheetData);
  
  // Ajustar anchos de columna para la hoja de detalles del sistema
  const systemColWidths = [
    { wch: Math.max(...systemDetailsSheetData.map(row => String(row[0]).length)) + 2 },
    { wch: Math.max(...systemDetailsSheetData.map(row => String(row[1]).length)) + 5 },
  ];
  ws_system_details['!cols'] = systemColWidths;


  // --- Crear y descargar el libro ---
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws_exam_details, `Examen ${data.ne}`);
  XLSX.utils.book_append_sheet(wb, ws_system_details, "Detalle de Sistema");
  
  XLSX.writeFile(wb, `CustomsEX-p_${data.ne}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

const formatTimestamp = (ts: any, includeTime = true): string => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (date instanceof Date && !isNaN(date.getTime())) {
        const formatString = includeTime ? 'dd/MM/yy HH:mm' : 'dd/MM/yy';
        return format(date, formatString, { locale: es });
    }
    return 'Fecha Inválida';
};

const formatValueForExcel = (value: any) => {
    if (value instanceof Timestamp) return formatTimestamp(value);
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (value === null || value === undefined || value === '') return 'vacío';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const generateSheet = (headers: string[], rows: (string|number|null|undefined)[][], title: string, subtitle: string) => {
    const data = [
        [title],
        [subtitle],
        [],
        headers,
        ...rows
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const colWidths = headers.map((header, i) => ({
        wch: Math.max(header.length, ...rows.map(row => String(row[i] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;
    return ws;
};

export async function downloadExecutiveReportAsExcel(cases: (AforoCase & { worksheet?: Worksheet | null })[], auditLogs: (AforoCaseUpdate & { caseNe: string })[]) {
    const now = new Date();
    const fechaHoraExportacion = format(now, 'dd/MM/yy HH:mm', { locale: es });

    // --- Hoja 1: Reporte Ejecutivo (Principal) ---
    const caseHeaders = [
        "NE", "INICIO DE OPERACION", "RESA", "VENCIMIENTO DE RESA", "CONSIGNATARIO", "FACTURA", "ASIGNACION DE AFORO", 
        "ESTATUS DE REVISOR", "ESTATUS DIGITACION", "SELECTIVO", "FECHA DE DESPACHO", "TIPO INCIDENCIA", "FACTURADO", 
        "FECHA DE FACTURACION", "CUENTA DE REGISTRO", "ESTATUS EJECUTIVO (AMPLIADO)"
    ];
    const caseRows = cases.map(c => {
        const estatusAmpliado = [
            `Aforador: ${c.aforadorStatus || 'N/A'}`,
            `Revisor: ${c.revisorStatus || 'N/A'}`,
            `Preliquidación: ${c.preliquidationStatus || 'N/A'}`,
            `Digitación: ${c.digitacionStatus || 'N/A'}`,
        ].join(' | ');

        return [
            c.ne,
            formatTimestamp(c.createdAt),
            c.worksheet?.resa || 'N/A',
            formatTimestamp(c.resaDueDate, false),
            c.consignee,
            c.facturaNumber || 'N/A',
            formatTimestamp(c.assignmentDate),
            c.revisorStatus || 'N/A',
            c.digitacionStatus || 'N/A',
            c.selectividad || 'N/A',
            formatTimestamp(c.fechaDespacho, false),
            c.incidentType || 'N/A',
            c.facturado ? 'Sí' : 'No',
            formatTimestamp(c.facturadoAt),
            c.cuentaDeRegistro || 'N/A',
            estatusAmpliado,
        ];
    });
    const ws_cases = generateSheet(caseHeaders, caseRows, "Reporte Ejecutivo - Customs Reports", `Generado el: ${fechaHoraExportacion}`);

    // --- Hoja 2: Casos con Duda de Valor ---
    const dudaHeaders = ["NE", "Consignatario", "Declaración", "Aduana Despacho", "Monto de Preliquidación (USD)", "Proceso", "Levante Solicitado", "Ampliación de Plazo", "Vencimiento de Caso", "Asignado a Legal"];
    const dudaRows = cases.filter(c => c.hasValueDoubt).map(c => [
        c.ne, c.consignee, c.declaracionAduanera || 'N/A', c.worksheet?.dispatchCustoms || 'N/A', c.valueDoubtAmount ?? 'N/A',
        c.valueDoubtStatus || 'N/A', c.valueDoubtLevanteRequested ? 'Sí' : 'No', c.valueDoubtExtensionRequested ? 'Sí' : 'No',
        formatTimestamp(c.valueDoubtDueDate, false), c.valueDoubtAssignedToLegal ? 'Sí' : 'No'
    ]);
    const ws_duda = generateSheet(dudaHeaders, dudaRows, "Casos con Duda de Valor", `Generado el: ${fechaHoraExportacion}`);
    
    // --- Hoja 3: Casos con Complementaria (Rectificación) ---
    const rectificacionHeaders = ["NE", "CONSIGNATARIO", "DECLARACION ADUANERA", "PAGO INICIAL (SI/NO)", "RECIBO DE CAJA PAGO INICIAL", "MONTO DE DECLARACION INICIAL", "ADUANA DE DESPACHO", "MOTIVO DE LA RECTIFICACION", "OBSERVACIONES", "ESTADO INCIDENCIA", "REVISADO POR", "FECHA REVISIÓN"];
    const rectificacionRows = cases.filter(c => c.incidentType === 'Rectificacion').map(c => [
        c.ne, c.consignee, c.declaracionAduanera || 'N/A', c.pagoInicialRealizado ? 'Sí' : 'No',
        c.reciboDeCajaPagoInicial || 'N/A', c.montoPagoInicial ?? 'N/A', c.worksheet?.dispatchCustoms || 'N/A',
        c.motivoRectificacion || '', c.observaciones || '', c.incidentStatus || 'N/A',
        c.incidentReviewedBy || 'N/A', formatTimestamp(c.incidentReviewedAt, false)
    ]);
    const ws_rectificacion = generateSheet(rectificacionHeaders, rectificacionRows, "Casos con Complementaria (Rectificación)", `Generado el: ${fechaHoraExportacion}`);

    // --- Hoja 4: Bitácora de Cambios ---
    const logHeaders = ["NE del Caso", "Fecha de Actualización", "Actualizado Por", "Campo Modificado", "Valor Anterior", "Valor Nuevo", "Comentario"];
    auditLogs.sort((a, b) => {
        if (a.caseNe < b.caseNe) return -1;
        if (a.caseNe > b.caseNe) return 1;
        const dateA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt as Timestamp).toMillis();
        const dateB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt as Timestamp).toMillis();
        return dateA - dateB;
    });
    const logRows = auditLogs.map(log => [
        log.caseNe, formatTimestamp(log.updatedAt), log.updatedBy, log.field,
        formatValueForExcel(log.oldValue), formatValueForExcel(log.newValue), log.comment || ''
    ]);
    const ws_logs = generateSheet(logHeaders, logRows, "Bitácora de Cambios - Customs Reports", `Generado el: ${fechaHoraExportacion}`);


    // --- Crear y descargar libro ---
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws_cases, "Reporte Ejecutivo");
    XLSX.utils.book_append_sheet(wb, ws_duda, "Duda de Valor");
    XLSX.utils.book_append_sheet(wb, ws_rectificacion, "Rectificaciones");
    XLSX.utils.book_append_sheet(wb, ws_logs, "Bitácora de Cambios");
    XLSX.writeFile(wb, `Reporte_Ejecutivo_${now.toISOString().split('T')[0]}.xlsx`);
}
