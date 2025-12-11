
"use client";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import type { Product } from '@/types';
import { X, Hash, Weight, FileText, Tag, Puzzle, Ruler, Fingerprint, Globe, Barcode, Package, Box, ShieldCheck, MessageSquare, ClipboardList } from 'lucide-react';

export function ProductDetailsModal() {
  const { productToView, isProductDetailModalOpen, closeProductDetailModal } = useAppContext();

  if (!isProductDetailModalOpen || !productToView) {
    return null;
  }

  const getStatusText = (product: Product): string => {
    const statuses = [];
    if (product.isConform) statuses.push("Conforme a factura");
    if (product.isExcess) statuses.push("Se encontró excedente");
    if (product.isMissing) statuses.push("Se encontró faltante");
    if (product.isFault) statuses.push("Se encontró avería");
    return statuses.length > 0 ? statuses.join(', ') : 'Sin estado específico';
  };
  
  const DetailItem: React.FC<{ label: string; value?: string | number | null, icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div>
        <div className="flex items-center text-sm font-medium text-muted-foreground">
            {icon && <span className="mr-2">{icon}</span>}
            {label}
        </div>
        <p className="text-base text-foreground pl-6">{String(value ?? 'N/A')}</p>
    </div>
  );


  return (
    <Dialog open={isProductDetailModalOpen} onOpenChange={(open) => !open && closeProductDetailModal()}>
      <DialogContent className="max-w-2xl w-full p-0">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg md:text-xl font-semibold text-gray-800">Detalles del Producto</DialogTitle>
              <button
                onClick={closeProductDetailModal}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                aria-label="Cerrar"
              >
                <X className="h-6 w-6" />
              </button>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <DetailItem label="Número de Item" value={productToView.itemNumber} icon={<Hash size={16}/>} />
                <DetailItem label="Peso" value={productToView.weight} icon={<Weight size={16}/>} />
                <DetailItem label="Marca" value={productToView.brand} icon={<Tag size={16}/>} />
                <DetailItem label="Modelo" value={productToView.model} icon={<Puzzle size={16}/>} />
                <DetailItem label="Unidad de Medida" value={productToView.unitMeasure} icon={<Ruler size={16}/>} />
                <DetailItem label="Serie" value={productToView.serial} icon={<Fingerprint size={16}/>} />
                <DetailItem label="Origen" value={productToView.origin} icon={<Globe size={16}/>} />
                <DetailItem label="Numeración de Bultos" value={productToView.numberPackages} icon={<Barcode size={16}/>} />
                <DetailItem label="Cantidad de Bultos" value={productToView.quantityPackages} icon={<Package size={16}/>} />
                <DetailItem label="Cantidad de Unidades" value={productToView.quantityUnits} icon={<Box size={16}/>} />
                <DetailItem label="Condición Embalaje" value={productToView.packagingCondition} icon={<ShieldCheck size={16}/>} />
                <div className="sm:col-span-2">
                  <DetailItem label="Descripción" value={productToView.description} icon={<FileText size={16}/>}/>
                </div>
                 <div className="sm:col-span-2">
                  <DetailItem label="Observación" value={productToView.observation} icon={<MessageSquare size={16}/>} />
                </div>
                <div className="sm:col-span-2 pt-2 border-t">
                    <div className="flex items-center text-sm font-medium text-muted-foreground">
                        <ClipboardList size={16} className="mr-2"/>
                        Estado General del Producto
                    </div>
                  <div className="flex flex-wrap gap-2 mt-1 pl-6">
                    {productToView.isConform && <Badge className="bg-green-100 text-green-800">Conforme</Badge>}
                    {productToView.isExcess && <Badge className="bg-red-100 text-red-800">Excedente</Badge>}
                    {productToView.isMissing && <Badge className="bg-yellow-100 text-yellow-800">Faltante</Badge>}
                    {productToView.isFault && <Badge className="bg-gray-100 text-gray-800">Avería</Badge>}
                    {!productToView.isConform && !productToView.isExcess && !productToView.isMissing && !productToView.isFault && <Badge variant="outline">Sin especificar</Badge>}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={closeProductDetailModal}>Cerrar</Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
