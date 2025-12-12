
"use client";
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, AlertTriangle, FilePlus, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import type { LegalRequest } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";


export default function LegalSolicitudesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<LegalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LegalRequest | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    const requestsQuery = query(collection(db, "solicitudesLegales"), orderBy("requestedAt", "desc"));

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
        const fetchedRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LegalRequest));
        setRequests(fetchedRequests);
        setIsLoading(false);
    }, (err) => {
        console.error("Error fetching legal requests:", err);
        setError("No se pudieron cargar las solicitudes. Verifique los permisos de Firestore.");
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleStatusChange = async (requestId: string, newStatus: LegalRequest['status']) => {
    if (!user) return;
    const requestDocRef = doc(db, "solicitudesLegales", requestId);
    try {
        const updateData: any = { status: newStatus };
        if (newStatus === 'completado') {
            updateData.completedAt = Timestamp.now();
            updateData.completedBy = user.displayName || user.email;
        }
        await updateDoc(requestDocRef, updateData);
        toast({ title: "Estado Actualizado", description: "El estado de la solicitud ha sido cambiado." });
    } catch (error) {
        console.error("Error updating status:", error);
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => 
        req.ne.toLowerCase().includes(filter.toLowerCase()) ||
        req.consignee.toLowerCase().includes(filter.toLowerCase()) ||
        req.id.toLowerCase().includes(filter.toLowerCase())
    );
  }, [requests, filter]);

  const getStatusBadgeVariant = (status: LegalRequest['status']) => {
    switch (status) {
        case 'completado': return 'default';
        case 'rechazado': return 'destructive';
        case 'en_proceso': return 'secondary';
        default: return 'outline';
    }
  };

  const formatDate = (timestamp: Timestamp) => format(timestamp.toDate(), "dd/MM/yy HH:mm", { locale: es });
  
  const canUpdateStatus = user?.role === 'legal' || user?.role === 'admin';

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-7xl mx-auto custom-shadow">
          <CardHeader>
             <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-2xl font-semibold">Panel de Solicitudes Legales</CardTitle>
                    <CardDescription>Gestione las solicitudes de servicios legales pendientes.</CardDescription>
                </div>
                <Button asChild>
                    <Link href="/legal/request">
                        <FilePlus className="mr-2 h-4 w-4" />
                        Nueva Solicitud
                    </Link>
                </Button>
            </div>
            <div className="pt-4 mt-4 border-t">
                <Input 
                    placeholder="Buscar por NE, Consignatario o ID..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="max-w-sm"
                />
            </div>
          </CardHeader>
          <CardContent>
             {error && (
              <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center flex items-center justify-center gap-2">
                <AlertTriangle className="h-5 w-5"/> {error}
              </div>
            )}

            {!isLoading && filteredRequests.length === 0 && !error && (
               <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                <p className="mt-1 text-muted-foreground">No hay solicitudes que coincidan con su búsqueda.</p>
              </div>
            )}

            {!isLoading && filteredRequests.length > 0 && (
                <div className="overflow-x-auto table-container rounded-lg border mt-4">
                 <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead>NE</TableHead>
                            <TableHead>Consignatario</TableHead>
                            <TableHead>Fecha Solicitud</TableHead>
                            <TableHead>Solicitado Por</TableHead>
                            <TableHead>Servicios</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRequests.map((req) => (
                           <TableRow key={req.id}>
                               <TableCell className="font-medium">{req.ne}</TableCell>
                               <TableCell>{req.consignee}</TableCell>
                               <TableCell>{formatDate(req.requestedAt)}</TableCell>
                               <TableCell><Badge variant="outline">{req.requestedBy}</Badge></TableCell>
                               <TableCell>{req.services.map(s => s.serviceType).join(', ')}</TableCell>
                               <TableCell>
                                   {canUpdateStatus ? (
                                    <Select 
                                        value={req.status} 
                                        onValueChange={(value) => handleStatusChange(req.id, value as LegalRequest['status'])}
                                    >
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pendiente">Pendiente</SelectItem>
                                            <SelectItem value="en_proceso">En Proceso</SelectItem>
                                            <SelectItem value="completado">Completado</SelectItem>
                                            <SelectItem value="rechazado">Rechazado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                   ) : (
                                     <Badge variant={getStatusBadgeVariant(req.status)}>{req.status}</Badge>
                                   )}
                               </TableCell>
                               <TableCell className="text-right">
                                  <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(req)}>
                                      <Eye className="h-4 w-4" />
                                  </Button>
                               </TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                 </Table>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

       {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Detalles de Solicitud Legal</DialogTitle>
                    <DialogDescription>ID: {selectedRequest.id}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <h4 className="font-semibold text-sm">Servicios:</h4>
                        <ul className="list-disc list-inside pl-2 text-sm text-muted-foreground">
                            {selectedRequest.services.map((s, i) => <li key={i}>{s.serviceType} (x{s.quantity})</li>)}
                        </ul>
                    </div>
                     {selectedRequest.observations && (
                         <div>
                            <h4 className="font-semibold text-sm">Observaciones:</h4>
                            <p className="text-sm p-2 bg-muted rounded-md">{selectedRequest.observations}</p>
                         </div>
                     )}
                     <div>
                        <h4 className="font-semibold text-sm">Autorizado por Cliente:</h4>
                        <p className="text-sm">{selectedRequest.authorizedByClient ? 'Sí' : 'No'}</p>
                     </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

    </AppShell>
  );
}
