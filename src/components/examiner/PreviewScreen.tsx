
"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { downloadTxtFile, downloadExcelFile } from '@/lib/fileExporter';
import type { Product } from '@/types';
import {
  Download,
  Check,
  ArrowLeft,
  Hash,
  Weight,
  FileText,
  Tag,
  Puzzle,
  Ruler,
  Fingerprint,
  Globe,
  Barcode,
  Package,
  Box,
  ShieldCheck,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import type React from 'react';

// Helper component for displaying product details
const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; icon?: React.ReactNode }> = ({ label, value, icon }) => {
  let displayValue: string;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div>
      <div className="flex items-center">
        {icon && <span className="mr-2 text-primary">{icon}</span>}
        <p className="text-xs font-medium text-gray-500">{label}</p>
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

export function PreviewScreen() {
  const { examData, products, setCurrentStep } = useAppContext();

  if (!examData) {
    return <div className="text-center p-10">Error: No se encontraron datos del examen.</div>;
  }

  const handleConfirm = () => {
    setCurrentStep(ExamStep.SUCCESS);
  };

  const handleDownloadExcel = () => {
    if (examData) {
      // When downloading from preview, we don't have savedAt or savedBy yet
      downloadExcelFile({ ...examData, products });
    }
  };
  
  const handleDownloadTxt = () => {
     if (examData) {
      downloadTxtFile(examData, products);
    }
  }

  return (
    <Card className="w-full max-w-5xl mx-auto custom-shadow">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Vista Previa del Examen</CardTitle>
        <CardDescription className="text-muted-foreground">Revise la información antes de confirmar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-lg font-medium mb-2 text-foreground">Información General</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-secondary/30 p-4 rounded-md shadow-sm text-sm">
            <div><span className="font-semibold text-foreground/80">NE:</span> {examData.ne}</div>
            <div><span className="font-semibold text-foreground/80">Referencia:</span> {examData.reference || 'N/A'}</div>
            <div><span className="font-semibold text-foreground/80">Consignatario:</span> {examData.consignee}</div>
            <div><span className="font-semibold text-foreground/80">Gestor:</span> {examData.manager}</div>
            <div><span className="font-semibold text-foreground/80">Ubicación:</span> {examData.location}</div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium mb-3 text-foreground">Productos ({products.length})</h4>
          {products.length > 0 ? (
            <div className="space-y-6">
              {products.map((product, index) => (
                <div key={product.id} className="p-4 border border-border bg-card rounded-lg shadow">
                  <h5 className="text-md font-semibold mb-3 text-primary">
                    Producto {index + 1}
                    {product.itemNumber && <span className="text-sm font-normal text-muted-foreground"> (Item: {product.itemNumber})</span>}
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    <DetailItem label="Número de Item" value={product.itemNumber} icon={<Hash size={16} />} />
                    <DetailItem label="Peso" value={product.weight} icon={<Weight size={16} />} />
                    <DetailItem label="Marca" value={product.brand} icon={<Tag size={16} />} />
                    <DetailItem label="Modelo" value={product.model} icon={<Puzzle size={16} />} />
                    <DetailItem label="Unidad de Medida" value={product.unitMeasure} icon={<Ruler size={16} />} />
                    <DetailItem label="Serie" value={product.serial} icon={<Fingerprint size={16} />} />
                    <DetailItem label="Origen" value={product.origin} icon={<Globe size={16} />} />
                    <DetailItem label="Numeración de Bultos" value={product.numberPackages} icon={<Barcode size={16} />} />
                    <DetailItem label="Cantidad de Bultos" value={product.quantityPackages} icon={<Package size={16} />} />
                    <DetailItem label="Cantidad de Unidades" value={product.quantityUnits} icon={<Box size={16} />} />
                    <DetailItem label="Estado de Mercancía (Condición)" value={product.packagingCondition} icon={<ShieldCheck size={16} />} />
                    
                    <div className="md:col-span-2 lg:col-span-3">
                      <DetailItem label="Descripción" value={product.description} icon={<FileText size={16} />} />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <DetailItem label="Observación" value={product.observation} icon={<MessageSquare size={16} />} />
                    </div>
                    <div className="md:col-span-full pt-2 mt-2 border-t border-border">
                       <DetailItem label="Estado General del Producto" value={getProductStatusText(product)} icon={<ClipboardList size={16} />} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay productos para mostrar.</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-border mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(ExamStep.PRODUCT_LIST)} className="hover:bg-accent/50">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Productos
            </Button>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleDownloadTxt} className="hover:bg-accent/50">
                    <Download className="mr-2 h-4 w-4" /> Descargar TXT
                </Button>
                <Button variant="outline" onClick={handleDownloadExcel} className="hover:bg-accent/50">
                    <Download className="mr-2 h-4 w-4" /> Descargar Excel
                </Button>
                <Button onClick={handleConfirm} className="btn-primary">
                    <Check className="mr-2 h-4 w-4" /> Confirmar Examen
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
