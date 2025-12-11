
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, Timestamp, query, getDocs } from 'firebase/firestore';
import type { AppUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, User, Check, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface ExecutiveGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: AppUser[];
  onGroupUpdated: () => void;
  currentUser: AppUser | null;
}

export function ExecutiveGroupModal({ isOpen, onClose, allUsers, onGroupUpdated, currentUser }: ExecutiveGroupModalProps) {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupMembers, setGroupMembers] = useState<AppUser[]>([]);

  useEffect(() => {
    if (isOpen && currentUser) {
      const groupMemberIds = currentUser.visibilityGroup?.map(member => typeof member === 'string' ? member : member.uid) || [];
      const members = allUsers.filter(u => groupMemberIds.includes(u.uid));

      // Ensure the current user is always included if they are not already
      const memberUids = new Set(members.map(m => m.uid));
      if (!memberUids.has(currentUser.uid)) {
          const currentUserFromList = allUsers.find(u => u.uid === currentUser.uid);
          if (currentUserFromList) {
            members.push(currentUserFromList);
          }
      }

      setGroupMembers(members);
    } else {
      setGroupMembers([]);
    }
  }, [isOpen, currentUser, allUsers]);

  const availableUsers = useMemo(() => {
    const groupMemberUids = new Set(groupMembers.map(m => m.uid));
    return allUsers.filter(u => (u.role === 'ejecutivo' || u.role === 'coordinadora') && !groupMemberUids.has(u.uid));
  }, [allUsers, groupMembers]);

  const handleAddMember = (user: AppUser) => {
    setGroupMembers(prev => [...prev, user]);
  };

  const handleRemoveMember = (uid: string) => {
    if (currentUser && uid === currentUser.uid) {
        toast({ title: "Acción no permitida", description: "No puede eliminar al usuario principal del grupo.", variant: "destructive" });
        return;
    }
    setGroupMembers(prev => prev.filter(m => m.uid !== uid));
  };
  
  const handleSaveChanges = async () => {
    if (!adminUser || !currentUser) return;
    setIsSubmitting(true);
    
    const batch = writeBatch(db);
    
    // The group data should be an array of UIDs
    const newGroupMemberUids = groupMembers.map(m => m.uid);

    // Identify users who were in the old group but are no longer in the new one
    const originalGroupUids = currentUser.visibilityGroup?.map(member => typeof member === 'string' ? member : member.uid) || [];
    const allPreviouslyAffectedUids = Array.from(new Set([currentUser.uid, ...originalGroupUids]));
    
    const usersToRemoveFromGroup = allPreviouslyAffectedUids.filter(uid => !newGroupMemberUids.includes(uid));

    // Update all members of the new group to have the same list of UIDs
    newGroupMemberUids.forEach(uid => {
      const userRef = doc(db, 'users', uid);
      batch.update(userRef, { visibilityGroup: newGroupMemberUids });
    });

    // Clear the group for users who were removed
    usersToRemoveFromGroup.forEach(uid => {
        const userRef = doc(db, 'users', uid);
        batch.update(userRef, { visibilityGroup: [] });
    });


    try {
      await batch.commit();
      toast({ title: "Grupo Actualizado", description: "Los cambios en el grupo de ejecutivos han sido guardados." });
      onGroupUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating executive group:", error);
      toast({ title: "Error", description: "No se pudieron guardar los cambios en el grupo.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (!isOpen || !currentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar Grupo Ejecutivo</DialogTitle>
          <DialogDescription>
            Añada o elimine miembros del grupo de visibilidad para <span className="font-bold text-foreground">{currentUser.displayName || currentUser.email}</span>.
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
                          <CommandEmpty>No hay más usuarios disponibles.</CommandEmpty>
                          <CommandGroup>
                          {availableUsers.map(user => (
                              <CommandItem
                                  key={user.uid}
                                  value={user.displayName || user.email || ''}
                                  onSelect={() => handleAddMember(user)}
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

            {/* Right side: Current group members */}
            <div className="space-y-2">
                 <h4 className="font-medium text-sm">Miembros del Grupo Actual</h4>
                 <ScrollArea className="h-[290px]">
                     <div className="rounded-lg border min-h-[280px] p-2 space-y-1">
                        {groupMembers.length > 0 ? groupMembers.map(member => (
                            <div key={member.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{member.displayName || member.email}</span>
                                    {member.uid === currentUser.uid && <Badge variant="secondary">Principal</Badge>}
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(member.uid)} disabled={member.uid === currentUser.uid}>
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
