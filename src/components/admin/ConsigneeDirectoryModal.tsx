
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, getDocs, where, doc } from 'firebase/firestore';
import type { AppUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Check, Trash2, Building } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface ConsigneeDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  guestUser: AppUser;
}

export function ConsigneeDirectoryModal({ isOpen, onClose, guestUser }: ConsigneeDirectoryModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allConsignees, setAllConsignees] = useState<string[]>([]);
  const [userDirectory, setUserDirectory] = useState<string[]>([]);
  const [userDirectoryDocIds, setUserDirectoryDocIds] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllConsignees = useCallback(async () => {
    const consigneeSet = new Set<string>();
    const usersSnapshot = await getDocs(collection(db, 'users'));
    for (const userDoc of usersSnapshot.docs) {
      const directorySnapshot = await getDocs(collection(db, `users/${userDoc.id}/consigneeDirectory`));
      directorySnapshot.forEach(doc => consigneeSet.add(doc.data().name));
    }
    return Array.from(consigneeSet).sort();
  }, []);

  const fetchUserDirectory = useCallback(() => {
    const directoryRef = collection(db, `users/${guestUser.uid}/consigneeDirectory`);
    const q = query(directoryRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const names: string[] = [];
        const docIds = new Map<string, string>();
        snapshot.forEach(doc => {
            const name = doc.data().name;
            names.push(name);
            docIds.set(name, doc.id);
        });
        setUserDirectory(names);
        setUserDirectoryDocIds(docIds);
    });
    return unsubscribe;
  }, [guestUser.uid]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const loadData = async () => {
        const all = await fetchAllConsignees();
        setAllConsignees(all);
        const unsub = fetchUserDirectory();
        setIsLoading(false);
        return unsub;
      }
      let unsubscribe: (() => void) | undefined;
      loadData().then(unsub => { unsubscribe = unsub; });
      
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [isOpen, fetchAllConsignees, fetchUserDirectory]);

  const handleToggleConsignee = async (consigneeName: string) => {
    setIsSubmitting(true);
    const directoryRef = collection(db, `users/${guestUser.uid}/consigneeDirectory`);
    
    try {
        if (userDirectory.includes(consigneeName)) {
            // Remove
            const docIdToRemove = userDirectoryDocIds.get(consigneeName);
            if (docIdToRemove) {
                await deleteDoc(doc(directoryRef, docIdToRemove));
                toast({ title: "Removido", description: `${consigneeName} fue removido del directorio.` });
            }
        } else {
            // Add
            await addDoc(directoryRef, { name: consigneeName });
            toast({ title: "Añadido", description: `${consigneeName} fue añadido al directorio.` });
        }
    } catch (error) {
        console.error("Error toggling consignee:", error);
        toast({ title: "Error", description: "No se pudo actualizar el directorio.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar Directorio de Invitado</DialogTitle>
          <DialogDescription>
            Seleccione los consignatarios que <span className="font-bold text-foreground">{guestUser.displayName || guestUser.email}</span> podrá ver en la sección de permisos.
          </DialogDescription>
        </DialogHeader>

        <Command className="rounded-lg border shadow-md mt-4">
          <CommandInput placeholder="Buscar consignatario..." />
          <ScrollArea className="h-72">
            <CommandList>
                {isLoading ? (
                    <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                    <>
                    <CommandEmpty>No se encontraron consignatarios.</CommandEmpty>
                    <CommandGroup>
                        {allConsignees.map(consignee => {
                            const isSelected = userDirectory.includes(consignee);
                            return (
                                <CommandItem
                                    key={consignee}
                                    value={consignee}
                                    onSelect={() => handleToggleConsignee(consignee)}
                                    className="flex items-center justify-between cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-muted-foreground" />
                                        <span>{consignee}</span>
                                    </div>
                                    <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                </CommandItem>
                            )
                        })}
                    </CommandGroup>
                    </>
                )}
            </CommandList>
          </ScrollArea>
        </Command>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
