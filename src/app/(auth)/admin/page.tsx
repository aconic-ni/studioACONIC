
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Shield, Wrench, Users, FileSpreadsheet, ListTodo, FilePlus, ShieldCheck, UserCog, Bell, Briefcase, PieChart } from 'lucide-react';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Admin';

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-5xl mx-auto custom-shadow">
            <CardHeader className="text-center pb-4">
                <div className="flex justify-center items-center gap-3">
                    <Shield className="h-10 w-10 text-primary" />
                    <CardTitle className="text-4xl font-bold">Panel de Administrador</CardTitle>
                </div>
                <CardDescription className="text-lg text-muted-foreground">Bienvenido, {welcomeName}. Gestione el sistema desde aquí.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pt-4">
                <p className="text-center text-foreground">Seleccione un módulo para continuar:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                     <Button asChild size="lg" className="h-20 text-lg">
                        <Link href="/admin/control">
                            <Wrench className="mr-3 h-6 w-6" />
                            Control de Registros
                        </Link>
                    </Button>
                    <Button asChild size="lg" className="h-20 text-lg bg-primary/90">
                        <Link href="/admin/authorize">
                            <ShieldCheck className="mr-3 h-6 w-6" />
                            Autorizar Accesos
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/assignments">
                           <ListTodo className="mr-3 h-6 w-6" />
                           Asignaciones
                        </Link>
                    </Button>
                     <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/executive">
                           <UserCog className="mr-3 h-6 w-6" />
                           Módulo Ejecutivo
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/examiner">
                           <Users className="mr-3 h-6 w-6" />
                           Módulo Gestor
                        </Link>
                    </Button>
                     <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/thereporter">
                           <Briefcase className="mr-3 h-6 w-6" />
                           Módulo Aforo
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/notificaciones">
                           <Bell className="mr-3 h-6 w-6" />
                           Rectificaciones
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/reports">
                           <FileSpreadsheet className="mr-3 h-6 w-6" />
                           Reportes Previos
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-20 text-lg">
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
