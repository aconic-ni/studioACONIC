
"use client";
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from '@/context/AppContext';
import type { ProductFormData } from './FormParts/zodSchemas';
import { productSchema } from './FormParts/zodSchemas';
import type { Product } from '@/types';
import { CustomCheckbox } from './FormParts/CustomCheckbox';
import {
  X,
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
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

const RequiredIndicator = () => <span className="text-destructive ml-1">*</span>;

export function AddProductModal() {
  const {
    isAddProductModalOpen,
    closeAddProductModal,
    addProduct,
    updateProduct,
    editingProduct
  } = useAppContext();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      itemNumber: '',
      weight: '',
      description: '',
      brand: '',
      model: '',
      unitMeasure: '',
      serial: '',
      origin: '',
      numberPackages: '',
      quantityPackages: undefined, // Use undefined for optional numbers
      quantityUnits: undefined,    // Use undefined for optional numbers
      packagingCondition: '',
      observation: '',
      isConform: false,
      isExcess: false,
      isMissing: false,
      isFault: false,
    },
  });

  useEffect(() => {
    if (isAddProductModalOpen) { // Reset only when modal becomes open
      if (editingProduct) {
        form.reset({
          id: editingProduct.id,
          itemNumber: editingProduct.itemNumber ?? '',
          weight: editingProduct.weight ?? '',
          description: editingProduct.description ?? '',
          brand: editingProduct.brand ?? '',
          model: editingProduct.model ?? '',
          unitMeasure: editingProduct.unitMeasure ?? '',
          serial: editingProduct.serial ?? '',
          origin: editingProduct.origin ?? '',
          numberPackages: editingProduct.numberPackages ?? '',
          quantityPackages: editingProduct.quantityPackages !== undefined ? Number(editingProduct.quantityPackages) : undefined,
          quantityUnits: editingProduct.quantityUnits !== undefined ? Number(editingProduct.quantityUnits) : undefined,
          packagingCondition: editingProduct.packagingCondition ?? '',
          observation: editingProduct.observation ?? '',
          isConform: editingProduct.isConform, // Booleans are non-optional in Product type
          isExcess: editingProduct.isExcess,
          isMissing: editingProduct.isMissing,
          isFault: editingProduct.isFault,
          productTimestampSaveAt: editingProduct.productTimestampSaveAt,
        });
      } else {
        form.reset({
          itemNumber: '',
          weight: '',
          description: '',
          brand: '',
          model: '',
          unitMeasure: '',
          serial: '',
          origin: '',
          numberPackages: '',
          quantityPackages: undefined,
          quantityUnits: undefined,
          packagingCondition: '',
          observation: '',
          isConform: false,
          isExcess: false,
          isMissing: false,
          isFault: false,
        });
      }
    }
  }, [editingProduct, form, isAddProductModalOpen]);

  function onSubmit(data: ProductFormData) {
    const productData: Omit<Product, 'id'> & { id?: string } = {
        ...data,
        quantityPackages: data.quantityPackages !== undefined ? Number(data.quantityPackages) : undefined,
        quantityUnits: data.quantityUnits !== undefined ? Number(data.quantityUnits) : undefined,
    };

    if (editingProduct && editingProduct.id) {
        // When updating, preserve the original timestamp
        const updatedProduct: Product = { 
          ...productData, 
          id: editingProduct.id,
          productTimestampSaveAt: editingProduct.productTimestampSaveAt
        };
        updateProduct(updatedProduct);
    } else {
      addProduct(productData);
    }
    closeAddProductModal();
  }

  if (!isAddProductModalOpen) return null;

  return (
    <Dialog open={isAddProductModalOpen} onOpenChange={(open) => !open && closeAddProductModal()}>
      <DialogContent className="max-w-3xl w-full p-0">
        <ScrollArea className="max-h-[85vh]">
        <div className="p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold text-foreground">
            {editingProduct ? 'Editar Producto' : 'Añadir Producto'}
          </DialogTitle>
           <button
            onClick={closeAddProductModal}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-6 w-6 text-muted-foreground" />
          </button>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="itemNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-primary" />Número de Item</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="weight" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Weight className="mr-2 h-4 w-4 text-primary" />Peso</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <div className="md:col-span-2">
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-primary" />Descripción<RequiredIndicator /></FormLabel>
                    <FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                  </FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Tag className="mr-2 h-4 w-4 text-primary" />Marca</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Puzzle className="mr-2 h-4 w-4 text-primary" />Modelo</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="unitMeasure" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Ruler className="mr-2 h-4 w-4 text-primary" />Unidad de Medida</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="serial" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Fingerprint className="mr-2 h-4 w-4 text-primary" />Serie</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="origin" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Globe className="mr-2 h-4 w-4 text-primary" />Origen</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="numberPackages" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Barcode className="mr-2 h-4 w-4 text-primary" />Numeración de Bultos<RequiredIndicator /></FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="quantityPackages" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-primary" />Cantidad de Bultos<RequiredIndicator /></FormLabel>
                  <FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="quantityUnits" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-primary" />Cantidad de Unidades<RequiredIndicator /></FormLabel>
                  <FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''}/></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="packagingCondition" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><ShieldCheck className="mr-2 h-4 w-4 text-primary" />Estado de Mercancía (Nueva, Usada, Otros)</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <div className="md:col-span-2">
                <FormField control={form.control} name="observation" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-primary" />Observación</FormLabel>
                    <FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage />
                  </FormItem>
                )}/>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-3 mt-4">
              <Controller control={form.control} name="isConform" render={({ field }) => (
                <CustomCheckbox label="Conforme a factura" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
              <Controller control={form.control} name="isExcess" render={({ field }) => (
                <CustomCheckbox label="Notificar excedente" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
              <Controller control={form.control} name="isMissing" render={({ field }) => (
                <CustomCheckbox label="Notificar faltante" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
              <Controller control={form.control} name="isFault" render={({ field }) => (
                <CustomCheckbox label="Notificar Avería" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
            </div>

            <DialogFooter className="pt-4 gap-3">
              <Button type="button" variant="outline" onClick={closeAddProductModal}>Cancelar</Button>
              <Button type="submit" className="btn-primary">{editingProduct ? 'Guardar Cambios' : 'Guardar Producto'}</Button>
            </DialogFooter>
          </form>
        </Form>
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
