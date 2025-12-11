
"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { ProductTable } from './ProductTable';
import { AddProductModal } from './AddProductModal';
import { PlusCircle, CheckCircle, ArrowLeft, Upload, Trash2 } from 'lucide-react';
import { ProductDetailsModal } from './ProductDetailsModal';
import * as XLSX from 'xlsx';
import type { Product } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


export function ProductListScreen() {
  const { examData, setCurrentStep, openAddProductModal, products, addProduct, setProducts, selectedProducts, deleteSelectedProducts } = useAppContext();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!examData) {
    // Should not happen if navigation is correct, but as a fallback
    return (
      <div className="text-center py-10">
        <p>Error: Datos del examen no encontrados.</p>
        <Button onClick={() => setCurrentStep(ExamStep.WELCOME)}>Volver al inicio</Button>
      </div>
    );
  }
  
  const handleFinish = () => {
     if (products.length === 0) {
        toast({
            title: "No hay productos",
            description: "Debe agregar al menos un producto antes de finalizar.",
            variant: "destructive"
        });
        return;
      }
    setCurrentStep(ExamStep.PREVIEW);
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            const headerMapping: { [key: string]: keyof Product } = {
                'Item': 'itemNumber',
                'Peso': 'weight',
                'Descripcion': 'description',
                'Marca': 'brand',
                'Modelo': 'model',
                'Unidad Medida': 'unitMeasure',
                'Serie': 'serial',
                'Origen': 'origin',
                'Numeracion Bultos': 'numberPackages',
                'Cantidad Bultos': 'quantityPackages',
                'Cantidad Unidades': 'quantityUnits',
                'Condicion Embalaje': 'packagingCondition',
                'Observacion': 'observation',
                'Conforme': 'isConform',
                'Excedente': 'isExcess',
                'Faltante': 'isMissing',
                'Averia': 'isFault',
            };

            const newProducts: Product[] = json.map((row, index) => {
                const product: Partial<Product> = { id: uuidv4(), productTimestampSaveAt: Timestamp.now() };
                
                for (const excelHeader in headerMapping) {
                    if (row[excelHeader] !== undefined) {
                        const productKey = headerMapping[excelHeader];
                        let value = row[excelHeader];
                        
                        // Handle booleans from 'SI'
                        if (['isConform', 'isExcess', 'isMissing', 'isFault'].includes(productKey)) {
                            value = String(value).trim().toLowerCase() === 'si';
                        }
                        
                        (product as any)[productKey] = value;
                    }
                }

                // Validation for required fields
                if (!product.description || !product.numberPackages || product.quantityPackages === undefined || product.quantityUnits === undefined) {
                    throw new Error(`Fila ${index + 2}: Faltan datos requeridos (Descripción, Numeración de Bultos, Cantidades).`);
                }

                return product as Product;
            });

            setProducts([...products, ...newProducts]);
            toast({
                title: "Importación Exitosa",
                description: `${newProducts.length} productos han sido añadidos a la lista.`
            });

        } catch (error: any) {
            console.error("Error al importar el archivo: ", error);
            toast({
                title: "Error de Importación",
                description: error.message || "Hubo un problema al leer el archivo Excel. Asegúrese de que el formato y los encabezados son correctos.",
                variant: "destructive",
            });
        } finally {
            // Reset file input to allow re-uploading the same file
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  return (
    <Card className="w-full max-w-5xl mx-auto custom-shadow">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <CardTitle className="text-xl md:text-2xl font-semibold text-gray-800">EXAMEN PREVIO</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Añada o importe los productos para el examen.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".xlsx, .xls" />
              <Button onClick={triggerFileSelect} variant="outline">
                 <Upload className="mr-2 h-5 w-5" /> Importar desde Excel
              </Button>
              <Button onClick={() => openAddProductModal()} className="btn-primary">
                <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Producto
              </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md shadow">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div><span className="font-semibold">NE:</span> {examData.ne}</div>
                <div><span className="font-semibold">Referencia:</span> {examData.reference || 'N/A'}</div>
                <div><span className="font-semibold">Consignatario:</span> {examData.consignee}</div>
                <div><span className="font-semibold">Gestor:</span> {examData.manager}</div>
                <div><span className="font-semibold">Ubicación:</span> {examData.location}</div>
            </div>
            <div className="mt-3">
                <Button variant="link" onClick={() => setCurrentStep(ExamStep.INITIAL_INFO)} className="text-primary p-0 h-auto">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Regresar para modificar
                </Button>
            </div>
        </div>
        
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
                 <h3 className="text-lg font-medium">Productos Añadidos: {products.length}</h3>
                 {selectedProducts.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar ({selectedProducts.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Está seguro de eliminar los productos seleccionados?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminarán {selectedProducts.length} productos de la lista.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={deleteSelectedProducts}>Sí, eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}
            </div>
             <Button onClick={handleFinish} className="btn-secondary">
              <CheckCircle className="mr-2 h-5 w-5" /> Finalizar y Previsualizar
            </Button>
        </div>
        
        <ProductTable />
      </CardContent>
      <AddProductModal />
      <ProductDetailsModal />
    </Card>
  );
}
