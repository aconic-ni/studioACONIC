"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { anexoDocumentSchema, type AnexoDocumentFormData } from '@/app/executive/anexos/page';
import { v4 as uuidv4 } from 'uuid';

interface AnexoDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AnexoDocumentFormData) => void;
  documentData: AnexoDocumentFormData | null;
  worksheetType: 'hoja_de_trabajo' | 'anexo_5' | 'anexo_7';
}

export function AnexoDocumentModal({ isOpen, onClose, onSave, documentData, worksheetType }: AnexoDocumentModalProps) {
  const form = useForm<AnexoDocumentFormData>({
    resolver: zodResolver(anexoDocumentSchema),
    defaultValues: {
      id: '',
      cantidad: undefined,
      origen: '',
      um: '',
      sac: '',
      peso: undefined,
      descripcion: '',
      linea: '',
      guia: '',
      bulto: undefined,
      total: undefined,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (documentData) {
        form.reset(documentData);
      } else {
        form.reset({
          id: uuidv4(),
          cantidad: undefined,
          origen: '',
          um: '',
          sac: '',
          peso: undefined,
          descripcion: '',
          linea: '',
          guia: '',
          bulto: undefined,
          total: undefined,
        });
      }
    }
  }, [isOpen, documentData, form]);

  const handleSubmit = form.handleSubmit((data) => {
    onSave(data);
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{documentData ? 'Editar' : 'Añadir'} Descripción de Mercancía</DialogTitle>
          <DialogDescription className="sr-only">Formulario para añadir o editar los detalles de un producto para el anexo.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit}>
             <ScrollArea className="max-h-[60vh] p-1">
                <div className="space-y-4 px-4 py-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="cantidad" render={({ field }) => (<FormItem><FormLabel>Cantidad</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="origen" render={({ field }) => (<FormItem><FormLabel>Origen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="um" render={({ field }) => (<FormItem><FormLabel>UM</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="sac" render={({ field }) => (<FormItem><FormLabel>SAC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="peso" render={({ field }) => (<FormItem><FormLabel>Peso</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="bulto" render={({ field }) => (<FormItem><FormLabel>Bulto</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        {worksheetType !== 'anexo_7' && (
                            <>
                                <FormField control={form.control} name="linea" render={({ field }) => (<FormItem><FormLabel>Linea Aerea</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="guia" render={({ field }) => (<FormItem><FormLabel>N° Guia Aerea</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </>
                        )}
                        <FormField control={form.control} name="total" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Total (US$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="descripcion" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Descripción</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 mt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
