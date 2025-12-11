

"use client";

import { useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, Timestamp, query, getDocs } from 'firebase/firestore';
import type { AppUser, UserRole } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Users, FolderKanban, Edit } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ExecutiveGroupModal } from './ExecutiveGroupModal';
import { ConsigneeDirectoryModal } from './ConsigneeDirectoryModal';
import { AgentDetailsModal } from './AgentDetailsModal';

interface UserManagementTableProps {
  initialUsers: AppUser[];
}

const userRoles: UserRole[] = ['admin', 'coordinadora', 'ejecutivo', 'gestor', 'aforador', 'agente', 'supervisor', 'digitador', 'revisor', 'calificador', 'autorevisor', 'autorevisor_plus', 'invitado', 'facturador'];

export function UserManagementTable({ initialUsers }: UserManagementTableProps) {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [savingState, setSavingState] = useState<{ [uid: string]: boolean }>({});
  const [filter, setFilter] = useState('');
  const [selectedUserForGroup, setSelectedUserForGroup] = useState<AppUser | null>(null);
  const [selectedUserForDirectory, setSelectedUserForDirectory] = useState<AppUser | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AppUser | null>(null);

  const handleUpdate = useCallback(async (uid: string, field: keyof AppUser, value: any) => {
    if (!adminUser || adminUser.role !== 'admin') {
      toast({ title: "Acción no permitida", variant: "destructive" });
      return;
    }
    if (uid === adminUser.uid && (field === 'role' || field === 'hasReportsAccess' || field === 'hasPaymentAccess')) {
       toast({ title: "Acción no permitida", description: "No puede modificar sus propios permisos.", variant: "destructive" });
       return;
    }

    setSavingState(prev => ({ ...prev, [uid]: true }));

    const userDocRef = doc(db, 'users', uid);
    try {
      await updateDoc(userDocRef, { [field]: value });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, [field]: value } : u));
      toast({ title: "Usuario Actualizado", description: `El campo ${String(field)} ha sido modificado.` });
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: "Error", description: "No se pudo actualizar el usuario.", variant: "destructive" });
    } finally {
      setSavingState(prev => ({ ...prev, [uid]: false }));
    }
  }, [adminUser, toast]);

  const fetchAllUsers = async () => {
     const usersQuery = query(collection(db, 'users'));
     const usersSnapshot = await getDocs(usersQuery);
     const fetchedUsers = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
     setUsers(fetchedUsers);
  }
  
  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(filter.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(filter.toLowerCase())
  ).sort((a,b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));

  return (
    <div className="space-y-4">
        <Input 
            placeholder="Filtrar por nombre o email..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
        />
        <div className="overflow-x-auto table-container rounded-lg border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Acceso Reportes</TableHead>
                    <TableHead>Acceso Pagos</TableHead>
                    <TableHead>Acciones de Rol</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredUsers.map((user) => (
                <TableRow key={user.uid} className={savingState[user.uid] ? "bg-amber-100" : ""}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.displayName || 'N/A'}</TableCell>
                    <TableCell>
                        <Select
                            value={user.role || ''}
                            onValueChange={(value: UserRole) => handleUpdate(user.uid, 'role', value)}
                            disabled={savingState[user.uid]}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Seleccionar rol..." />
                            </SelectTrigger>
                            <SelectContent>
                                {userRoles.map(role => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                             <Switch
                                checked={user.hasReportsAccess || false}
                                onCheckedChange={(checked) => handleUpdate(user.uid, 'hasReportsAccess', checked)}
                                disabled={savingState[user.uid]}
                            />
                            {savingState[user.uid] && <Loader2 className="h-4 w-4 animate-spin"/>}
                        </div>
                    </TableCell>
                     <TableCell>
                        <div className="flex items-center gap-2">
                             <Switch
                                checked={user.hasPaymentAccess || false}
                                onCheckedChange={(checked) => handleUpdate(user.uid, 'hasPaymentAccess', checked)}
                                disabled={savingState[user.uid]}
                            />
                            {savingState[user.uid] && <Loader2 className="h-4 w-4 animate-spin"/>}
                        </div>
                    </TableCell>
                    <TableCell>
                         {user.role === 'ejecutivo' && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedUserForGroup(user)}>
                                <Users className="mr-2 h-4 w-4" /> Grupo
                            </Button>
                        )}
                        {user.role === 'invitado' && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedUserForDirectory(user)}>
                                <FolderKanban className="mr-2 h-4 w-4" /> Directorio
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setSelectedAgent(user)} className="ml-2">
                            <Edit className="mr-2 h-4 w-4" /> Editar
                        </Button>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
        </Table>
        </div>
        {selectedUserForGroup && (
            <ExecutiveGroupModal
                isOpen={!!selectedUserForGroup}
                onClose={() => setSelectedUserForGroup(null)}
                allUsers={users}
                onGroupUpdated={fetchAllUsers}
                currentUser={selectedUserForGroup}
            />
        )}
        {selectedUserForDirectory && (
            <ConsigneeDirectoryModal
                isOpen={!!selectedUserForDirectory}
                onClose={() => setSelectedUserForDirectory(null)}
                guestUser={selectedUserForDirectory}
            />
        )}
        {selectedAgent && (
            <AgentDetailsModal
                isOpen={!!selectedAgent}
                onClose={() => setSelectedAgent(null)}
                user={selectedAgent}
                onUserUpdated={fetchAllUsers}
            />
        )}
    </div>
  );
}





