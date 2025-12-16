
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
  type: 'aforador' | 'revisor' | 'digitador' | 'bulk-aforador' | 'bulk-revisor' | 'bulk-digitador';
  selectedWorksheetIds?: string[];
  setWorksheets?: React.Dispatch<React.SetStateAction<Worksheet[]>>;
}

export function AssignUserModal({ isOpen, onClose, worksheet, type, selectedWorksheetIds, setWorksheets }: AssignUserModalProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchUsers = async () => {
      let roles: string[];
      if (type.includes('aforador') || type.includes('digitador')) {
          roles = ['aforador', 'supervisor', 'coordinadora'];
      } else if (type.includes('revisor')) {
          roles = ['agente aduanero'];
      } else {
          roles = [];
      }

      if(roles.length === 0) {
        setAssignableUsers([]);
        return;
      }
      
      const usersQuery = query(collection(db, 'users'), where('role', 'in', roles));
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
    let fieldToUpdate: 'aforador' | 'revisor' | 'digitador';

    if (type.includes('aforador')) {
        fieldToUpdate = 'aforador';
    } else if (type.includes('revisor')) {
        fieldToUpdate = 'revisor';
    } else {
        fieldToUpdate = 'digitador';
    }

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
        
        if (setWorksheets) {
            setWorksheets(prev => prev.map(ws => {
                if (idsToUpdate.includes(ws.id)) {
                    const newAforo = { ...(ws as any).aforo, [fieldToUpdate]: userDisplayName };
                    return { ...ws, aforo: newAforo };
                }
                return ws;
            }));
        }

        onClose();
    } catch(e) {
        console.error(e);
        toast({ title: "Error", description: "No se pudo completar la asignación.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const title = `Asignar ${type.includes('aforador') ? 'Aforador' : type.includes('revisor') ? 'Revisor' : 'Digitador'}${type.includes('bulk') ? ' Masivamente' : ''}`;
  const description = worksheet ? `Seleccione un usuario para el NE: ${worksheet.ne}` : `Seleccione un usuario para ${selectedWorksheetIds?.length || 0} hoja(s) de trabajo.`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="rounded-lg border shadow-sm">
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
