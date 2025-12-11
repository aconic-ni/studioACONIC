
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { AppUser, AforoCase, AforoCaseUpdate } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, User, Check, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface InvolvedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
  allUsers: AppUser[];
}

export function InvolvedUsersModal({ isOpen, onClose, caseData, allUsers }: InvolvedUsersModalProps) {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [involvedUsers, setInvolvedUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    if (isOpen && caseData) {
      const currentInvolvedUids = caseData.involvedUsers || [];
      const members = allUsers.filter(u => currentInvolvedUids.includes(u.uid));
      setInvolvedUsers(members);
    } else {
      setInvolvedUsers([]);
    }
  }, [isOpen, caseData, allUsers]);

  const availableUsers = allUsers.filter(u => 
    (u.role === 'aforador' || u.role === 'ejecutivo' || u.role === 'supervisor' || u.role === 'coordinadora') &&
    !involvedUsers.some(inv => inv.uid === u.uid)
  );

  const handleAddUser = (user: AppUser) => {
    setInvolvedUsers(prev => [...prev, user]);
  };

  const handleRemoveUser = (uid: string) => {
    setInvolvedUsers(prev => prev.filter(m => m.uid !== uid));
  };
  
  const handleSaveChanges = async () => {
    if (!adminUser || !caseData) return;
    setIsSubmitting(true);
    
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);
    
    const newInvolvedUids = involvedUsers.map(u => u.uid);

    batch.update(caseDocRef, { involvedUsers: newInvolvedUids });

    const updateLog: AforoCaseUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: adminUser.displayName || 'Admin',
        field: 'involvedUsers',
        oldValue: caseData.involvedUsers || [],
        newValue: newInvolvedUids,
        comment: `Usuarios involucrados en la incidencia actualizados.`
    };
    batch.set(doc(updatesSubcollectionRef), updateLog);

    try {
      await batch.commit();
      toast({ title: "Lista de Involucrados Actualizada", description: "Los usuarios involucrados en la incidencia han sido guardados." });
      onClose();
    } catch (error) {
      console.error("Error updating involved users:", error);
      toast({ title: "Error", description: "No se pudieron guardar los cambios.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !caseData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar Involucrados en la Incidencia</DialogTitle>
          <DialogDescription>
            Seleccione los usuarios involucrados en la rectificación del caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
            {/* Left side: Available users */}
            <div className="space-y-2">
                <h4 className="font-medium text-sm">Usuarios Disponibles</h4>
                <Command className="rounded-lg border shadow-sm">
                    <CommandInput placeholder="Buscar usuario..." />
                    <ScrollArea className="h-[250px]">
                        <CommandList>
                            <CommandEmpty>No hay más usuarios que cumplan el criterio.</CommandEmpty>
                            <CommandGroup>
                            {availableUsers.map(user => (
                                <CommandItem
                                    key={user.uid}
                                    value={user.displayName || user.email || ''}
                                    onSelect={() => handleAddUser(user)}
                                    className="cursor-pointer"
                                >
                                    <User className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                       <span>{user.displayName || user.email}</span>
                                       <span className="text-xs text-muted-foreground">{user.role}</span>
                                    </div>
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                    </ScrollArea>
                </Command>
            </div>

            {/* Right side: Current involved users */}
            <div className="space-y-2">
                 <h4 className="font-medium text-sm">Usuarios Involucrados</h4>
                 <ScrollArea className="h-[290px]">
                     <div className="rounded-lg border min-h-[280px] p-2 space-y-1">
                        {involvedUsers.length > 0 ? involvedUsers.map(member => (
                            <div key={member.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{member.displayName || member.email}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveUser(member.uid)}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        )) : (
                            <p className="text-sm text-muted-foreground text-center p-8">Añada usuarios de la lista de la izquierda.</p>
                        )}
                     </div>
                 </ScrollArea>
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
