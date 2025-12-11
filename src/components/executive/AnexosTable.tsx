"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import type { WorksheetWithCase } from '@/types';
import { Loader2, Search, Calendar, CalendarRange } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import type { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../reports/DatePicker';

type DateFilterType = 'range' | 'specific';


export function AnexosTable() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [anexos, setAnexos] = useState<WorksheetWithCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [neFilter, setNeFilter] = useState('');
    const [consigneeFilter, setConsigneeFilter] = useState('');
    const [dateFilterType, setDateFilterType] = useState<DateFilterType>('range');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [specificDate, setSpecificDate] = useState<Date | undefined>();
    const [isSearchActive, setIsSearchActive] = useState(false);

    useEffect(() => {
        if (!user) return;
        setIsLoading(true);

        const aforoQuery = query(
            collection(db, 'AforoCases'), 
            where('worksheet.worksheetType', 'in', ['anexo_5', 'anexo_7']),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(aforoQuery, (snapshot) => {
            const cases = snapshot.docs.map(doc => doc.data() as WorksheetWithCase);
            setAnexos(cases);
            setIsLoading(false);
        }, error => {
            console.error("Error fetching Anexos:", error);
            toast({ title: "Error", description: "No se pudieron cargar los anexos.", variant: "destructive" });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    const filteredAnexos = useMemo(() => {
        if (!isSearchActive) return [];

        return anexos.filter(anexo => {
            let dateMatch = true;
            if (dateFilterType === 'range' && dateRange?.from) {
                 const start = startOfDay(dateRange.from);
                 const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(start);
                 dateMatch = anexo.createdAt && anexo.createdAt.toDate() >= start && anexo.createdAt.toDate() <= end;
            } else if (dateFilterType === 'specific' && specificDate) {
                 const start = startOfDay(specificDate);
                 const end = endOfDay(specificDate);
                 dateMatch = anexo.createdAt && anexo.createdAt.toDate() >= start && anexo.createdAt.toDate() <= end;
            }

            const neMatch = neFilter ? anexo.ne.toLowerCase().includes(neFilter.toLowerCase()) : true;
            const consigneeMatch = consigneeFilter ? anexo.consignee.toLowerCase().includes(consigneeFilter.toLowerCase()) : true;

            return dateMatch && neMatch && consigneeMatch;
        }).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    }, [anexos, isSearchActive, neFilter, consigneeFilter, dateRange, specificDate, dateFilterType]);

    const handleSearch = () => {
        setIsSearchActive(true);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 p-4 border rounded-lg bg-card">
                 <div className="flex flex-wrap items-center gap-2">
                    <Input placeholder="Filtrar por NE..." value={neFilter} onChange={e => setNeFilter(e.target.value)} className="max-w-xs" />
                    <Input placeholder="Filtrar por Consignatario..." value={consigneeFilter} onChange={e => setConsigneeFilter(e.target.value)} className="max-w-xs" />
                    <Select value={dateFilterType} onValueChange={v => setDateFilterType(v as DateFilterType)}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="range"><CalendarRange className="mr-2 h-4 w-4 inline"/>Rango de Fechas</SelectItem>
                            <SelectItem value="specific"><Calendar className="mr-2 h-4 w-4 inline"/>Fecha Específica</SelectItem>
                        </SelectContent>
                    </Select>
                     {dateFilterType === 'range' && <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
                     {dateFilterType === 'specific' && <DatePicker date={specificDate} onDateChange={setSpecificDate} />}
                    <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Buscar Anexos</Button>
                </div>
            </div>

            {isSearchActive && (
                <>
                    {filteredAnexos.length > 0 ? (
                        <div className="overflow-x-auto table-container rounded-lg border">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>NE</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Consignatario</TableHead>
                                <TableHead>Ejecutivo</TableHead>
                                <TableHead>Fecha Creación</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {filteredAnexos.map((anexo) => (
                                <TableRow key={anexo.id}>
                                <TableCell>{anexo.ne}</TableCell>
                                <TableCell>{anexo.worksheet?.worksheetType}</TableCell>
                                <TableCell>{anexo.consignee}</TableCell>
                                <TableCell>{anexo.executive}</TableCell>
                                <TableCell>{anexo.createdAt ? format(anexo.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-10">No se encontraron anexos con los filtros actuales.</p>
                    )}
                </>
            )}
        </div>
    );
}
