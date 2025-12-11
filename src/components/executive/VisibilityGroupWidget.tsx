
"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Users, Mail, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '../ui/scroll-area';

export function VisibilityGroupWidget() {
    const { user } = useAuth();

    if (!user || user.role !== 'ejecutivo' || !user.visibilityGroup || user.visibilityGroup.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="default"
                        className="rounded-full h-14 w-14 shadow-lg bg-primary hover:bg-primary/90 transition-transform hover:scale-105"
                        aria-label="Ver grupo de visibilidad"
                    >
                        <Users className="h-6 w-6" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top" align="end">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Grupo de Visibilidad</h4>
                            <p className="text-sm text-muted-foreground">
                                Ve las solicitudes de estos usuarios.
                            </p>
                        </div>
                        <ScrollArea className="h-64">
                            <div className="space-y-3 pr-3">
                                {user.visibilityGroup.map(member => (
                                    <div key={member.uid} className="p-2 border rounded-md bg-secondary/50">
                                        <div className="text-sm font-semibold flex items-center gap-2">
                                            <User className="h-4 w-4 text-primary"/>
                                            {member.displayName}
                                            {member.uid === user.uid && <Badge variant="outline" className="text-xs">Tú</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                            <Mail className="h-3 w-3"/>
                                            {member.email}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}