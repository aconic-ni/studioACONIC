"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Scale, Briefcase, Users, FileSpreadsheet, GitBranch, Banknote } from 'lucide-react';

export default function LegalPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Define allowed roles for this page
  const allowedRoles = ['legal', 'admin'];

  useEffect(() => {
    if (!authLoading && (!user || !allowedRoles.includes(user.role || ''))) {
      router.push('/');
    }
  }, [user, authLoading, router, allowedRoles]);

  if (authLoading || !user || !allowedRoles.includes(user.role || '')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Usuario';

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-5xl mx-auto custom-shadow">
            <CardHeader className="text-center pb-4">
                <div className="flex justify-center items-center gap-3">
                    <Scale className="h-10 w-10 text-primary" />
                    <CardTitle className="text-4xl font-bold">Panel Legal</CardTitle>
                </div>
                <CardDescription className="text-lg text-muted-foreground">Bienvenido, {welcomeName}. Gestione las solicitudes y módulos desde aquí.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pt-4">
                <p className="text-center text-foreground">Seleccione un módulo para continuar:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                    <Button asChild size="lg" className="h-20 text-lg bg-primary/90">
                        <Link href="/legal/solicitudes">
                           <FileSpreadsheet className="mr-3 h-6 w-6" />
                           Solicitudes Legales
                        </Link>
                    </Button>
                     <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/executive">
                           <Briefcase className="mr-3 h-6 w-6" />
                           Módulo Ejecutivo
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/thereporter">
                           <Users className="mr-3 h-6 w-6" />
                           Módulo Aforo
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/databasePay">
                           <Banknote className="mr-3 h-6 w-6" />
                           Base de Datos (Pagos)
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/permisos">
                           <GitBranch className="mr-3 h-6 w-6" />
                           Gestión de Permisos
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
