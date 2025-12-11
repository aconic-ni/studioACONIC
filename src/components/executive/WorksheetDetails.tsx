"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { X, Printer, FileText, User, Building, Weight, Truck, MapPin, Anchor, Plane, Globe, Package, ListChecks, FileSymlink, Link as LinkIcon, Eye, Shield, FileBadge, FileKey, Edit, Calendar } from 'lucide-react';
import type { Worksheet, AppUser } from '@/types';
import { Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { format as formatDateFns } from 'date-fns';
import { es } from 'date-fns/locale';
import { aduanas, aduanaToShortCode } from '@/lib/formData';
import { Anexo5Details } from './anexos/Anexo5Details';
import { Anexo7Details } from './anexos/Anexo7Details';
import { cn } from "@/lib/utils";
import { db } from '@/lib/firebase';
import Link from 'next/link';

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return formatDateFns(date, 'dd/MM/yy HH:mm', { locale: es });
};

const formatShortDate = (timestamp: Timestamp | Date | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return formatDateFns(date, 'dd/MM/yyyy');
};


const getAduanaLabel = (code: string | undefined) => {
    if (!code) return 'N/A';
    const aduana = aduanas.find(a => a.value === code);
    return aduana ? aduana.label.substring(5) : code;
};


const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; icon?: React.ElementType }> = ({ label, value, icon: Icon }) => {
  let displayValue: React.ReactNode;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div className="flex items-start gap-2 print:gap-1">
      {Icon && <Icon className="mr-1 h-4 w-4 text-primary mt-0.5 flex-shrink-0 print:h-3 print:w-3" />}
      <p className="text-xs font-medium text-muted-foreground whitespace-nowrap print:text-[8pt]">{label}:</p>
      <p className="text-sm text-foreground print:text-[9pt]">{displayValue}</p>
    </div>
  );
};

const transportIcons: { [key: string]: React.ElementType } = {
  aereo: Plane,
  maritimo: Anchor,
  frontera: Truck,
  terrestre: Truck,
};

export const WorksheetDetails: React.FC<{ worksheet: Worksheet; onClose: () => void; }> = ({ worksheet, onClose }) => {
  
  if (worksheet.worksheetType === 'anexo_7') {
    return <Anexo7Details worksheet={worksheet} onClose={onClose} />;
  }

  if (worksheet.worksheetType === 'anexo_5') {
    return <Anexo5Details worksheet={worksheet} onClose={onClose} />;
  }
  
  const handlePrint = () => {
    window.print();
  };
  
  const TransportIcon = transportIcons[worksheet.transportMode] || Truck;
  
  const wasModified = worksheet.lastUpdatedAt && worksheet.createdAt && worksheet.lastUpdatedAt.toMillis() !== worksheet.createdAt.toMillis();
  const isPsmtCase = worksheet.consignee?.toUpperCase().trim() === "PSMT NICARAGUA, SOCIEDAD ANONIMA";

  return (
    <>
      <Card className="mt-6 w-full max-w-5xl mx-auto custom-shadow card-print-styles" id="printable-area">
        <div className="hidden print:block">
            <Image
                src="/AconicExaminer/imagenes/HEADERSEXA.svg"
                alt="Examen Header"
                width={800}
                height={100}
                className="w-full h-auto mb-4"
                priority
            />
        </div>
        <div className="no-print">
            <CardHeader className="print:p-0">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-xl md:text-2xl font-semibold text-foreground print:text-lg no-print">Hoja de Trabajo: {worksheet.ne}</CardTitle>
                    <button onClick={onClose} className="p-1 text-destructive hover:text-destructive/80 no-print">
                        <X className="h-6 w-6" />
                    </button>
                </div>
              <CardDescription className="text-muted-foreground no-print print:hidden">
                Vista de solo lectura de la hoja de trabajo.
              </CardDescription>
            </CardHeader>
        </div>
        <CardContent className="space-y-2 print:space-y-1 print:p-0">
          {/* Main Info */}
          <div className="bg-secondary/30 p-4 rounded-md shadow-sm text-sm print:p-2 print:border print:bg-transparent print:shadow-none space-y-2">
               <div className="p-2 border-b border-border flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                        <Building className="mr-1 h-5 w-5 text-primary" />
                        <p className="text-sm font-medium text-muted-foreground print:text-xs">Consignatario:</p>
                    </div>
                    <p className="text-lg text-foreground font-semibold ml-8 print:text-base">{worksheet.consignee}</p>
                    <div className="text-xs text-muted-foreground ml-8 mt-1">
                        <span>Creado: {formatTimestamp(worksheet.createdAt)}</span>
                        {wasModified && (
                        <span className="ml-2">| Modificado: {formatTimestamp(worksheet.lastUpdatedAt)}</span>
                        )}
                    </div>
                  </div>
                   <div className="print-only:block hidden">
                        <Badge className="text-base print:text-sm print:font-bold">Hoja de Trabajo: {worksheet.ne}</Badge>
                   </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-x-6 gap-y-3 print:gap-x-4 print:gap-y-1 ">
                  <DetailItem label="NE" value={worksheet.ne} icon={FileText} />
                  <DetailItem label="Referencia" value={worksheet.reference} icon={FileText} />
                  <DetailItem label="Ejecutivo" value={worksheet.executive} icon={User} />
                  <DetailItem label="ETA" value={formatShortDate(worksheet.eta)} icon={Calendar} />
                  <DetailItem label="Peso Bruto" value={worksheet.grossWeight} icon={Weight} />
                  <DetailItem label="Peso Neto" value={worksheet.netWeight} icon={Weight} />
                  <DetailItem label="Número de Bultos" value={worksheet.packageNumber} icon={Package} />
                  <DetailItem label="Aduana de Entrada" value={getAduanaLabel(worksheet.entryCustoms)} icon={MapPin} />
                  <DetailItem label="Aduana de Despacho" value={getAduanaLabel(worksheet.dispatchCustoms)} icon={MapPin} />
                  <DetailItem label="RESA" value={worksheet.resa} icon={FileBadge} />
                  <DetailItem label="Modo de Transporte" value={worksheet.transportMode} icon={TransportIcon} />
                  {worksheet.inLocalWarehouse && <DetailItem label="Localización" value={worksheet.location} icon={MapPin} />}
                  <DetailItem label="Aplica TLC" value={worksheet.appliesTLC} icon={Shield} />
                  <DetailItem label="Aplica Modexo" value={worksheet.appliesModexo} icon={FileKey} />
                  {worksheet.appliesModexo && <DetailItem label="Código Modexo" value={worksheet.modexoCode} />}
                   {isPsmtCase && worksheet.aforador && <DetailItem label="Aforador Asignado" value={worksheet.aforador} icon={User} />}
              </div>
          </div>
          
          
          {/* Description */}
           <div className="print:mt-1">
            <h4 className="text-lg font-medium mb-2 text-foreground print:text-sm print:mb-1">Descripción</h4>
            <p className="text-sm p-4 border rounded-md bg-card whitespace-pre-wrap print:border print:p-2 print:text-xs">{worksheet.description}</p>
          </div>

          {/* Observations */}
          {worksheet.observations && (
            <div className="print:mt-1">
              <h4 className="text-lg font-medium mb-2 text-foreground print:text-sm print:mb-1">Observaciones</h4>
              <p className="text-sm p-4 border rounded-md bg-card whitespace-pre-wrap print:border print:p-2 print:text-xs">{worksheet.observations}</p>
            </div>
          )}

          <div className="grid grid-cols-1 print:grid-cols-2 print:gap-x-4">
            {/* Documents */}
            <div className="print:mt-1">
                <h4 className="text-lg font-medium mb-2 text-foreground print:text-sm print:mb-1">Documentos Entregados</h4>
                <div className="rounded-md border print:border">
                    <Table className="print:text-[8pt]">
                        <TableHeader><TableRow><TableHead className="print:p-1">Tipo</TableHead><TableHead className="print:p-1">Número</TableHead><TableHead className="print:p-1">Formato</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {worksheet.documents?.length > 0 ? (
                            worksheet.documents.map(doc => (
                                <TableRow key={doc.id}><TableCell className="print:p-1">{doc.type}</TableCell><TableCell className="print:p-1">{doc.number}</TableCell>
                                <TableCell className="print:p-1"><Badge variant={doc.isCopy ? 'secondary' : 'default'} className="print:text-xs print:px-1 print:py-0">{doc.isCopy ? 'Copia' : 'Original'}</Badge></TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground print:p-1">No hay documentos.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            
            {/* Required Permits */}
            <div className="mt-4 print:mt-1">
                <h4 className="text-lg font-medium mb-2 text-foreground print:text-sm print:mb-1">Permisos Requeridos</h4>
                <div className="rounded-md border print:border">
                    <Table className="print:text-[8pt]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="print:p-1">Permiso</TableHead>
                                <TableHead className="print:p-1">Factura Asociada</TableHead>
                                <TableHead className="print:p-1">Estado</TableHead>
                                <TableHead className="print:p-1">Fecha Sometido</TableHead>
                                <TableHead className="print:p-1">Fecha Retiro Aprox.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {worksheet.requiredPermits?.length > 0 ? (
                                worksheet.requiredPermits.map(permit => (
                                    <TableRow key={permit.id}>
                                        <TableCell className="font-medium print:p-1">{permit.name}</TableCell>
                                        <TableCell className="print:p-1">{permit.facturaNumber || 'N/A'}</TableCell>
                                        <TableCell className="print:p-1"><Badge variant={permit.status === 'Entregado' ? 'default' : 'secondary'}>{permit.status}</Badge></TableCell>
                                        <TableCell className="print:p-1">{formatShortDate(permit.tramiteDate)}</TableCell>
                                        <TableCell className="print:p-1">{formatShortDate(permit.estimatedDeliveryDate)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground print:p-1">No hay permisos requeridos.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
          </div>
          
          {/* Operation, Joint Operation & DC */}
          <div className="grid md:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2 print:mt-1">
              <div>
                <h4 className="text-lg font-medium mb-2 text-foreground print:text-sm print:mb-1">Detalles de Operación</h4>
                <div className="space-y-3 p-4 border rounded-md print:border print:p-2 print:space-y-1">
                    <DetailItem label="Tipo de Operación" value={worksheet.operationType ? worksheet.operationType.charAt(0).toUpperCase() + worksheet.operationType.slice(1) : undefined} icon={ListChecks} />
                    {worksheet.operationType && (
                        <>
                         <DetailItem label="Modelo (Patrón)" value={worksheet.patternRegime} />
                         <DetailItem label="Sub-Régimen" value={worksheet.subRegime} />
                        </>
                    )}
                </div>
              </div>
               <div>
                <div className="space-y-3 p-4 border rounded-md print:border print:p-2 print:space-y-1">
                    <DetailItem label="Es Mancomunada" value={worksheet.isJointOperation} />
                    {worksheet.isJointOperation && (
                        <>
                          <DetailItem label="NE Mancomunado" value={worksheet.jointNe} icon={FileSymlink} />
                          <DetailItem label="Referencia Mancomunada" value={worksheet.jointReference} icon={LinkIcon} />
                        </>
                    )}
                     {worksheet.dcCorrespondiente && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground whitespace-nowrap print:text-[8pt]">DC Correspondiente:</p>
                            <p className="text-sm text-foreground print:text-[8pt]">{worksheet.dcCorrespondiente}</p>
                            <Badge variant={worksheet.isSplit ? 'destructive' : 'default'} className="print:text-xs print:px-1 print:py-0">
                                {worksheet.isSplit ? 'Split' : 'Full'}
                            </Badge>
                        </div>
                    )}
                </div>
              </div>
          </div>
          <div className="hidden print:block">
              <Image
                  src="/AconicExaminer/imagenes/FOOTERSOLICITUDETAIL.svg"
                  alt="Footer"
                  width={800}
                  height={50}
                  className="w-full h-auto mt-6"
                  priority
              />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 no-print border-t pt-4">
          <Button asChild variant="outline">
            <Link href={`/executive/worksheet?id=${worksheet.id}`}>
              <Edit className="mr-2 h-4 w-4" /> Editar
            </Link>
          </Button>
          <Button type="button" onClick={onClose} variant="outline">Cerrar</Button>
          <Button type="button" onClick={handlePrint} variant="default">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </CardFooter>
      </Card>
    </>
  );
};
