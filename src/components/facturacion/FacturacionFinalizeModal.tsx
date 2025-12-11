"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { AforoCase } from '@/types';
import { Loader2 } from 'lucide-react';

const finalizeSchema = z.object({
  cuentaDeRegistro: z.string().min(1, 'El número de cuenta de registro es requerido.'),
});

type FinalizeFormData = z.infer<typeof finalizeSchema>;

interface FacturacionFinalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function FacturacionFinalizeModal({ isOpen, onClose, caseData }: FacturacionFinalizeModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FinalizeFormData>({
    resolver: zodResolver(finalizeSchema),
    defaultValues: {
      cuentaDeRegistro: caseData.cuentaDeRegistro || '',
    },
  });

  const onSubmit = async (data: FinalizeFormData) => {
    if (!user) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'});
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);

    try {
        await updateDoc(caseDocRef, {
            facturacionStatus: 'Facturado',
            facturadoAt: new Date(),
            cuentaDeRegistro: data.cuentaDeRegistro,
        });

        toast({
            title: "Proceso Finalizado",
            description: `El caso NE ${caseData.ne} ha sido marcado como facturado.`,
        });
        onClose();

    } catch (error) {
        console.error("Error finalizing case:", error);
        toast({ title: 'Error', description: 'No se pudo finalizar el proceso.', variant: 'destructive'});
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Proceso de Facturación</DialogTitle>
          <DialogDescription>
            Ingrese el número de cuenta de registro para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="cuentaDeRegistro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Cuenta de Registro</FormLabel>
                  <FormControl><Input {...field} placeholder="Ingrese el número de cuenta..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar y Finalizar
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
