
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
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { UserRole } from '@/types';
import { Loader2, Mail, Fingerprint } from 'lucide-react';

const addUserSchema = z.object({
  uid: z.string().min(1, 'El UID es requerido.'),
  email: z.string().email('Debe ser un correo electrónico válido.'),
});

type AddUserFormData = z.infer<typeof addUserSchema>;

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void;
}

export function AddUserModal({ isOpen, onClose, onUserAdded }: AddUserModalProps) {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { uid: '', email: '' },
  });

  const onSubmit = async (data: AddUserFormData) => {
    if (!adminUser) return;
    setIsSubmitting(true);

    const userDocRef = doc(db, 'users', data.uid);

    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            toast({ title: "Usuario ya existe", description: "Un usuario con este UID ya está en la base de datos.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        
        await setDoc(userDocRef, {
            email: data.email,
            role: 'gestor' as UserRole, // Default role
            hasReportsAccess: false,
            hasPaymentAccess: false,
            createdAt: serverTimestamp(),
        });

        toast({ title: "Usuario Añadido", description: `El usuario ${data.email} ha sido añadido al sistema.` });
        onUserAdded();
        onClose();
        form.reset();

    } catch (error) {
        console.error("Error adding user:", error);
        toast({ title: "Error", description: "No se pudo añadir el usuario a la base de datos.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Añada un usuario previamente creado en Firebase Authentication a la base de datos de la aplicación.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="uid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Fingerprint /> UID del Usuario</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isSubmitting}
                      placeholder="UID de Firebase Auth"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Mail /> Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isSubmitting}
                      placeholder="usuario@ejemplo.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Añadir Usuario
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
