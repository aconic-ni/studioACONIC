
"use client";
import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { X, Printer } from 'lucide-react';
import type { ExamDocument } from '@/types';
import { Timestamp } from 'firebase/firestore';

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' });
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
    <div>
      <div className="flex items-center">
        {icon && <span className="mr-2 text-primary">{icon}</span>}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm text-foreground ml-6">{displayValue}</p>
    </div>
  );
};

export const EditableExamDetails: React.FC<{ exam: ExamDocument; onClose: () => void; }> = ({ exam, onClose }) => {

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Card className="mt-6 w-full max-w-5xl mx-auto custom-shadow" id="printable-area">
        <Image
            src="/AconicExaminer/imagenes/HEADERSEXA.svg"
            alt="Examen Header"
            width={800}
            height={100}
            className="w-full h-auto mb-4 hidden print:block"
            priority
        />
        <CardHeader>
            <div className="flex justify-between items-start">
                <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Vista de Documento: {exam.ne}</CardTitle>
                <button onClick={onClose} className="p-1 text-destructive hover:text-destructive/80 no-print">
                    <X className="h-6 w-6" />
                </button>
            </div>
          <CardDescription className="text-muted-foreground no-print">
            Vista de solo lectura de los detalles del examen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 bg-secondary/30 p-4 rounded-md shadow-sm text-sm">
              <DetailItem label="NE (Tracking NX1)" value={exam.ne} />
              <DetailItem label="Referencia" value={exam.reference} />
              <DetailItem label="Consignatario" value={exam.consignee} />
              <DetailItem label="Gestor del Examen" value={exam.manager} />
              <DetailItem label="Ubicación Mercancía" value={exam.location} />
              <DetailItem label="Guardado por" value={exam.savedBy} />
              <DetailItem label="Fecha Creación" value={formatTimestamp(exam.createdAt)} />
              <DetailItem label="Fecha Guardado" value={formatTimestamp(exam.savedAt)} />
              <DetailItem label="Fecha Finalización" value={formatTimestamp(exam.completedAt)} />
              <DetailItem label="Asignado a" value={exam.assignedTo} />
              <DetailItem label="Fecha Asignación" value={formatTimestamp(exam.assignedAt)} />
          </div>

          <div>
            <h4 className="text-lg font-medium mb-3 text-foreground">Productos ({exam.products?.length || 0})</h4>
            {exam.products && exam.products.length > 0 ? (
              <div className="space-y-6">
                {exam.products.map((product, index) => (
                  <div key={product.id || index} className="p-4 border border-border bg-card rounded-lg shadow print-product-container">
                    <h5 className="text-md font-semibold mb-3 text-primary">Producto {index + 1}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                        <DetailItem label="Número de Item" value={product.itemNumber} />
                        <DetailItem label="Descripción" value={product.description} />
                        <DetailItem label="Marca" value={product.brand} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No hay productos registrados en este examen.</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 no-print border-t pt-4">
            <Button type="button" onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
        </CardFooter>
        <Image
            src="/AconicExaminer/imagenes/FOOTEREXA.svg"
            alt="Examen Footer"
            width={800}
            height={50}
            className="w-full h-auto mt-6 hidden print:block"
        />
      </Card>
    </>
  );
};
