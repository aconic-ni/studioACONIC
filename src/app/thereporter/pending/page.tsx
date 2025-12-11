
"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, Clock, ShieldCheck, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function PendingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'requested'>('idle');

  // Redirect admin immediately, they don't need to request access.
  useEffect(() => {
    if (!loading && user) {
        if(user.role === 'admin') {
            router.push('/thereporter');
            return;
        }
        if (user.hasReportsAccess) {
            router.push('/thereporter');
            return;
        }

        // Check if a request already exists
        const checkRequestStatus = async () => {
            const requestDocRef = doc(db, 'reportAccessRequests', user.uid);
            const docSnap = await getDoc(requestDocRef);
            if (docSnap.exists()) {
                setRequestStatus('requested');
            }
        };
        checkRequestStatus();
    }
  }, [user, loading, router]);
  
  const handleRequestAccess = async () => {
      if (!user) return;
      setRequestStatus('loading');
      try {
          const requestDocRef = doc(db, 'reportAccessRequests', user.uid);
          await setDoc(requestDocRef, {
              userId: user.uid,
              userEmail: user.email,
              status: 'pending',
              requestedAt: serverTimestamp(),
          });
          setRequestStatus('requested');
          toast({
              title: 'Solicitud Enviada',
              description: 'Tu solicitud ha sido enviada al administrador para su aprobación.'
          });
      } catch (error) {
          console.error("Error sending access request:", error);
          toast({
              title: 'Error',
              description: 'No se pudo enviar la solicitud. Inténtalo de nuevo.',
              variant: 'destructive'
          });
          setRequestStatus('idle');
      }
  }


  if (loading || !user || user.hasReportsAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5 flex items-center justify-center">
        <Card className="w-full max-w-xl mx-auto custom-shadow text-center">
          <CardHeader>
             <div className="flex justify-center items-center gap-4">
                <ShieldCheck className="h-12 w-12 text-primary" strokeWidth={1.5}/>
                <CardTitle className="text-3xl font-bold">Acceso Restringido</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             {requestStatus === 'requested' ? (
                <>
                    <div className="flex justify-center items-center gap-2">
                         <Clock className="h-5 w-5 text-muted-foreground"/>
                         <p className="font-semibold text-foreground">Solicitud Enviada</p>
                    </div>
                    <p className="text-muted-foreground">
                        Tu solicitud de acceso a <span className="font-semibold text-foreground">Customs Reports</span> está pendiente de aprobación.
                        <br/>
                        Recibirás una notificación cuando el administrador la haya procesado.
                    </p>
                </>
             ) : (
                <>
                    <p className="text-muted-foreground">
                      Para acceder a <span className="font-semibold text-foreground">Customs Reports</span>, necesitas la aprobación de un administrador.
                    </p>
                    <Button onClick={handleRequestAccess} disabled={requestStatus === 'loading'}>
                       {requestStatus === 'loading' ? (
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       ) : (
                           <Send className="mr-2 h-4 w-4" />
                       )}
                       {requestStatus === 'loading' ? 'Enviando...' : 'Solicitar Acceso'}
                    </Button>
                </>
             )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
