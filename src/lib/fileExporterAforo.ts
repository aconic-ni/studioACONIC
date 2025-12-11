
import type { AforoCase, AforoCaseUpdate } from '@/types';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export async function downloadAforoReportAsExcel(cases: AforoCase[], auditLogs: (AforoCaseUpdate & { caseNe: string })[]) {
    const now = new Date();
    const fechaHoraExportacion = format(now, 'dd/MM/yy HH:mm', { locale: es });

    // --- Hoja 1: Reporte Aforo Casos ---
    const caseHeaders = [
        "NE", "Consignatario", "Mercancía", "Modelo (Patrón)", "Aforador", "Fecha Asignación", 
        "Total Posiciones", "Entregado a Aforo", "Revisor Asignado", "Estado Revisor", "Observación Revisor",
        "Estado Aforador", "Estado Digitación", "Digitador Asignado", "Fecha Asign. Digitador",
        "Declaración Aduanera", "Incidencia Reportada", "Motivo Incidencia", "Estado Incidencia"
    ];
    const caseRows = cases.map(c => [
        c.ne, c.consignee, c.merchandise, c.declarationPattern, c.aforador, formatTimestamp(c.assignmentDate),
        c.totalPosiciones || 'N/A', formatTimestamp(c.entregadoAforoAt), c.revisorAsignado || 'N/A',
        c.revisorStatus || 'N/A', c.observacionRevisor || '', c.aforadorStatus || 'N/A', c.digitacionStatus || 'N/A',
        c.digitadorAsignado || 'N/A', formatTimestamp(c.digitadorAsignadoAt),
        c.declaracionAduanera || 'N/A', c.incidentReported ? 'Sí' : 'No', c.incidentReason || 'N/A', c.incidentStatus || 'N/A'
    ]);
    const ws_cases = generateSheet(caseHeaders, caseRows, "Reporte Aforo Casos - Customs Reports", `Generado el: ${fechaHoraExportacion}`);
    
    // --- Hoja 2: Bitácora de Cambios ---
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
    XLSX.utils.book_append_sheet(wb, ws_cases, "Reporte Aforo Casos");
    XLSX.utils.book_append_sheet(wb, ws_logs, "Bitácora de Cambios");
    XLSX.writeFile(wb, `Reporte_Aforo_${now.toISOString().split('T')[0]}.xlsx`);
}
