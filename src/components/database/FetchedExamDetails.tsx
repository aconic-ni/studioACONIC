
"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  X, Hash, Weight, FileText, Tag, Puzzle, Ruler, Fingerprint, Globe, Barcode,
  Package, Box, ShieldCheck, MessageSquare, ClipboardList, Download, Printer, BookText
} from 'lucide-react';
import type { ExamDocument, Product } from '@/types';
import { Timestamp } from 'firebase/firestore';
import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { downloadExcelFile } from '@/lib/fileExporter';
import { BitacoraModal } from './BitacoraModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper function to format timestamp
const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  // Firestore timestamps can be objects, so we need to convert them to JS Date objects
  const date = timestamp.toDate();
  return format(date, 'dd/MM/yy HH:mm', { locale: es });
};


// Helper component for displaying product details in the fetched exam
const FetchedDetailItem: React.FC<{ label: string; value?: string | number | null | boolean | FirestoreTimestamp; icon?: React.ReactNode }> = ({ label, value, icon }) => {
  let displayValue: string;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else if (value instanceof Timestamp) {
    displayValue = formatTimestamp(value);
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div>
      <div className="flex items-center">
        {icon && <span className="mr-2 text-primary">{icon}</span>}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm text-foreground ml-6">{displayValue}</p>
    </div>
  );
};

const getProductStatusText = (product: Product): string => {
  const statuses: string[] = [];
  if (product.isConform) statuses.push("Conforme a factura");
  if (product.isExcess) statuses.push("Excedente");
  if (product.isMissing) statuses.push("Faltante");
  if (product.isFault) statuses.push("Avería");
  if (statuses.length === 0) return "Sin estado específico";
  return statuses.join(', ');
};

// Component to display the fetched exam
export const FetchedExamDetails: React.FC<{ exam: ExamDocument; onClose: () => void }> = ({ exam, onClose }) => {
  const [isBitacoraModalOpen, setIsBitacoraModalOpen] = useState(false);

  const handleExport = () => {
    downloadExcelFile(exam);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Card className="mt-6 w-full max-w-5xl mx-auto custom-shadow" id="printable-area">
        <CardHeader>
          <Image
              src="/AconicExaminer/imagenes/HEADERSEXA.svg"
              alt="Examen Header"
              width={800}
              height={100}
              className="w-full h-auto mb-4"
              priority
          />
          <div className="relative">
              <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Detalles del Examen: {exam.ne}</CardTitle>
              <button onClick={onClose} className="absolute -top-2 -right-2 p-1 text-destructive hover:text-destructive/80 no-print">
                  <X className="h-6 w-6" />
              </button>
          </div>
          <CardDescription className="text-muted-foreground">
            Información del examen recuperada de la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 bg-secondary/30 p-4 rounded-md shadow-sm text-sm print:grid-cols-2 print:gap-x-8 print:gap-y-3">
              <FetchedDetailItem label="NE (Tracking NX1)" value={exam.ne} />
              <FetchedDetailItem label="Referencia" value={exam.reference} />
              <FetchedDetailItem label="Consignatario" value={exam.consignee} />
              <FetchedDetailItem label="Gestor del Examen" value={exam.manager} />
              <FetchedDetailItem label="Ubicación Mercancía" value={exam.location} />
              <FetchedDetailItem label="Guardado por (correo)" value={exam.savedBy} />
              <FetchedDetailItem label="Fecha y Hora de Guardado" value={exam.savedAt} />
          </div>

          <div>
            <h4 className="text-lg font-medium mb-3 text-foreground">Productos ({exam.products?.length || 0})</h4>
            {exam.products && exam.products.length > 0 ? (
              <div className="space-y-6 print:space-y-4">
                {exam.products.map((product, index) => (
                  <div key={product.id || index} className="p-4 border border-border bg-card rounded-lg shadow print-product-container print:border print:border-gray-200 print:shadow-none print:bg-white">
                    <h5 className="text-md font-semibold mb-3 text-primary print:border-b print:pb-2 print:mb-4">
                      Producto {index + 1}
                      {product.itemNumber && <span className="text-sm font-normal text-muted-foreground"> (Item: {product.itemNumber})</span>}
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-x-6 gap-y-4">
                      <FetchedDetailItem label="Número de Item" value={product.itemNumber} icon={<Hash size={16} />} />
                      <FetchedDetailItem label="Peso" value={product.weight} icon={<Weight size={16} />} />
                      <FetchedDetailItem label="Marca" value={product.brand} icon={<Tag size={16} />} />
                      <FetchedDetailItem label="Modelo" value={product.model} icon={<Puzzle size={16} />} />
                      <FetchedDetailItem label="Unidad de Medida" value={product.unitMeasure} icon={<Ruler size={16} />} />
                      <FetchedDetailItem label="Serie" value={product.serial} icon={<Fingerprint size={16} />} />
                      <FetchedDetailItem label="Origen" value={product.origin} icon={<Globe size={16} />} />
                      <FetchedDetailItem label="Numeración de Bultos" value={product.numberPackages} icon={<Barcode size={16} />} />
                      <FetchedDetailItem label="Cantidad de Bultos" value={product.quantityPackages} icon={<Package size={16} />} />
                      <FetchedDetailItem label="Cantidad de Unidades" value={product.quantityUnits} icon={<Box size={16} />} />
                      <FetchedDetailItem label="Estado de Mercancía (Condición)" value={product.packagingCondition} icon={<ShieldCheck size={16} />} />
                      
                      <div className="md:col-span-2 lg:col-span-3 print:col-span-2">
                        <FetchedDetailItem label="Descripción" value={product.description} icon={<FileText size={16} />} />
                      </div>
                       <div className="md:col-span-2 lg:col-span-3 print:col-span-2">
                        <FetchedDetailItem label="Observación" value={product.observation} icon={<MessageSquare size={16} />} />
                      </div>
                      <div className="md:col-span-full pt-2 mt-2 border-t border-border print:col-span-2">
                         <FetchedDetailItem label="Estado General del Producto" value={getProductStatusText(product)} icon={<ClipboardList size={16} />} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No hay productos registrados en este examen.</p>
            )}
          </div>
          <Image
              src="/AconicExaminer/imagenes/FOOTEREXA.svg"
              alt="Examen Footer"
              width={800}
              height={50}
              className="w-full h-auto mt-6"
          />
        </CardContent>
        <CardFooter className="justify-end gap-2 no-print border-t pt-4">
            <Button type="button" onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button type="button" onClick={() => setIsBitacoraModalOpen(true)} variant="outline">
              <BookText className="mr-2 h-4 w-4" /> Bitácora
            </Button>
            <Button type="button" onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
        </CardFooter>
      </Card>
      {exam.id && (
        <BitacoraModal
            isOpen={isBitacoraModalOpen}
            onClose={() => setIsBitacoraModalOpen(false)}
            examId={exam.id}
        />
      )}
    </>
  );
};
