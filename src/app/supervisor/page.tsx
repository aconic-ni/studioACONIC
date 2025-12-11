
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, Briefcase, Database, PieChart } from 'lucide-react';

export default function SupervisorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || !['supervisor', 'admin'].includes(user.role || ''))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !['supervisor', 'admin'].includes(user.role || '')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Supervisor';

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-4xl mx-auto custom-shadow">
            <CardHeader className="text-center pb-4">
                <div className="flex justify-center items-center gap-3">
                    <Users className="h-10 w-10 text-primary" />
                    <CardTitle className="text-4xl font-bold">Panel de Supervisor</CardTitle>
                </div>
                <CardDescription className="text-lg text-muted-foreground">Bienvenido, {welcomeName}.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pt-4">
                <p className="text-center text-foreground">Seleccione un módulo para gestionar:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                     <Button asChild size="lg" className="h-24 text-lg bg-sky-600 hover:bg-sky-700">
                        <Link href="/agente/casos">
                            <Briefcase className="mr-3 h-6 w-6" />
                            Gestión de Casos
                        </Link>
                    </Button>
                    <Button asChild size="lg" className="h-24 text-lg">
                        <Link href="/executive">
                            <Briefcase className="mr-3 h-6 w-6" />
                            Módulo Ejecutivo
                        </Link>
                    </Button>
                    <Button asChild size="lg" className="h-24 text-lg">
                        <Link href="/thereporter">
                            <Users className="mr-3 h-6 w-6" />
                            Módulo Aforador
                        </Link>
                    </Button>
                     <Button asChild size="lg" className="h-24 text-lg bg-primary/90">
                        <Link href="/database">
                            <Database className="mr-3 h-6 w-6" />
                            Base de Datos (Previos)
                        </Link>
                    </Button>
                     <Button asChild size="lg" className="h-24 text-lg bg-primary/90">
                        <Link href="/databasePay">
                            <Database className="mr-3 h-6 w-6" />
                            Base de Datos (Pagos)
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-24 text-lg col-span-1 md:col-span-2">
                        <Link href="/dashboard">
                           <PieChart className="mr-3 h-6 w-6" />
                           Ver Dashboards
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
