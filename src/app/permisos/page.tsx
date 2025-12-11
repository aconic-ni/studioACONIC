
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, SlidersHorizontal, MessageSquare } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp, where, type Query, getDocs, collectionGroup } from 'firebase/firestore';
import type { Worksheet, RequiredPermit, AppUser } from '@/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePermitCard } from '@/components/permisos/MobilePermitCard';
import { PermitCommentModal } from '@/components/executive/PermitCommentModal';


export interface PermitRow extends RequiredPermit {
  ne: string;
  reference?: string;
  executive: string;
  consignee?: string;
}

const formatDate = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return format(date, 'dd/MM/yy', { locale: es });
};

export default function PermisosPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  
  const [allPermits, setAllPermits] = useState<PermitRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusMode, setFocusMode] = useState(true);
  const [userConsigneeDirectory, setUserConsigneeDirectory] = useState<string[]>([]);
  const [selectedPermitForComment, setSelectedPermitForComment] = useState<PermitRow | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !user.email) return;

    const handleSnapshot = (snapshot: any) => {
        const fetchedPermits: PermitRow[] = [];
        snapshot.forEach((doc: any) => {
            const worksheet = doc.data() as Worksheet;
            if (worksheet.requiredPermits && worksheet.requiredPermits.length > 0) {
                worksheet.requiredPermits.forEach(permit => {
                    fetchedPermits.push({
                        ...permit,
                        ne: worksheet.ne,
                        reference: worksheet.reference,
                        executive: worksheet.executive,
                        consignee: worksheet.consignee,
                    });
                });
            }
        });
        setAllPermits(fetchedPermits);
        setIsLoading(false);
    };

    const handleError = (error: any) => {
        console.error("Error fetching permits from worksheets:", error);
        setIsLoading(false);
    };

    const fetchGroupEmailsAndQuery = async () => {
        setIsLoading(true);
        const worksheetsRef = collection(db, 'worksheets');
        let q: Query;
        
        if (user.role === 'admin' || user.role === 'supervisor' || user.role === 'coordinadora') {
            q = query(worksheetsRef, orderBy('createdAt', 'desc'));
        } else if (user.role === 'ejecutivo' && user.visibilityGroup && user.visibilityGroup.length > 0) {
            const uidsToQuery = Array.from(new Set([user.uid, ...user.visibilityGroup]));
            
            const usersQuery = query(collection(db, 'users'), where('__name__', 'in', uidsToQuery));
            const userDocs = await getDocs(usersQuery);
            const groupEmails = userDocs.docs.map(d => d.data().email).filter(Boolean);
            
            if (groupEmails.length > 0) {
                 q = query(worksheetsRef, where('createdBy', 'in', groupEmails), orderBy('createdAt', 'desc'));
            } else {
                 q = query(worksheetsRef, where('createdBy', '==', user.email), orderBy('createdAt', 'desc'));
            }
        } else if (user.role === 'invitado') {
             const dirRef = collection(db, `users/${user.uid}/consigneeDirectory`);
             const dirSnap = await getDocs(dirRef);
             const directoryNames = dirSnap.docs.map(d => d.data().name);
             setUserConsigneeDirectory(directoryNames);
             if (directoryNames.length > 0) {
                q = query(worksheetsRef, where('consignee', 'in', directoryNames), orderBy('createdAt', 'desc'));
             } else {
                setAllPermits([]);
                setIsLoading(false);
                return () => {}; // Return an empty unsubscribe function
             }
        } else {
            q = query(worksheetsRef, where('createdBy', '==', user.email), orderBy('createdAt', 'desc'));
        }
        
        return onSnapshot(q, handleSnapshot, handleError);
    };
    
    const unsubscribePromise = fetchGroupEmailsAndQuery();
    return () => { unsubscribePromise.then(unsub => unsub()); };
  }, [user]);

  const filteredPermits = useMemo(() => {
    let filtered = allPermits;
    
    if (focusMode) {
      filtered = filtered.filter(p => p.status !== 'Entregado');
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.ne.toLowerCase().includes(lowercasedTerm) ||
        p.reference?.toLowerCase().includes(lowercasedTerm) ||
        p.facturaNumber?.toLowerCase().includes(lowercasedTerm) ||
        p.executive.toLowerCase().includes(lowercasedTerm) ||
        (p.assignedExecutive && p.assignedExecutive.toLowerCase().includes(lowercasedTerm)) ||
        p.name.toLowerCase().includes(lowercasedTerm) ||
        p.consignee?.toLowerCase().includes(lowercasedTerm)
      );
    }
    
    const statusOrder = { 'Pendiente': 1, 'En Trámite': 2, 'Rechazado': 3, 'Entregado': 4 };
    filtered.sort((a, b) => (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5));

    return filtered;
  }, [allPermits, searchTerm, focusMode]);
  
  const getStatusBadgeVariant = (status: RequiredPermit['status']) => {
    switch (status) {
        case 'Entregado': return 'default';
        case 'Rechazado': return 'destructive';
        case 'En Trámite': return 'secondary';
        case 'Pendiente':
        default:
            return 'outline';
    }
  }

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  const content = () => {
    if (isLoading) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    if (filteredPermits.length === 0) {
        return <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg"><p className="mt-1 text-muted-foreground">No se encontraron permisos con los filtros actuales.</p></div>;
    }
    
    if (isMobile) {
        return (
            <div className="space-y-4">
                {filteredPermits.map(permit => (
                    <MobilePermitCard 
                        key={permit.id} 
                        permit={permit} 
                        getStatusBadgeVariant={getStatusBadgeVariant} 
                    />
                ))}
            </div>
        );
    }
    
    return (
        <div className="overflow-x-auto table-container rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NE</TableHead>
                  <TableHead>Consignatario</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Factura Asociada</TableHead>
                  <TableHead>Permiso</TableHead>
                  <TableHead>Tipo de Trámite</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ejecutivo Asignado</TableHead>
                  <TableHead>Fecha Sometido</TableHead>
                  <TableHead>Fecha Entrega Estimada</TableHead>
                  <TableHead>Comentarios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermits.map(permit => (
                  <TableRow key={permit.id}>
                    <TableCell className="font-medium">{permit.ne}</TableCell>
                    <TableCell>{permit.consignee}</TableCell>
                    <TableCell>{permit.reference || 'N/A'}</TableCell>
                    <TableCell>{permit.facturaNumber || 'N/A'}</TableCell>
                    <TableCell>{permit.name}</TableCell>
                    <TableCell>{permit.tipoTramite || 'N/A'}</TableCell>
                    <TableCell>
                       <Badge variant={getStatusBadgeVariant(permit.status)}>{permit.status}</Badge>
                    </TableCell>
                    <TableCell>{permit.assignedExecutive || permit.executive}</TableCell>
                    <TableCell>{formatDate(permit.tramiteDate)}</TableCell>
                    <TableCell>{formatDate(permit.estimatedDeliveryDate)}</TableCell>
                    <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedPermitForComment(permit)}>
                            <MessageSquare className="h-4 w-4" />
                             {permit.comments && permit.comments.length > 0 && (
                                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 justify-center text-xs">{permit.comments.length}</Badge>
                            )}
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
    );
  };

  return (
    <>
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-7xl mx-auto custom-shadow">
          <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-semibold">Gestión de Permisos</CardTitle>
                    <CardDescription>Seguimiento del estado de todos los permisos requeridos.</CardDescription>
                </div>
                 <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por NE, Referencia, Factura, Ejecutivo, Permiso o Consignatario..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
            </div>
             <div className="flex items-center space-x-4 pt-4 border-t mt-4">
                <Button 
                    variant={focusMode ? 'secondary' : 'ghost'} 
                    onClick={() => setFocusMode(!focusMode)}
                >
                    <SlidersHorizontal className="mr-2 h-4 w-4"/>
                    {focusMode ? 'Pendientes' : 'Viendo Todos'}
                </Button>
                <p className="text-sm text-muted-foreground">
                    Total de permisos: {filteredPermits.length}
                </p>
            </div>
          </CardHeader>
          <CardContent>
            {content()}
          </CardContent>
        </Card>
      </div>
    </AppShell>
    {selectedPermitForComment && (
        <PermitCommentModal
            isOpen={!!selectedPermitForComment}
            onClose={() => setSelectedPermitForComment(null)}
            permit={selectedPermitForComment}
            worksheetId={selectedPermitForComment.ne}
            onCommentsUpdate={(newComments) => {
                 setAllPermits(prev => prev.map(p => p.id === selectedPermitForComment.id ? {...p, comments: newComments} : p));
            }}
        />
    )}
    </>
  );
}
