"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { X, Printer, FileText, User, Building, Weight, Truck, MapPin, Anchor, Plane, Globe, Package, ListChecks, FileSymlink, Link as LinkIcon, Eye, Shield, FileBadge, FileKey, Edit } from 'lucide-react';
import type { Worksheet, AppUser } from '@/types';
import { Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { format as formatDateFns } from 'date-fns';
import { es } from 'date-fns/locale';
import { aduanas, aduanaToShortCode } from '@/lib/formData';
import { WorksheetDetails } from '../WorksheetDetails';
import { cn } from "@/lib/utils";
import { db } from '@/lib/firebase';
import Link from 'next/link';

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return formatDateFns(date, 'dd/MM/yy HH:mm', { locale: es });
};

const formatShortDate = (timestamp: Timestamp | Date | null | undefined): string => {
  if (!timestamp) return '';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return formatDateFns(date, 'dd/MM/yyyy');
};


const getAduanaLabel = (code: string | undefined) => {
    if (!code) return 'N/A';
    const aduana = aduanas.find(a => a.value === code);
    return aduana ? aduana.label.substring(5) : code;
};

const DetailRow: React.FC<{ label: string; value?: string | number | null; }> = ({ label, value }) => (
    <div className="flex justify-between items-baseline py-1 print:py-0.5 border-b border-solid border-black">
        <span className="text-xs font-medium text-gray-700 print:text-[8pt] whitespace-nowrap mr-2">{label}</span>
        <p className="text-sm text-foreground font-semibold ml-auto print:text-[9pt]">{value || ''}</p>
    </div>
);


const TransportDetailItem: React.FC<{ label: string; value?: string | number | null; className?: string }> = ({ label, value, className }) => (
    <tr className={cn("border-b border-black last:border-b-0", className)}>
        <td className="text-xs font-semibold text-gray-700 print:text-[8pt] p-1 w-2/5 border-r border-black">{label}</td>
        <td className="text-xs font-medium text-gray-800 print:text-[9pt] p-1">{value || ''}</td>
    </tr>
);

const SignatureSection: React.FC<{
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
  align?: 'left' | 'center';
}> = ({ title, subtitle, className, children, align = 'left' }) => (
  <div className={cn("flex flex-col h-full", className)}>
    <div className="h-8 border-b-2 border-black print:h-6 mb-1"></div>
    <div className={cn("text-xs print:text-[8pt]", align === 'center' ? 'text-center' : 'text-left')}>
        <p className="font-semibold">Firma y Sello</p>
        <p className="font-bold text-black">{title}</p>
        {subtitle && <p className="text-gray-600 print:text-[7pt]">{subtitle}</p>}
        <div className="min-h-[30px] print:min-h-[20px] text-black font-semibold">
         {children}
        </div>
    </div>
  </div>
);


export const Anexo7Details: React.FC<{ worksheet: Worksheet; onClose: () => void; }> = ({ worksheet, onClose }) => {
  const [agente, setAgente] = useState<AppUser | null>(null);

  useEffect(() => {
    const fetchAgent = async () => {
        if (worksheet.aforador && worksheet.aforador !== '-') {
            const q = query(collection(db, 'users'), where('displayName', '==', worksheet.aforador));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const agentData = querySnapshot.docs[0].data() as AppUser;
                setAgente(agentData);
            }
        }
    };
    fetchAgent();
  }, [worksheet.aforador]);

  const handlePrint = () => {
    window.print();
  };
  
  const productHeaders = ["CANTIDAD", "ORIGEN", "UM", "SAC", "PESO", "DESCRIPCIÓN", "BULTOS", "VALOR"];
  
  const cantidadTotal = Number(worksheet.cantidadTotal) || (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).cantidad) || 0), 0);
  const pesoTotal = Number(worksheet.grossWeight) || (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).peso) || 0), 0);
  const bultosTotales = Number(worksheet.packageNumber) || (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).bulto) || 0), 0);
  const valorTotal = (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).total) || 0), 0);
  const valorAduanero = (worksheet.valor || 0) + (worksheet.flete || 0) + (worksheet.seguro || 0) + (worksheet.otrosGastos || 0);

  const headerImageSrc = "/AconicExaminer/imagenes/HEADERANEX7DETAIL.svg";

  return (
    <Card className="w-full max-w-5xl mx-auto shadow-none border-none card-print-styles" id="printable-area">
      <div className="p-4 print:p-2 bg-white">
         <div className="hidden print:block">
            <Image
                src={headerImageSrc}
                alt="Anexo 7 Header"
                width={800}
                height={100}
                className="w-full h-auto mb-2 print:mb-1"
                priority
            />
        </div>
        
        <div className="grid grid-cols-2 gap-x-8 mb-2 print:mb-1">
             <div className="space-y-1">
                <DetailRow label="Fecha" value={formatShortDate(new Date())} />
                <DetailRow label="Empresa que solicita" value={worksheet.consignee} />
                <DetailRow label="RUC" value={worksheet.ruc} />
                <DetailRow label="Almacén de Salida" value={worksheet.almacenSalida} />
                <DetailRow label="Código de Almacén" value={worksheet.codigoAlmacen} />
            </div>
            <div className="space-y-1">
                <DetailRow label="RESA No" value={worksheet.resa} />
                <DetailRow label="Factura No" value={worksheet.facturaNumber} />
                <DetailRow label="Documento de Transporte" value={worksheet.transportDocumentNumber} />
                <DetailRow label="Delegación de Aduana Destino" value={getAduanaLabel(worksheet.dispatchCustoms)} />
                <DetailRow label="Código de Aduana" value={worksheet.dispatchCustoms} />
            </div>
        </div>
        
        <div className="border-2 border-black">
            <h3 className="text-center text-sm font-bold border-b-2 border-black py-1 print:text-xs">DESCRIPCIÓN DE MERCANCÍAS</h3>
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b-2 border-black">
                        {productHeaders.map(header => <th key={header} className="print:p-0.5 print:text-[8pt] text-center border-r last:border-r-0 border-black h-auto font-bold">{header}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {(worksheet.documents && worksheet.documents.length > 0) ? (
                        worksheet.documents.map((doc, index) => (
                        <tr key={doc.id || index} className="border-b border-gray-400 h-6 print:h-5">
                            <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.cantidad ? Number(doc.cantidad).toLocaleString('es-NI') : ''}</td>
                            <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{String((doc as any).origen || '')}</td>
                            <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{String((doc as any).um || '')}</td>
                            <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{String((doc as any).sac || '')}</td>
                            <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.peso ? Number(doc.peso).toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}</td>
                            <td className="print:p-0.5 print:text-[8pt] text-left border-r border-black">{doc.descripcion}</td>
                            <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.bulto ? Number(doc.bulto).toLocaleString('es-NI') : ''}</td>
                            <td className="print:p-0.5 print:text-[8pt] text-right">{doc.total ? Number(doc.total).toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}</td>
                        </tr>
                    ))) : (
                         <tr className="h-20"><td colSpan={productHeaders.length}></td></tr>
                    )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black font-bold text-xs print:text-[9pt] h-6 print:h-5">
                      <td className="p-1 print:p-0.5 text-left pr-2" colSpan={3}>CANTIDAD TOTAL: {cantidadTotal > 0 ? cantidadTotal.toLocaleString('es-NI') : ''} {worksheet.unidadMedidaTotal}</td>
                      <td className="p-1 print:p-0.5 text-right pr-2">PESO TOTAL:</td>
                      <td className="p-1 print:p-0.5 text-center">{pesoTotal > 0 ? pesoTotal.toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}</td>
                      <td className="p-1 print:p-0.5 text-right">TOTALES:</td>
                      <td className="p-1 print:p-0.5 text-center border-l border-black">{bultosTotales > 0 ? bultosTotales.toLocaleString('es-NI') : ''}</td>
                      <td className="p-1 print:p-0.5 text-right border-l border-black">{valorTotal > 0 ? valorTotal.toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}</td>
                  </tr>
                </tfoot>
            </table>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 mt-2 print:mt-1">
            {/* Left Column */}
            <div className="flex flex-col">
                <div className="grid grid-cols-[auto_1fr] gap-x-2">
                    <div className="w-full text-xs p-2 print:text-[8pt] print:p-1 mb-2 print:mb-1">
                     <table className="w-full border-collapse print:text-[9pt]">
                        <thead><tr><th colSpan={2} className="border border-black text-center text-xs p-1 print:text-[8pt] font-bold">Conformación de Valor</th></tr></thead>
                        <tbody>
                            {['Valor $', 'Flete $', 'Seguro $', 'O. Gasto $', 'V. Aduana $'].map(label => {
                                let value = '';
                                if (label === 'Valor $') value = worksheet.valor ? `$${Number(worksheet.valor).toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '';
                                if (label === 'Flete $') value = worksheet.flete ? `$${Number(worksheet.flete).toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '';
                                if (label === 'Seguro $') value = worksheet.seguro ? `$${Number(worksheet.seguro).toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '';
                                if (label === 'O. Gasto $') value = worksheet.otrosGastos ? `$${Number(worksheet.otrosGastos).toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '';
                                if (label === 'V. Aduana $') value = `$${valorAduanero.toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                                return (
                                    <tr key={label}>
                                        <td className={cn("border border-black p-1 w-[50%] print:p-0.5", label === 'V. Aduana $' ? 'border-t-2' : '')}>{label}</td>
                                        <td className={`border border-black p-1 w-auto font-semibold text-right ${label === 'V. Aduana $' ? 'border-t-2' : ''}`}>{value}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                    <div />
                </div>
                 <div className="border border-black mt-2 print:mt-1">
                     <h4 className="text-sm font-semibold print:text-xs mb-1 border-b border-black p-1 text-center">DATOS DE TRANSPORTE:</h4>
                     <table className="w-full border-collapse">
                        <tbody>
                            <TransportDetailItem label="CODIGO DE ADUANERO" value={worksheet.codigoAduanero} />
                            <TransportDetailItem label="Marca" value={worksheet.marcaVehiculo} />
                            <TransportDetailItem label="Placa" value={worksheet.placaVehiculo} />
                            <TransportDetailItem label="Motor" value={worksheet.motorVehiculo} />
                            <TransportDetailItem label="Chasis" value={worksheet.chasisVehiculo} />
                            <TransportDetailItem label="VIN" value={worksheet.vin} />
                            <TransportDetailItem label="Nombre Conductor" value={worksheet.nombreConductor} />
                            <TransportDetailItem label="Licencia" value={worksheet.licenciaConductor} />
                            <TransportDetailItem label="Cedula" value={worksheet.cedulaConductor} />
                            <TransportDetailItem label="Tipo de medio" value={worksheet.tipoMedio} />
                            <TransportDetailItem label="Peso Vacío" value={worksheet.pesoVacioVehiculo} />
                        </tbody>
                     </table>
                </div>
                 <div className="h-5 print:h-5 bg-white"></div>
            </div>
            {/* Right Column */}
            <div className="flex flex-col">
                <div className="border border-black rounded-md p-2 print:p-1">
                    <p className="text-xs font-semibold text-gray-500 print:text-[8pt]">NOTA:</p>
                    <p className="text-sm print:text-xs whitespace-pre-wrap">{worksheet.observations}</p>
                </div>
                 <div className="flex-grow"></div>
                 <div className="space-y-1 mt-2 print:mt-1">
                   <DetailRow label="Bultos Totales" value={bultosTotales > 0 ? bultosTotales.toLocaleString('es-NI') : ''} />
                   <DetailRow label="Peso Total" value={pesoTotal > 0 ? pesoTotal.toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''} />
                   <DetailRow label="Precinto" value={worksheet.precinto || ''} />
                </div>
                 <div className="h-8 print:h-8 bg-white"></div>
                 <div className="space-y-1 mt-2 print:mt-1">
                    <DetailRow label="Hora de Salida" />
                    <DetailRow label="Hora de Llegada" />
                </div>
                 <div className="h-5 print:h-5 bg-white"></div>
            </div>
        </div>
        
        <div className="mt-4 print:mt-2 grid grid-cols-2 gap-x-8">
            <div className="h-32 print:h-28">
                 <SignatureSection title="CONTROL DE RECINTO ADUANERO" subtitle="Aduana Managua" align="left"/>
            </div>
             <div className="h-32 print:h-28">
                <SignatureSection title="ALMACEN DE DEPOSITO" align="center"/>
            </div>
             <div className="h-32 print:h-28">
                <SignatureSection title="Aduana de Destino." subtitle="En original y 3 Copias." align="left" />
            </div>
            <div className="h-32 print:h-28">
                <SignatureSection title="TRAMITANTE" align="center">
                     {agente && (
                        <div className="text-black font-semibold">
                            <p>{agente.displayName || 'N/A'}</p>
                            <p>Licencia: {agente.agentLicense || 'N/A'}</p>
                            <p>Cédula: {agente.cedula || 'N/A'}</p>
                            <p>AGENCIA ADUANERA ACONIC</p>
                        </div>
                    )}
                 </SignatureSection>
            </div>
        </div>

      </div>
       <CardFooter className="justify-end gap-2 no-print border-t pt-4 mt-4">
          <Button asChild variant="outline">
            <Link href={`/executive/anexos?type=${worksheet.worksheetType}&id=${worksheet.id}`}><Edit className="mr-2 h-4 w-4" /> Editar</Link>
          </Button>
          <Button type="button" onClick={onClose} variant="outline">Cerrar</Button>
          <Button type="button" onClick={handlePrint} variant="default"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
      </CardFooter>
    </Card>
  );
};
