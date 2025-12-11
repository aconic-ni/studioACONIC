"use client";
import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { X, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  targetSystem: 'examiner' | 'reporter';
}

export function LoginModal({ isOpen, onClose, onLoginSuccess, targetSystem }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async () => {
    const userCredential = await signInWithEmailAndPassword(auth as Auth, email, password);
    const firebaseUser = userCredential.user;

    if (targetSystem === 'reporter') {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.hasReportsAccess) {
        // User has access, proceed with login success
        onLoginSuccess();
      } else {
        // User does not have access, create a request if it doesn't exist
        const requestDocRef = doc(db, 'reportAccessRequests', firebaseUser.uid);
        const requestDocSnap = await getDoc(requestDocRef);

        if (!requestDocSnap.exists()) {
          await setDoc(requestDocRef, {
            userId: firebaseUser.uid,
            userEmail: firebaseUser.email,
            status: 'pending',
            requestedAt: serverTimestamp(),
          });
          toast({ title: 'Solicitud Enviada', description: 'Tu solicitud de acceso ha sido enviada al administrador.' });
        }
        // Still proceed to login success, the app will route to the pending page
        onLoginSuccess();
      }
    } else {
      // For 'examiner', just succeed
      onLoginSuccess();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, ingrese correo y contraseña.");
      setLoading(false);
      return;
    }
    
    try {
      await handleLogin();
      toast({ title: 'Inicio de sesión exitoso', description: 'Bienvenido.' });
      onClose();
    } catch (err: any) {
      console.error("Firebase Auth Error:", err);
      let userFriendlyError = 'Error al iniciar sesión. Inténtelo de nuevo.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        userFriendlyError = 'Correo o contraseña incorrectos.';
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyError = 'El formato del correo electrónico no es válido.';
      }
      setError(userFriendlyError);
      toast({ title: 'Error de inicio de sesión', description: userFriendlyError, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md glass-effect text-foreground border-border/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {targetSystem === 'reporter' ? 'Customs Reports' : 'CustomsEX-p'}
          </DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-6 w-6 text-muted-foreground" />
          </button>
        </DialogHeader>
        <DialogDescription className="text-muted-foreground">
          Ingrese sus credenciales para acceder al sistema.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div>
            <Label htmlFor="email-login" className="flex items-center text-sm font-medium text-foreground mb-1">
              <Mail className="mr-2 h-4 w-4 text-primary" />
              Correo Electrónico
            </Label>
            <Input
              id="email-login"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 text-foreground placeholder:text-muted-foreground border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="usuario@ejemplo.com"
            />
          </div>
          <div>
            <Label htmlFor="password-login" className="flex items-center text-sm font-medium text-foreground mb-1">
              <Lock className="mr-2 h-4 w-4 text-primary" />
              Contraseña
            </Label>
            <div className="relative">
                <Input
                id="password-login"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-10 text-foreground placeholder:text-muted-foreground border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="********"
                />
                <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
            </div>
          </div>
           {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="btn-primary text-primary-foreground px-8 py-3 rounded-md font-medium w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
