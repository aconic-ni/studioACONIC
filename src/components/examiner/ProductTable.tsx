
"use client";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import type { Product } from '@/types';
import { Eye, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from '@/components/ui/checkbox';
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

export function ProductTable() {
  const { 
      products, 
      openAddProductModal, 
      deleteProduct, 
      openProductDetailModal,
      selectedProducts,
      toggleProductSelection,
      toggleSelectAllProducts
  } = useAppContext();

  const renderStatusBadges = (product: Product) => {
    const badges = [];
    if (product.isConform) badges.push(<Badge key="conform" variant="default" className="bg-green-100 text-green-800 whitespace-nowrap">Conforme</Badge>);
    if (product.isExcess) badges.push(<Badge key="excess" variant="destructive" className="bg-red-100 text-red-800 whitespace-nowrap">Excedente</Badge>);
    if (product.isMissing) badges.push(<Badge key="missing" variant="secondary" className="bg-yellow-100 text-yellow-800 whitespace-nowrap">Faltante</Badge>);
    if (product.isFault) badges.push(<Badge key="fault" variant="outline" className="bg-gray-100 text-gray-800 whitespace-nowrap">Avería</Badge>);

    if (badges.length === 0) {
      return <Badge variant="outline">Sin Estado</Badge>;
    }
    return <div className="flex flex-wrap gap-1">{badges}</div>;
  };

  const getRowHighlightClass = (product: Product): string => {
    let activeStatusesCount = 0;
    if (product.isConform) activeStatusesCount++;
    if (product.isExcess) activeStatusesCount++;
    if (product.isMissing) activeStatusesCount++;
    if (product.isFault) activeStatusesCount++;

    if (activeStatusesCount > 1) {
      return 'hover:bg-muted/50'; // Neutral background if multiple statuses
    }
    if (activeStatusesCount === 1) {
      if (product.isExcess) return 'bg-red-50 hover:bg-red-100';
      if (product.isConform) return 'bg-green-50 hover:bg-green-100';
      if (product.isMissing) return 'bg-yellow-50 hover:bg-yellow-100';
      if (product.isFault) return 'bg-gray-50 hover:bg-gray-100';
    }
    return 'hover:bg-muted/50'; // Default if no status or unhandled single status
  };


  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay productos añadidos. Haga clic en "Añadir Nuevo" para comenzar.
      </div>
    );
  }
  
  const areAllSelected = products.length > 0 && selectedProducts.length === products.length;

  return (
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader className="bg-gray-50">
          <TableRow>
             <TableHead className="px-4 py-3">
               <Checkbox
                    checked={areAllSelected}
                    onCheckedChange={toggleSelectAllProducts}
                    aria-label="Seleccionar todo"
                />
             </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. BULTOS</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Estado</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white divide-y divide-gray-200">
          {products.map((product) => (
            <TableRow 
                key={product.id} 
                className={getRowHighlightClass(product)}
                data-state={selectedProducts.includes(product.id) ? "selected" : undefined}
            >
              <TableCell className="px-4 py-3">
                <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                    aria-label={`Seleccionar producto ${product.itemNumber || product.description}`}
                />
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.numberPackages || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{product.itemNumber || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{product.description || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500">{product.brand || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500">{`${product.quantityUnits || 0} unid. / ${product.quantityPackages || 0} bultos`}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500">{renderStatusBadges(product)}</TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Abrir menú</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openProductDetailModal(product)}>
                      <Eye className="mr-2 h-4 w-4" /> Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAddProductModal(product)}>
                      <Edit3 className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>

                    <AlertDialog>
                       <AlertDialogTrigger asChild>
                            <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-destructive focus:bg-destructive/10">
                               <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                           <AlertDialogHeader>
                               <AlertDialogTitle>¿Está seguro de eliminar este producto?</AlertDialogTitle>
                               <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                               <AlertDialogCancel>Cancelar</AlertDialogCancel>
                               <AlertDialogAction onClick={() => deleteProduct(product.id)}>Sí, eliminar</AlertDialogAction>
                           </AlertDialogFooter>
                       </AlertDialogContent>
                    </AlertDialog>

                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
