
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { AppUser, AforoCase } from '@/types';
import { User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface AssignUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase | null;
  assignableUsers: AppUser[];
  onAssign: (caseId: string, userName: string) => void;
  title: string;
  description: string;
}

export function AssignUserModal({ isOpen, onClose, caseData, assignableUsers, onAssign, title, description }: AssignUserModalProps) {
  const { user: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const handleAssignClick = () => {
    if (selectedUser) {
        // For bulk actions, caseData might be null. The parent component's onAssign callback
        // for bulk actions doesn't require a caseId.
      onAssign(caseData?.id || '', selectedUser.displayName || selectedUser.email || '');
      onClose();
    }
  };
  
  const canAssign = currentUser?.role === 'admin' || currentUser?.role === 'coordinadora' || currentUser?.role === 'supervisor' || currentUser?.role === 'ejecutivo';

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
                        <CommandItem
                            key={user.uid}
                            value={user.displayName || user.email || ''}
                            onSelect={() => setSelectedUser(user)}
                            className="flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                   <span>{user.displayName || user.email}</span>
                                   <span className="text-xs text-muted-foreground">{user.role}</span>
                                </div>
                            </div>
                            <Check
                                className={cn(
                                "h-4 w-4",
                                selectedUser?.uid === user.uid ? "opacity-100" : "opacity-0"
                                )}
                            />
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={handleAssignClick} disabled={!selectedUser || !canAssign}>
            Confirmar Asignación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
