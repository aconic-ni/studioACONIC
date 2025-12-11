
"use client";

import { useForm, useFieldArray, Control } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { corporateReportSchema } from '@/app/executive/corporate-report/page';

type CorporateReportFormData = z.infer<typeof corporateReportSchema>;

const facturaItemSchema = z.object({
  number: z.string().min(1, "Número de factura requerido."),
  noADMI: z.string().min(1, "No. ADMI es requerido."),
});
type FacturaItemFormData = z.infer<typeof facturaItemSchema>;

interface FacturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  control: Control<CorporateReportFormData>;
}

export function FacturaModal({ isOpen, onClose, control }: FacturaModalProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "documents",
  });

  const form = useForm<FacturaItemFormData>({
    resolver: zodResolver(facturaItemSchema),
    defaultValues: { number: '', noADMI: '' },
  });

  const handleAddFactura = (data: FacturaItemFormData) => {
    append({ id: uuidv4(), type: 'FACTURA', ...data });
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Administrar Facturas y No. ADMI</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAddFactura)} className="flex items-end gap-2 p-4 border rounded-md">
              <FormField control={form.control} name="number" render={({ field }) => (<FormItem className="flex-1"><FormLabel>No. Factura</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="noADMI" render={({ field }) => (<FormItem className="flex-1"><FormLabel>No. ADMI</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" size="icon" className="shrink-0"><PlusCircle className="h-5 w-5" /></Button>
          </form>
        </Form>
        
        <div className="mt-4 max-h-60 overflow-y-auto border rounded-md">
            <Table>
                <TableHeader><TableRow><TableHead>No. Factura</TableHead><TableHead>No. ADMI</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                <TableBody>
                    {fields.map((field, index) => (
                        <TableRow key={field.id}>
                            <TableCell>{(field as any).number}</TableCell>
                            <TableCell>{(field as any).noADMI}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
