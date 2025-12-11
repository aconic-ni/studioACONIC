"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { RequiredPermit } from '@/types';

const permitDetailsSchema = z.object({
  // INE
  item: z.string().optional(),
  marcaEquipo: z.string().optional(),
  modeloEquipo: z.string().optional(),
  
  // Unified field
  tipoTramite: z.string().optional(),
});

type PermitDetailsFormData = z.infer<typeof permitDetailsSchema>;

interface PermitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  permit: Partial<RequiredPermit>;
  onSave: (updatedDetails: Partial<RequiredPermit>) => void;
}

export function PermitDetailsModal({ isOpen, onClose, permit, onSave }: PermitDetailsModalProps) {
  const { toast } = useToast();

  const form = useForm<PermitDetailsFormData>({
    resolver: zodResolver(permitDetailsSchema),
    defaultValues: {
      item: permit.item || '',
      marcaEquipo: permit.marcaEquipo || '',
      modeloEquipo: permit.modeloEquipo || '',
      tipoTramite: permit.tipoTramite || '',
    },
  });
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        item: permit.item || '',
        marcaEquipo: permit.marcaEquipo || '',
        modeloEquipo: permit.modeloEquipo || '',
        tipoTramite: permit.tipoTramite || '',
      });
    }
  }, [isOpen, permit, form]);


  const onSubmit = (data: PermitDetailsFormData) => {
    onSave(data);
  };

  const renderFields = () => {
    switch (permit.name) {
      case 'Dictamen Tecnico INE':
        return (
          <>
            <FormField control={form.control} name="item" render={({ field }) => (<FormItem><FormLabel>Item</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="marcaEquipo" render={({ field }) => (<FormItem><FormLabel>Marca de Equipo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="modeloEquipo" render={({ field }) => (<FormItem><FormLabel>Modelo de Equipo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="tipoTramite" render={({ field }) => (<FormItem><FormLabel>Tipo de Equipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Refrigerador o Aire..." /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="Refrigerador">Refrigerador</SelectItem><SelectItem value="Aire Acondicionado">Aire Acondicionado</SelectItem></SelectContent>
                </Select>
            </FormItem>)} />
          </>
        );
      case 'IPSA':
        return (
          <FormField control={form.control} name="tipoTramite" render={({ field }) => (<FormItem><FormLabel>Tipo de Trámite IPSA</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger></FormControl>
                <SelectContent>
                    <SelectItem value="Animal">Animal</SelectItem>
                    <SelectItem value="Vegetal">Vegetal</SelectItem>
                    <SelectItem value="Semillas">Semillas</SelectItem>
                    <SelectItem value="Renovacion de Licencias">Renovacion de Licencias</SelectItem>
                </SelectContent>
              </Select>
          </FormItem>)} />
        );
      case 'MINSA':
        return (
          <FormField control={form.control} name="tipoTramite" render={({ field }) => (<FormItem><FormLabel>Tipo de Trámite MINSA</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger></FormControl>
                <SelectContent>
                    <SelectItem value="ALIMENTOS">ALIMENTOS</SelectItem>
                    <SelectItem value="COSMETICO">COSMÉTICO</SelectItem>
                    <SelectItem value="HIGIENICO">HIGIÉNICO</SelectItem>
                    <SelectItem value="SUPLEMENTOS">SUPLEMENTOS</SelectItem>
                    <SelectItem value="DISPOSITIVOS MEDICOS">DISPOSITIVOS MÉDICOS</SelectItem>
                </SelectContent>
              </Select>
          </FormItem>)} />
        );
      case 'TELCOR':
        return (
          <FormField control={form.control} name="tipoTramite" render={({ field }) => (<FormItem><FormLabel>Tipo de Trámite TELCOR</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger></FormControl>
                <SelectContent>
                    <SelectItem value="Permiso">Permiso</SelectItem>
                    <SelectItem value="Licencia">Licencia</SelectItem>
                    <SelectItem value="Homologacion">Homologación</SelectItem>
                </SelectContent>
              </Select>
          </FormItem>)} />
        );
      default:
        return (
          <FormField control={form.control} name="tipoTramite" render={({ field }) => (<FormItem><FormLabel>Tipo de Trámite</FormLabel><FormControl><Input {...field} defaultValue="Autorización" /></FormControl><FormMessage /></FormItem>)} />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalles para {permit.name}</DialogTitle>
          <DialogDescription>
            Complete la información específica para este tipo de permiso.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {renderFields()}
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Guardar Detalles</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
