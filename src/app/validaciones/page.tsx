
"use client";
import { useState, useEffect, useMemo, type FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search, ShieldCheck, Trash2, Info as InfoIcon, CalendarDays, User, RotateCw } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp as FirestoreTimestamp, orderBy } from 'firebase/firestore';
import type { ValidacionRecord } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ValidacionesTableProps {
  validaciones: ValidacionRecord[];
  filterNeInput: string;
  setFilterNeInput: (value: string) => void;
  filterResolvedByInput: string;
  setFilterResolvedByInput: (value: string) => void;
  onRefresh: () => void;
}

const ValidacionesTable: React.FC<ValidacionesTableProps> = ({
  validaciones,
  filterNeInput,
  setFilterNeInput,
  filterResolvedByInput,
  setFilterResolvedByInput,
  onRefresh
}) => {
  if (validaciones.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No se encontraron validaciones con los criterios actuales.</p>;
  }

  return (
    <Card className="mt-6 w-full custom-shadow">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Historial de Validaciones de Duplicados</CardTitle>
        <CardDescription className="text-muted-foreground">Se encontraron {validaciones.length} registro(s) de validación.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto table-container rounded-lg border">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  <Button variant="ghost" size="icon" onClick={onRefresh} className="h-6 w-6 p-0 mr-1">
                      <RotateCw className="h-4 w-4 text-primary" />
                  </Button>
                  ID Validación
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  NE Afectado
                  <Input
                    type="text"
                    placeholder="Filtrar NE..."
                    value={filterNeInput}
                    onChange={(e) => setFilterNeInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  IDs Implicados
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Usuario Resolución
                  <Input
                    type="text"
                    placeholder="Filtrar Usuario..."
                    value={filterResolvedByInput}
                    onChange={(e) => setFilterResolvedByInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Fecha y Hora Resolución
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Estado Resolución
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-y divide-border">
              {validaciones.map((validacion) => (
                <TableRow key={validacion.id} className="hover:bg-muted/50">
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{validacion.id}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{validacion.ne || validacion.duplicateKey.split('-')[0]}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                     <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <span className="cursor-help underline decoration-dashed decoration-muted-foreground/50">
                                {validacion.duplicateIds.length} ID(s)
                             </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md text-xs">
                            <p className="font-semibold mb-1">IDs Implicados:</p>
                            <ul className="list-disc list-inside">
                                {validacion.duplicateIds.map(id => <li key={id}>{id}</li>)}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{validacion.resolvedBy}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {validacion.resolvedAt instanceof Date
                      ? format(validacion.resolvedAt, "dd/MM/yyyy HH:mm:ss", { locale: es })
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                    {validacion.resolutionStatus === 'validated_not_duplicate' ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-200 flex items-center">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1"/> Validado (No Duplicado)
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 flex items-center">
                        <Trash2 className="h-3.5 w-3.5 mr-1"/> Solicitud Eliminación
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};


export default function ValidacionesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedValidaciones, setFetchedValidaciones] = useState<ValidacionRecord[] | null>(null);
  const [isClient, setIsClient] = useState(false);

  const [filterNeInput, setFilterNeInput] = useState('');
  const [filterResolvedByInput, setFilterResolvedByInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleFetchValidaciones = useCallback(async (event?: FormEvent) => {
    if (event) event.preventDefault();
    const currentRole = user?.role;
    if (currentRole === 'autorevisor' || currentRole === 'autorevisor_plus') {
        setError("No tiene permisos para acceder a esta sección.");
        setFetchedValidaciones([]);
        return;
    }

    setIsLoading(true);
    setError(null);
    setFetchedValidaciones(null);

    const validacionesCollectionRef = collection(db, "Validaciones");
    const q = query(validacionesCollectionRef, orderBy("resolvedAt", "desc"));

    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs.map(docSnap => {
          const docData = docSnap.data();
          return {
            id: docSnap.id,
            ...docData,
            resolvedAt: docData.resolvedAt instanceof FirestoreTimestamp ? docData.resolvedAt.toDate() : new Date(),
          } as ValidacionRecord;
        });
        setFetchedValidaciones(data);
      } else {
        setFetchedValidaciones([]); 
      }
    } catch (err: any) {
      console.error("Error fetching validaciones: ", err);
      setError("Error al cargar las validaciones. Intente de nuevo.");
      setFetchedValidaciones([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isClient && !authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      // Roles allowed to see this page
      const allowedRoles = ['revisor', 'calificador', 'admin'];
      if (user.role && allowedRoles.includes(user.role)) {
        handleFetchValidaciones();
      } else {
        setError("No tiene permisos para acceder a esta sección.");
        setFetchedValidaciones([]);
      }
    }
  }, [user, authLoading, router, isClient, handleFetchValidaciones]);

  const displayedValidaciones = useMemo(() => {
    if (!fetchedValidaciones) return null;
    let filteredData = [...fetchedValidaciones];

    if (filterNeInput.trim()) {
      const term = filterNeInput.toLowerCase().trim();
      filteredData = filteredData.filter(v => (v.ne || v.duplicateKey.split('-')[0]).toLowerCase().includes(term));
    }
    if (filterResolvedByInput.trim()) {
      const term = filterResolvedByInput.toLowerCase().trim();
      filteredData = filteredData.filter(v => v.resolvedBy.toLowerCase().includes(term));
    }
     if (searchTerm.trim()) {
      const globalTerm = searchTerm.toLowerCase().trim();
      filteredData = filteredData.filter(v =>
        (v.id?.toLowerCase().includes(globalTerm)) ||
        (v.ne || v.duplicateKey.split('-')[0]).toLowerCase().includes(globalTerm) ||
        (v.resolvedBy.toLowerCase().includes(globalTerm)) ||
        (v.duplicateIds.some(id => id.toLowerCase().includes(globalTerm))) ||
        (v.resolutionStatus.toLowerCase().includes(globalTerm))
      );
    }
    return filteredData;
  }, [fetchedValidaciones, filterNeInput, filterResolvedByInput, searchTerm]);


  if (!isClient || authLoading) {
    return <div className="min-h-screen flex items-center justify-center grid-bg"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>;
  }

  const isUnauthorized = user?.role === 'autorevisor' || user?.role === 'autorevisor_plus' || (!user?.role && !authLoading);
  if (isUnauthorized) { 
    return (
      <AppShell>
        <div className="py-2 md:py-5">
          <Card className="w-full custom-shadow">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-destructive">Acceso Denegado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{error || "No tiene permisos para acceder a esta sección."}</p>
              <Button onClick={() => router.push('/')} className="mt-4">Volver al Inicio</Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Consulta de Validaciones</CardTitle>
            <CardDescription className="text-muted-foreground">
              Visualice el historial de resoluciones para alertas de duplicados.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <form onSubmit={(e) => handleFetchValidaciones(e)} className="space-y-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Input
                        type="text"
                        placeholder="Búsqueda general en validaciones..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-grow"
                    />
                    <Button type="submit" className="btn-primary w-full sm:w-auto" disabled={isLoading}>
                        <Search className="mr-2 h-4 w-4" /> {isLoading ? 'Buscando...' : 'Buscar Validaciones'}
                    </Button>
                </div>
            </form>
            {isLoading && <div className="flex justify-center items-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Cargando validaciones...</p></div>}
            {error && !isLoading && <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">{error}</div>}

            {displayedValidaciones && !isLoading && (
              <ValidacionesTable
                validaciones={displayedValidaciones}
                filterNeInput={filterNeInput}
                setFilterNeInput={setFilterNeInput}
                filterResolvedByInput={filterResolvedByInput}
                setFilterResolvedByInput={setFilterResolvedByInput}
                onRefresh={handleFetchValidaciones}
              />
            )}
            {fetchedValidaciones && fetchedValidaciones.length === 0 && !isLoading && !error && (
              <div className="mt-4 p-4 bg-yellow-500/10 text-yellow-700 border border-yellow-500/30 rounded-md text-center">
                No se encontraron registros de validaciones.
              </div>
            )}
             {!fetchedValidaciones && !isLoading && !error && (
                <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">
                    Realice una búsqueda para ver el historial de validaciones.
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
