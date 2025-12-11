
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, where, getDocs, Query } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { AppUser } from "@/types";

interface ConsigneeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

interface ConsigneeOption {
  value: string;
  label: string;
}

export function ConsigneeSelector({ value, onChange }: ConsigneeSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConsigneeOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    
    const fetchDirectories = async () => {
        setIsLoading(true);
        const allConsignees = new Set<string>();
        let uidsToQuery: string[] = [user.uid];

        if (user.role === 'admin' || user.role === 'supervisor' || user.role === 'coordinadora') {
            // Fetch all users to get all their directories
            const allUsersSnapshot = await getDocs(collection(db, 'users'));
            uidsToQuery = allUsersSnapshot.docs.map(doc => doc.id);
        } else if (user.role === 'ejecutivo' && user.visibilityGroup && user.visibilityGroup.length > 0) {
            uidsToQuery = Array.from(new Set([user.uid, ...user.visibilityGroup]));
        }
        
        for (const uid of uidsToQuery) {
            try {
                const consigneeCollectionRef = collection(db, `users/${uid}/consigneeDirectory`);
                const consigneeSnapshot = await getDocs(consigneeCollectionRef);
                consigneeSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.name) {
                        allConsignees.add(data.name);
                    }
                });
            } catch (error) {
                 console.error(`Error fetching directory for user ${uid}:`, error);
            }
        }
        
        const sortedOptions = Array.from(allConsignees)
            .sort((a, b) => a.localeCompare(b))
            .map(name => ({ value: name.toLowerCase(), label: name }));

        setOptions(sortedOptions);
        setIsLoading(false);
    }
    
    fetchDirectories();

    // No real-time listener needed anymore since we fetch on component mount/user change
    // If real-time updates across group members are needed, this would require a more complex listener setup.
    // For now, fetching on load is sufficient.
    
  }, [user]);

  const handleSaveToDirectory = async () => {
    if (!user || !value || value.trim().length < 3) {
      toast({
        title: "No se puede guardar",
        description: "El nombre del consignatario debe tener al menos 3 caracteres.",
        variant: "destructive"
      });
      return;
    }

    if (options.some(opt => opt.label.toLowerCase() === value.trim().toLowerCase())) {
        toast({
            title: "Consignatario ya existe",
            description: "Este consignatario ya está en un directorio compartido.",
            variant: "default"
        });
        return;
    }

    setIsSaving(true);
    try {
      const directoryRef = collection(db, `users/${user.uid}/consigneeDirectory`);
      await addDoc(directoryRef, {
        name: value.trim(),
        createdAt: serverTimestamp(),
      });
      toast({
        title: "Guardado",
        description: `"${value.trim()}" ha sido añadido a su directorio personal.`,
      });
      // Optimistically add to the list
      const newOption = { value: value.trim().toLowerCase(), label: value.trim() };
      setOptions(prevOptions => [...prevOptions, newOption].sort((a,b) => a.label.localeCompare(b.label)));

    } catch (error) {
      console.error("Error saving consignee:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el consignatario.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="flex items-center gap-2">
        <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleSaveToDirectory}
            disabled={isSaving}
            aria-label="Guardar consignatario en el directorio"
        >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              <span className="truncate">{value || "Seleccionar o escribir..."}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar o añadir consignatario..."
                value={value}
                onValueChange={onChange}
              />
              <CommandList>
                {isLoading && (
                  <div className="py-6 text-center text-sm">Cargando...</div>
                )}
                {!isLoading && (
                    <>
                    <CommandEmpty>No se encontró. Puede escribir y guardar.</CommandEmpty>
                    <CommandGroup>
                        {options.filter(opt => opt.label.toLowerCase().includes(value.toLowerCase())).map((option) => (
                        <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={(currentValue) => {
                            onChange(currentValue === value ? "" : option.label);
                            setOpen(false);
                            }}
                        >
                            <Check
                            className={cn(
                                "mr-2 h-4 w-4",
                                value.toLowerCase() === option.value ? "opacity-100" : "opacity-0"
                            )}
                            />
                            {option.label}
                        </CommandItem>
                        ))}
                    </CommandGroup>
                    </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
    </div>
  );
}
