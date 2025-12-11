
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
import type { AppUser } from '@/types';
import { Loader2, User, Award, Fingerprint } from 'lucide-react';

const agentSchema = z.object({
  displayName: z.string().min(1, 'El nombre es requerido.'),
  roleTitle: z.string().optional(),
  agentLicense: z.string().optional(),
  cedula: z.string().optional(),
});

type AgentFormData = z.infer<typeof agentSchema>;

interface AgentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser;
  onUserUpdated: () => void;
}

export function AgentDetailsModal({ isOpen, onClose, user, onUserUpdated }: AgentDetailsModalProps) {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      displayName: user.displayName || '',
      roleTitle: user.roleTitle || '',
      agentLicense: user.agentLicense || '',
      cedula: user.cedula || '',
    },
  });

  const onSubmit = async (data: AgentFormData) => {
    if (!adminUser || !user) return;
    setIsSubmitting(true);

    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, {
        displayName: data.displayName,
        roleTitle: data.roleTitle,
        agentLicense: data.agentLicense,
        cedula: data.cedula,
      });

      toast({ title: "Agente Actualizado", description: "La información del agente ha sido guardada." });
      onUserUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating agent:", error);
      toast({ title: "Error", description: "No se pudo actualizar la información del agente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Detalles del Agente</DialogTitle>
          <DialogDescription>
            Modifique la información para {user.email}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><User /> Nombre Completo</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} placeholder="Nombre y Apellido" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="roleTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Award /> Título de Rol</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} placeholder="Ej: Agente Aduanero" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agentLicense"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Award /> Licencia de Agente</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} placeholder="Número de licencia" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cedula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Fingerprint /> Cédula</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} placeholder="Número de cédula" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Guardar Cambios
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

