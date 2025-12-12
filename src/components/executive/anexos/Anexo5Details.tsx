
"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { X, Printer, Edit } from 'lucide-react';
import type { Worksheet, AppUser } from '@/types';
import { Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format as formatDateFns } from 'date-fns';
import { es } from 'date-fns/locale';
import { aduanas, aduanaToShortCode } from '@/lib/formData';
import { WorksheetDetails } from '../WorksheetDetails';
import { cn } from "@/lib/utils";
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Anexo7Details } from './Anexo7Details';

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

const DetailItem: React.FC<{ label: string; value?: string | number | null; className?: string }> = ({ label, value, className }) => (
    <div className={cn("border-b border-black flex justify-between items-baseline py-1 print:py-0.5", className)}>
        <span className="text-xs font-semibold text-gray-700 print:text-[8pt]">{label}</span>
        <p className="text-xs font-medium text-gray-800 print:text-[9pt]">{value || ''}</p>
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
  align?: 'left' | 'center' | 'right';
  showSignatureLine?: boolean;
}> = ({ title, subtitle, className, children, align = 'left', showSignatureLine = true }) => {
  const textAlignClass = `text-${align}`;
  return (
    <div className={cn("flex flex-col", className)}>
      {showSignatureLine && <div className="flex-grow border-b-2 border-black print:h-6 mb-1 h-[50px]"></div>}
      <div className={cn("text-xs print:text-[8pt]", textAlignClass)}>
          <p className="font-semibold">{title}</p>
          {subtitle && <p className="text-gray-600 print:text-[7pt]">{subtitle}</p>}
          <div className="min-h-[30px] print:min-h-[20px] text-black font-semibold">
           {children}
          </div>
      </div>
    </div>
  );
};


export const Anexo5Details: React.FC<{ worksheet: Worksheet; onClose: () => void; }> = ({ worksheet, onClose }) => {
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
  
  const productHeaders = ["CANTIDAD", "ORIGEN", "UM", "SAC", "PESO", "DESCRIPCION", "LINEA AEREA", "N° DE GUIA AEREA", "BULTO", "TOTAL"];
  
  const cantidadTotal = Number(worksheet.cantidadTotal) || (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).cantidad) || 0), 0);
  const pesoTotal = Number(worksheet.grossWeight) || (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).peso) || 0), 0);
  const bultosTotales = Number(worksheet.packageNumber) || (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).bulto) || 0), 0);
  const valorTotal = (worksheet.documents || []).reduce((sum, doc) => sum + (Number((doc as any).total) || 0), 0);
  const valorAduanero = (worksheet.valor || 0) + (worksheet.flete || 0) + (worksheet.seguro || 0) + (worksheet.otrosGastos || 0);

  const headerImageSrc = "/AconicExaminer/imagenes/HEADERANEX5DETAIL.svg";

  if (worksheet.worksheetType === 'anexo_7') {
    return <Anexo7Details worksheet={worksheet} onClose={onClose} />;
  }

  if (worksheet.worksheetType === 'hoja_de_trabajo' || !worksheet.worksheetType) {
    return <WorksheetDetails worksheet={worksheet} onClose={onClose} />;
  }

  const MIN_ROWS = 9;
  const productRows = worksheet.documents && worksheet.documents.length > 0 ? worksheet.documents : [];
  const emptyRowsCount = Math.max(0, MIN_ROWS - productRows.length);
  const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => ({ id: `empty-${i}` }));

  return (
    <Card className="w-full max-w-5xl mx-auto shadow-none border-none card-print-styles" id="printable-area">
      <div className="p-4 print:p-2 bg-white">
          <div className="hidden print:block">
              <Image
                  src={headerImageSrc}
                  alt="Anexo Header"
                  width={800}
                  height={100}
                  className="w-full h-auto mb-2 print:mb-1"
                  priority
              />
          </div>
          
          <div className="grid grid-cols-2 gap-x-8 mb-2 print:mb-1">
            <div className="space-y-1">
              <DetailItem label="Fecha" value={formatShortDate(new Date())} />
              <DetailItem label="Empresa que solicita" value={worksheet.consignee} />
              <DetailItem label="RUC" value={worksheet.ruc} />
            </div>
            <div className="space-y-1">
              <DetailItem label="RESA No" value={worksheet.resa} />
              <DetailItem label="Factura No" value={worksheet.facturaNumber} />
              <DetailItem label="Delegación de Aduana Destino" value={getAduanaLabel(worksheet.dispatchCustoms)} />
              <DetailItem label="Código de Aduana" value={worksheet.dispatchCustoms} />
            </div>
          </div>
          
          <div className="border-2 border-black">
              <h3 className="text-center text-sm font-bold border-b-2 border-black py-1 print:text-xs">Descripción de las mercancías</h3>
              <table className="w-full border-collapse">
                  <thead>
                      <tr className="border-b-2 border-black">
                          {productHeaders.map(header => <th key={header} className="print:p-0.5 print:text-[8pt] text-center border-r last:border-r-0 border-black h-auto font-bold">{header}</th>)}
                      </tr>
                  </thead>
                  <tbody>
                      {productRows.map((doc, index) => (
                          <tr key={doc.id || index} className="border-b border-gray-400 h-6 print:h-5">
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.cantidad ? Number(doc.cantidad).toLocaleString('es-NI') : ''}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{String((doc as any).origen || '')}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{String((doc as any).um || '')}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{String((doc as any).sac || '')}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.peso ? Number(doc.peso).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-left border-r border-black">{doc.descripcion}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.linea || ''}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.guia || ''}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-center border-r border-black">{doc.bulto ? Number(doc.bulto).toLocaleString('es-NI') : ''}</td>
                              <td className="print:p-0.5 print:text-[8pt] text-right">{doc.total ? Number(doc.total).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                          </tr>
                      ))}
                      {emptyRows.map((row) => (
                          <tr key={row.id} className="border-b border-gray-400 h-6 print:h-5">
                              <td className="border-r border-black">&nbsp;</td>
                              <td className="border-r border-black"></td>
                              <td className="border-r border-black"></td>
                              <td className="border-r border-black"></td>
                              <td className="border-r border-black"></td>
                              <td className="border-r border-black"></td>
                              <td></td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot>
                      <tr className="border-t-2 border-black font-bold text-xs print:text-[9pt] h-6 print:h-5">
                          <td className="p-1 print:p-0.5 text-left pr-2" colSpan={4}>TOTAL: {cantidadTotal > 0 ? cantidadTotal.toLocaleString('es-NI') : ''} {worksheet.unidadMedidaTotal}</td>
                          <td className="p-1 print:p-0.5 text-center">{pesoTotal > 0 ? pesoTotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                          <td className="p-1 print:p-0.5 text-right" colSpan={3}>TOTALES:</td>
                          <td className="p-1 print:p-0.5 text-center border-l border-black">{bultosTotales > 0 ? bultosTotales.toLocaleString('es-NI') : ''}</td>
                          <td className="p-1 print:p-0.5 text-right border-l border-black">{valorTotal > 0 ? valorTotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
          
           <div className="grid grid-cols-3 gap-x-4 mt-2 print:mt-1">
              <div className="w-full text-xs p-2 print:text-[8pt] print:p-1 col-span-1">
                  <table className="w-full border-collapse print:text-[9pt]">
                      <thead><tr><th colSpan={2} className="border border-black text-center text-xs p-1 print:text-[8pt] font-bold">Conformación de Valor</th></tr></thead>
                      <tbody>
                          {['Valor $', 'Flete $', 'Seguro $', 'O. Gasto $', 'V. Aduana $'].map(label => {
                              let value = '';
                              if (label === 'Valor $') value = worksheet.valor ? `$${Number(worksheet.valor).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
                              if (label === 'Flete $') value = worksheet.flete ? `$${Number(worksheet.flete).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
                              if (label === 'Seguro $') value = worksheet.seguro ? `$${Number(worksheet.seguro).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
                              if (label === 'O. Gasto $') value = worksheet.otrosGastos ? `$${Number(worksheet.otrosGastos).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
                              if (label === 'V. Aduana $') value = `$${valorAduanero.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
              <div className="p-2 print:p-1 col-span-1">
                  <p className="text-xs font-semibold text-gray-500 print:text-[8pt]">NOTA:</p>
                  <p className="text-sm print:text-xs whitespace-pre-wrap min-h-[42px]">{worksheet.observations}</p>
              </div>
              <div className="space-y-1 p-2 print:p-1 col-span-1">
                  <DetailItem label="Bultos Totales" value={bultosTotales > 0 ? bultosTotales.toLocaleString('es-NI') : ''} />
                  <DetailItem label="Peso Total" value={pesoTotal > 0 ? pesoTotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} />
                  <DetailItem label="Precinto" value={worksheet.precinto || ''} />
                  <DetailItem label="Precinto Lateral" value={worksheet.precintoLateral || ''} />
                  <div className="h-[25px]"></div>
                  <div className="border-b-2 border-black"></div>
                  <p className="text-xs font-semibold text-center pt-1">Firma Inspector ACCA</p>
              </div>
          </div>
          
          <div className="grid grid-cols-2 gap-x-8 mt-1 print:mt-1">
              <div className="border border-black mt-1 print:mt-1">
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
              <div className="mt-1 print:mt-1 p-2 flex flex-col justify-between">
                  <p className="text-center font-bold text-sm">TRAMITANTE</p>
                  {agente && (
                      <div className="text-center text-black font-semibold text-xs">
                          <p>{agente.displayName || 'N/A'}</p>
                          <p>Licencia: {agente.agentLicense || 'N/A'}</p>
                          <p>Cédula: {agente.cedula || 'N/A'}</p>
                          <p>AGENCIA ADUANERA ACONIC</p>
                      </div>
                  )}
                  <div className="space-y-4">
                      <div className="flex-grow border-b-2 border-black print:h-6 mb-1 h-[50px]"></div>
                      <p className="text-xs font-semibold text-gray-700 print:text-[8pt] text-center">Firma y Sello</p>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 mt-2 print:mt-1">
                <div className="space-y-4">
                    <SignatureSection title="ADUANA CENTRAL DE CARGA AEREA" subtitle="Firma y Sello" align="left" className="w-full" />
                    <SignatureSection title="ADUANA DESTINO" subtitle="Firma y Sello" align="left" className="w-full" />
                </div>
                <div className="border border-black p-2 flex flex-col justify-between">
                    <p className="text-center font-bold text-sm">TRANSITO</p>
                    <div className="flex-grow flex flex-col justify-end">
                        <div className="h-[50px]"></div>
                        <div className="border-b-2 border-black"></div>
                        <p className="text-xs font-semibold text-center pt-1">Firma y Sello</p>
                        <DetailItem label="HORA DE SALIDA" value="" />
                        <DetailItem label="HORA DE LLEGADA" value="" />
                    </div>
                </div>
            </div>
          
      </div>
      <CardFooter className="justify-end gap-2 no-print border-t pt-4 mt-4">
          <Button asChild variant="outline">
          <Link href={`/executive/anexos?type=${worksheet.worksheetType}&id=${worksheet.id}`}>
              <Edit className="mr-2 h-4 w-4" /> Editar
          </Link>
          </Button>
          <Button type="button" onClick={onClose} variant="outline">
          Cerrar
          </Button>
          <Button type="button" onClick={handlePrint} variant="default">
          <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
      </CardFooter>
    </Card>
  );
};
