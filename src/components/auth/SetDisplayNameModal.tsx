
"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { User, Loader2 } from 'lucide-react';

interface SetDisplayNameModalProps {
  isOpen: boolean;
}

export function SetDisplayNameModal({ isOpen }: SetDisplayNameModalProps) {
  const { updateUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast({ title: "Nombre no válido", description: "Por favor, ingresa un nombre.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile(displayName.trim());
      toast({ title: "¡Bienvenido!", description: "Tu nombre ha sido guardado." });
      // The modal will close automatically as the parent component re-renders
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar tu nombre.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md glass-effect text-foreground border-border/30" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">¡Bienvenido a CustomsEX-p!</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-muted-foreground">
          Parece que es tu primera vez aquí. Por favor, ingresa tu nombre completo para continuar.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div>
            <Label htmlFor="displayName" className="flex items-center text-sm font-medium text-foreground mb-1">
              <User className="mr-2 h-4 w-4 text-primary" />
              Nombre y Apellido (Ej. "John Doe")
            </Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 text-foreground placeholder:text-muted-foreground border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ej: John Doe"
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="btn-primary text-primary-foreground px-8 py-3 rounded-md font-medium w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Guardar y Continuar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
