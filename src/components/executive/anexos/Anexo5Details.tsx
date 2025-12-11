
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
import { aduanas } from '@/lib/formData';
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

const TransportDetailItem: React.FC<{ label: string; value?: string | number | null; className?: string }> = ({ label, value, className }) => (
    <div className={cn("flex justify-between items-baseline border-b border-gray-300 py-1 print:py-0", className)}>
        <span className="text-xs font-semibold text-gray-500 print:text-[8pt]">{label}</span>
        <p className="text-xs font-medium text-gray-800 print:text-[9pt]">{value || ''}</p>
    </div>
);


const SignatureSection: React.FC<{ title: string; subtitle?: string; className?: string, children?: React.ReactNode }> = ({ title, subtitle, className, children }) => (
  <div className={className}>
     <div className="text-center text-xs text-gray-600 print:text-[7pt] mb-1">
        {children}
    </div>
    <div className="h-8 border-b border-gray-400 print:h-6"></div>
    <p className="text-center text-xs font-semibold mt-1 print:text-[8pt]">{title}</p>
    {subtitle && <p className="text-center text-xs text-gray-600 print:text-[7pt]">{subtitle}</p>}
  </div>
);

export const Anexo5Details: React.FC<{ worksheet: Worksheet; onClose: () => void; }> = ({ worksheet, onClose }) => {
  const [agentesAduaneros, setAgentesAduaneros] = useState<AppUser[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
        const q = query(collection(db, 'users'), where('roleTitle', '==', 'agente aduanero'));
        const querySnapshot = await getDocs(q);
        const agents = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
        setAgentesAduaneros(agents);
    };
    fetchAgents();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getTransportDocTypeLabel = (type?: string | null) => {
    switch (type) {
      case 'guia_aerea': return 'Guía Aérea';
      case 'bl': return 'BL';
      case 'carta_porte': return 'Carta de Porte';
      default: return 'N/A';
    }
  };

  const productHeaders = ["CANTIDAD", "ORIGEN", "UM", "SAC", "PESO", "DESCRIPCION"];
  if (worksheet.worksheetType !== 'anexo_7') {
      productHeaders.push("LINEA AEREA", "N° DE GUIA AEREA");
  }
  productHeaders.push("BULTO", "TOTAL");


  if (worksheet.worksheetType === 'hoja_de_trabajo' || !worksheet.worksheetType) {
    return <WorksheetDetails worksheet={worksheet} onClose={onClose} />;
  }

  const totalSum = React.useMemo(() => {
    return (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).total) || 0), 0);
  }, [worksheet.documents]);

  const selectedAgent = agentesAduaneros.find(agent => agent.displayName === worksheet.aforador);
  
  const valorAduanero = (worksheet.valor || 0) + (worksheet.flete || 0) + (worksheet.seguro || 0) + (worksheet.otrosGastos || 0);

  const headerImageSrc = worksheet.worksheetType === 'anexo_7' 
    ? "/AconicExaminer/imagenes/HEADERANEX7DETAIL.svg" 
    : "/AconicExaminer/imagenes/HEADERANEX5DETAIL.svg";

  const signatureText = worksheet.worksheetType === 'anexo_7' 
    ? "CONTROL DE RECINTO ADUANERO"
    : "ADUANA CENTRAL CARGA AEREA";

  return (
    <Card className="w-full max-w-5xl mx-auto custom-shadow card-print-styles" id="printable-area">
      <div className="p-4 print:p-2">
         <div className="hidden print:block">
            <Image
                src={headerImageSrc}
                alt="Anexo Header"
                width={800}
                height={100}
                className="w-full h-auto mb-4 print:mb-2"
                priority
            />
        </div>
        
        <div className="grid grid-cols-2 gap-x-8 mb-4 print:mb-2">
          <div className="space-y-2 print:space-y-1">
            <DetailItem label="Fecha" value={formatShortDate(new Date())} />
            <DetailItem label="Empresa que solicita" value={worksheet.consignee} />
            <DetailItem label="RUC" value={worksheet.ruc} />
          </div>
          <div className="space-y-2 print:space-y-1">
            <DetailItem label="RESA No" value={worksheet.resa} />
            <DetailItem label="Factura No" value={worksheet.facturaNumber} />
            {worksheet.worksheetType === 'anexo_7' && worksheet.transportDocumentNumber && (
              <DetailItem label="Documento de Transporte" value={worksheet.transportDocumentNumber} />
            )}
            <DetailItem label="Delegación de Aduana Destino" value={getAduanaLabel(worksheet.dispatchCustoms)} />
            <DetailItem label="Código de Aduana" value={worksheet.dispatchCustoms} />
          </div>
        </div>
        
        <div className="mb-2 print:mb-1">
            <h3 className="text-center text-sm font-semibold border-y border-black py-1 print:text-xs">Descripción de las mercancías</h3>
        </div>

        <div className="overflow-x-auto table-container rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        {productHeaders.map(header => <TableHead key={header} className="print:p-1 print:text-[8pt]">{header}</TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {worksheet.documents && worksheet.documents.length > 0 ? (
                        worksheet.documents.map(doc => (
                            <TableRow key={doc.id}>
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.cantidad || ''}</TableCell>
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.origen || ''}</TableCell>
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.um || ''}</TableCell>
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.sac || ''}</TableCell>
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.peso || ''}</TableCell>
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.descripcion}</TableCell>
                                {worksheet.worksheetType !== 'anexo_7' && <TableCell className="print:p-1 print:text-[8pt]">{doc.linea || ''}</TableCell>}
                                {worksheet.worksheetType !== 'anexo_7' && <TableCell className="print:p-1 print:text-[8pt]">{doc.guia || ''}</TableCell>}
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.bulto || ''}</TableCell>
                                <TableCell className="print:p-1 print:text-[8pt]">{doc.total ? (doc.total as number).toFixed(2) : ''}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={productHeaders.length} className="h-24 text-center">
                                No hay productos en este anexo.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        <div className="grid grid-cols-2 gap-x-8 mt-2 print:mt-1">
            {/* Left Column */}
            <div className="flex flex-col justify-between">
                <div className="w-full text-xs border border-gray-400 rounded-md p-2 print:text-[8pt] print:p-1 mb-2 print:mb-1">
                    <div className="flex justify-between items-baseline font-bold">
                        <span className="text-xs print:text-[8pt]">TOTALES:</span>
                        <p className="text-xs font-medium print:text-[9pt]">{worksheet.cantidadTotal || ''} {worksheet.unidadMedidaTotal || ''}</p>
                    </div>
                </div>
                <div className="border rounded-md p-2 mt-2 print:p-1 print:mt-1 flex-grow">
                    <p className="text-xs font-semibold text-gray-500 print:text-[8pt]">NOTA:</p>
                    <p className="text-sm print:text-xs min-h-[42px]">{worksheet.observations}</p>
                </div>
                 <div className="space-y-1 mt-2 border border-gray-400 rounded-md p-2 print:text-[8pt] print:p-1">
                    <h4 className="text-sm font-semibold text-center mb-1 print:text-xs print:mb-0">Conformación de Valor</h4>
                    <TransportDetailItem label="Valor $" value={worksheet.valor ? `$${worksheet.valor.toFixed(2)}` : ''} />
                    <TransportDetailItem label="Flete $" value={worksheet.flete ? `$${worksheet.flete.toFixed(2)}` : ''} />
                    <TransportDetailItem label="Seguro $" value={worksheet.seguro ? `$${worksheet.seguro.toFixed(2)}` : ''} />
                    <TransportDetailItem label="O. Gastó $" value={worksheet.otrosGastos ? `$${worksheet.otrosGastos.toFixed(2)}` : ''} />
                    <TransportDetailItem label="V. Aduana" value={`$${valorAduanero.toFixed(2)}`} className="font-bold border-t-2 border-black mt-1 pt-1" />
                </div>
            </div>
            {/* Right Column */}
            <div className="flex flex-col justify-between">
                <div className="w-full text-xs border border-gray-400 rounded-md p-2 print:text-[8pt] print:p-1">
                    <TransportDetailItem label="Valor Total (USD)" value={`$${totalSum.toFixed(2)}`} className="font-bold" />
                    <TransportDetailItem label="Bultos Totales" value={worksheet.packageNumber} />
                    <TransportDetailItem label="Peso Total" value={worksheet.grossWeight} />
                    <TransportDetailItem label="Precinto" value={worksheet.precinto} />
                    {worksheet.precintoLateral && (
                      <TransportDetailItem label="Precinto Lateral Fijo" value={worksheet.precintoLateral} />
                    )}
                </div>
                {worksheet.worksheetType === 'anexo_5' && (
                    <SignatureSection title="Firma Inspector ACCA" className="mt-2 print:mt-1">
                    </SignatureSection>
                )}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 mt-2 print:mt-1">
            <div>
                <h4 className="text-sm font-semibold print:text-xs">DATOS DE TRANSPORTE:</h4>
                 <div className="space-y-1 mt-1 border p-2 rounded-md print:border-none print:p-0">
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
                </div>
            </div>
             <div className="space-y-2 print:space-y-1">
                <div className="w-full text-xs mt-1 border border-gray-400 rounded-md p-2 print:text-[8pt] print:p-1">
                    <h4 className="text-sm font-semibold text-center mb-2 print:text-xs print:mb-1">TRAMITANTE</h4>
                    <SignatureSection title="Firma y Sello">
                        {worksheet.aforador && worksheet.aforador !== '-' && selectedAgent ? (
                            <>
                                <p className="font-semibold text-black">{selectedAgent.displayName || 'N/A'}</p>
                                <p>Licencia: {selectedAgent.agentLicense || 'N/A'}</p>
                                <p>Cédula: {selectedAgent.cedula || 'N/A'}</p>
                            </>
                        ) : (
                           <p className="font-semibold text-black">{worksheet.aforador || 'N/A'}</p>
                        )}
                        <p className="font-semibold text-black">AGENCIA ADUANERA ACONIC</p>
                    </SignatureSection>
                </div>
                 <div className="w-full text-xs mt-1 border border-gray-400 rounded-md p-2 print:text-[8pt] print:p-1">
                    <h4 className="text-sm font-semibold text-center mb-2 print:text-xs print:mb-1">TRÁNSITO</h4>
                    <SignatureSection title="Firma y Sello" />
                    <TransportDetailItem label="Hora de Salida" value="" />
                    <TransportDetailItem label="Hora de Llegada" value="" />
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 mt-2 print:mt-1">
            <SignatureSection title={signatureText} className="h-8 print:h-6"/>
            <SignatureSection title="Aduana de Destino" className="h-8 print:h-6"/>
        </div>

      </div>
       <CardFooter className="justify-end gap-2 no-print border-t pt-4">
          <Button asChild variant="outline">
            <Link href={`/executive/anexos?type=${worksheet.worksheetType}&id=${worksheet.id}`}>
              <Edit className="mr-2 h-4 w-4" /> Editar
            </Link>
          </Button>
          <Button type="button" onClick={onClose} variant="outline">Cerrar</Button>
          <Button type="button" onClick={handlePrint} variant="default">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
      </CardFooter>
    </Card>
  );
};
