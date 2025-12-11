
"use client";
import React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { AdminAuditLogEntry, AuditLogEntry, Product, ExamDocument } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { History, Printer, User, FileEdit, Archive, Hash, Weight, FileText, Tag, Puzzle, Ruler, Fingerprint, Globe, Barcode, Package, Box, ShieldCheck, MessageSquare, ClipboardList, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return format(date, 'dd/MM/yy HH:mm', { locale: es });
};

const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; icon?: React.ReactNode }> = ({ label, value, icon }) => {
    let displayValue: string;
    if (typeof value === 'boolean') {
      displayValue = value ? 'Sí' : 'No';
    } else if (value instanceof Timestamp) {
      displayValue = formatTimestamp(value);
    } else {
      displayValue = String(value ?? 'N/A');
    }
  
    return (
      <div className="text-xs">
        <div className="flex items-center">
          {icon && <span className="mr-2 text-primary">{icon}</span>}
          <p className="font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="text-foreground ml-6">{displayValue}</p>
      </div>
    );
};

const getProductStatusText = (product?: Partial<Product>): string => {
    if (!product) return "N/A";
    const statuses: string[] = [];
    if (product.isConform) statuses.push("Conforme a factura");
    if (product.isExcess) statuses.push("Excedente");
    if (product.isMissing) statuses.push("Faltante");
    if (product.isFault) statuses.push("Avería");
    if (statuses.length === 0) return "Sin estado específico";
    return statuses.join(', ');
};

const ProductChangeDetail: React.FC<{ product?: Partial<Product> | null, exam: ExamDocument }> = ({ product, exam }) => {
    if (!product) {
        return <div className="text-muted-foreground text-sm italic">Sin datos</div>;
    }

    const productCreationDate = product.productTimestampSaveAt || exam.assignedAt || exam.createdAt || exam.savedAt;

    return (
        <div className="space-y-3">
             <DetailItem label="Fecha de Ingreso del Producto" value={formatTimestamp(productCreationDate)} icon={<CalendarPlus size={14} />} />
             <DetailItem label="Número de Item" value={product.itemNumber} icon={<Hash size={14} />} />
             <DetailItem label="Descripción" value={product.description} icon={<FileText size={14} />} />
             <DetailItem label="Marca" value={product.brand} icon={<Tag size={14} />} />
             <DetailItem label="Modelo" value={product.model} icon={<Puzzle size={14} />} />
             <DetailItem label="Serie" value={product.serial} icon={<Fingerprint size={14} />} />
             <DetailItem label="Origen" value={product.origin} icon={<Globe size={14} />} />
             <DetailItem label="Peso" value={product.weight} icon={<Weight size={14} />} />
             <DetailItem label="Unidad de Medida" value={product.unitMeasure} icon={<Ruler size={14} />} />
             <DetailItem label="Numeración de Bultos" value={product.numberPackages} icon={<Barcode size={14} />} />
             <DetailItem label="Cantidad de Bultos" value={product.quantityPackages as number} icon={<Package size={14} />} />
             <DetailItem label="Cantidad de Unidades" value={product.quantityUnits as number} icon={<Box size={14} />} />
             <DetailItem label="Condición Embalaje" value={product.packagingCondition} icon={<ShieldCheck size={14} />} />
             <DetailItem label="Observación" value={product.observation} icon={<MessageSquare size={14} />} />
             <DetailItem label="Estado General" value={getProductStatusText(product)} icon={<ClipboardList size={14} />} />
        </div>
    )
}


const ValueDisplay = ({ value, exam }: { value: any, exam: ExamDocument }) => {
    if (value === null || value === undefined) {
        return <i className="text-muted-foreground">N/A</i>;
    }
    if (typeof value === 'object' && !(value instanceof Timestamp)) {
       return <ProductChangeDetail product={value as Partial<Product>} exam={exam} />;
    }
    if (value instanceof Timestamp) {
        return <span className="text-blue-600">{formatTimestamp(value)}</span>;
    }
    if (typeof value === 'boolean') {
        return <span className="font-mono text-sm">{value ? 'Verdadero' : 'Falso'}</span>;
    }
    return <span className="text-foreground">{String(value)}</span>;
};


const getActionTitle = (action?: string) => {
    switch (action) {
        case 'update': return { icon: <Archive className="h-4 w-4" />, text: 'Actualización de Estado' };
        case 'product_added': return { icon: <FileEdit className="h-4 w-4" />, text: 'Producto Añadido' };
        case 'product_updated': return { icon: <FileEdit className="h-4 w-4" />, text: 'Producto Modificado' };
        case 'product_deleted': return { icon: <FileEdit className="h-4 w-4" />, text: 'Producto Eliminado' };
        default: return { icon: <History className="h-4 w-4" />, text: 'Cambio Registrado' };
    }
}


export const AuditLogPreview: React.FC<{ logs: (AdminAuditLogEntry | AuditLogEntry)[]; exam: ExamDocument }> = ({ logs, exam }) => {
  
  const handlePrint = () => {
    window.print();
  };
  
  return (
    <Card className="mt-6 w-full max-w-5xl mx-auto custom-shadow" id="printable-area">
       <Image
            src="/AconicExaminer/imagenes/HEADERSEXA.svg"
            alt="Examen Header"
            width={800}
            height={100}
            className="w-full h-auto mb-4 hidden print:block"
            priority
        />
      <CardHeader className="border-b pb-4">
        <div className="flex justify-between items-center no-print">
            <div className="flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                <CardTitle>Historial de Cambios Unificado</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
        </div>
        <div className="print:block hidden text-center mb-4">
             <CardTitle>Historial de Cambios Unificado</CardTitle>
        </div>
        <CardDescription>
            Mostrando el historial de modificaciones para el examen <span className="font-semibold text-foreground">{exam.ne}</span> del consignatario <span className="font-semibold text-foreground">{exam.consignee}</span>.
        </CardDescription>
        <div className="text-sm text-muted-foreground pt-2">
            Gestor del Previo Original: <span className="font-semibold text-foreground">{exam.manager}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[60vh] no-print">
          <div className="space-y-6 p-1">
             {/* Content for screen view */}
             <LogEntries logs={logs} exam={exam} />
          </div>
        </ScrollArea>
        <div className="hidden print:block space-y-6">
            {/* Content for print view */}
            <LogEntries logs={logs} exam={exam} />
        </div>
      </CardContent>
       <Image
          src="/AconicExaminer/imagenes/FOOTEREXA.svg"
          alt="Examen Footer"
          width={800}
          height={50}
          className="w-full h-auto mt-6 hidden print:block"
      />
    </Card>
  );
};


const LogEntries = ({ logs, exam }: { logs: (AdminAuditLogEntry | AuditLogEntry)[], exam: ExamDocument }) => {
    if (logs.length === 0) {
        return <div className="text-center text-muted-foreground py-10">No hay registros de cambios para este documento.</div>;
    }

    return (
        <>
        {logs.map((log) => {
            const isAdminLog = 'adminEmail' in log;
            const logTimestamp = isAdminLog ? log.timestamp : log.changedAt;
            const userEmail = isAdminLog ? log.adminEmail : log.changedBy;
            const actionInfo = getActionTitle(log.action);
            
            return (
                <div key={log.id} className="p-4 border rounded-lg bg-card shadow-sm print-product-container">
                    <div className="flex flex-col sm:flex-row justify-between items-start text-sm mb-3 border-b pb-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <span className="text-primary">{actionInfo.icon}</span>
                            <span>{actionInfo.text}</span>
                        </div>
                        <span className="text-muted-foreground mt-1 sm:mt-0">{formatTimestamp(logTimestamp)}</span>
                    </div>

                    <div className="flex items-center gap-2 mb-3 text-sm">
                        <User className="h-4 w-4 text-muted-foreground"/>
                        <span className="font-medium">Realizado por:</span>
                        <span>{userEmail}</span>
                    </div>

                     <div className="p-4 bg-secondary/30 rounded-lg">
                        {isAdminLog ? (
                            <div className="space-y-3">
                            {log.changes.map((change, index) => (
                                <div key={index} className="text-sm">
                                    <p className="font-semibold mb-2">Campo modificado: <code className="bg-primary/10 text-primary px-2 py-1 rounded-sm">{change.field}</code></p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-medium text-muted-foreground mb-1">Valor Anterior</h4>
                                            <ValueDisplay value={change.oldValue} exam={exam}/>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-foreground mb-1">Valor Nuevo</h4>
                                            <ValueDisplay value={change.newValue} exam={exam} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            </div>
                        ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <h4 className="font-medium text-muted-foreground mb-2">Datos Anteriores</h4>
                                    <ValueDisplay value={log.details?.previousData} exam={exam} />
                                </div>
                                <div>
                                    <h4 className="font-medium text-foreground mb-2">Datos Nuevos</h4>
                                    <ValueDisplay value={log.details?.newData} exam={exam} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
        })}
        </>
    )
}
