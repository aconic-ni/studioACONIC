
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, Timestamp, getDocs, query, where } from 'firebase/firestore';
import type { Worksheet, AppUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssignUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  worksheet?: Worksheet | null;
  type: 'aforador' | 'revisor' | 'bulk-aforador' | 'bulk-revisor';
  selectedWorksheetIds?: string[];
}

export function AssignUserModal({ isOpen, onClose, worksheet, type, selectedWorksheetIds }: AssignUserModalProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchUsers = async () => {
      const role = type.includes('aforador') ? 'aforador' : 'agente'; // Revisores are agents
      const usersQuery = query(collection(db, 'users'), where('role', '==', role));
      const snapshot = await getDocs(usersQuery);
      const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser));
      setAssignableUsers(users);
    };
    fetchUsers();
  }, [isOpen, type]);

  const handleAssign = async () => {
    if (!selectedUser || !currentUser?.displayName) return;
    setIsSubmitting(true);
    
    const batch = writeBatch(db);
    const fieldToUpdate = type.includes('aforador') ? 'aforador' : 'revisor';
    const now = Timestamp.now();
    const userDisplayName = selectedUser.displayName || selectedUser.email;
    const idsToUpdate = worksheet ? [worksheet.id] : selectedWorksheetIds || [];

    if (idsToUpdate.length === 0) {
        toast({ title: "Error", description: "No se seleccionaron hojas de trabajo.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    idsToUpdate.forEach(wsId => {
      const aforoSubcollectionRef = doc(db, `worksheets/${wsId}/aforo/metadata`);
      const updateData = {
          [fieldToUpdate]: userDisplayName,
          [`${fieldToUpdate}AssignedAt`]: now,
          [`${fieldToUpdate}AssignedBy`]: currentUser.displayName,
      };
      batch.set(aforoSubcollectionRef, updateData, { merge: true });
    });

    try {
        await batch.commit();
        toast({
            title: "Asignación Exitosa",
            description: `${userDisplayName} ha sido asignado como ${fieldToUpdate} a ${idsToUpdate.length} hoja(s) de trabajo.`,
        });
        onClose();
    } catch(e) {
        console.error(e);
        toast({ title: "Error", description: "No se pudo completar la asignación.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const title = `Asignar ${type.includes('aforador') ? 'Aforador' : 'Revisor'}${type.includes('bulk') ? ' Masivamente' : ''}`;
  const description = worksheet ? `Seleccione un usuario para el NE: ${worksheet.ne}` : `Seleccione un usuario para ${selectedWorksheetIds?.length || 0} hoja(s) de trabajo.`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="rounded-lg border shadow-md">
          <CommandInput placeholder="Buscar usuario..." />
          <CommandList>
            <CommandEmpty>No se encontraron usuarios.</CommandEmpty>
            <CommandGroup>
              {assignableUsers.map(user => (
                <CommandItem key={user.uid} value={user.displayName || user.email || ''} onSelect={() => setSelectedUser(user)}>
                  <Check className={cn("mr-2 h-4 w-4", selectedUser?.uid === user.uid ? "opacity-100" : "opacity-0")} />
                  {user.displayName || user.email}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={!selectedUser || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Confirmar Asignación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
