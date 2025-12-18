"use client";
import React from 'react';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface ExecutiveTableHeaderProps {
    columnFilters: {
        ne: string;
        ejecutivo: string;
        consignatario: string;
        factura: string;
        selectividad: string;
        incidentType: string;
    };
    setColumnFilters: React.Dispatch<React.SetStateAction<{
        ne: string;
        ejecutivo: string;
        consignatario: string;
        factura: string;
        selectividad: string;
        incidentType: string;
    }>>;
    onSearch: () => void;
    onSelectAllRows: () => void;
    areAllSelected: boolean;
}

export function ExecutiveTableHeader({
    columnFilters,
    setColumnFilters,
    onSearch,
    onSelectAllRows,
    areAllSelected
}: ExecutiveTableHeaderProps) {
    const handleFilterChange = (key: keyof typeof columnFilters, value: string) => {
        setColumnFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onSearch();
        }
    };

    return (
        <TableHeader>
            <TableRow>
                <TableHead className="w-12">
                    <Checkbox
                        checked={areAllSelected}
                        onCheckedChange={onSelectAllRows}
                        aria-label="Seleccionar todas las filas"
                    />
                </TableHead>
                <TableHead>Acciones</TableHead>
                <TableHead><Input placeholder="NE..." className="h-8 text-xs" value={columnFilters.ne} onChange={e => handleFilterChange('ne', e.target.value)} onKeyDown={handleKeyDown} /></TableHead>
                <TableHead>Insignias</TableHead>
                <TableHead><Input placeholder="Ejecutivo..." className="h-8 text-xs" value={columnFilters.ejecutivo} onChange={e => handleFilterChange('ejecutivo', e.target.value)} onKeyDown={handleKeyDown} /></TableHead>
                <TableHead><Input placeholder="Consignatario..." className="h-8 text-xs" value={columnFilters.consignatario} onChange={e => handleFilterChange('consignatario', e.target.value)} onKeyDown={handleKeyDown} /></TableHead>
                <TableHead><Input placeholder="Factura..." className="h-8 text-xs" value={columnFilters.factura} onChange={e => handleFilterChange('factura', e.target.value)} onKeyDown={handleKeyDown} /></TableHead>
                <TableHead>Estado General</TableHead>
                <TableHead>Preliquidación</TableHead>
                <TableHead><Input placeholder="Selectividad..." className="h-8 text-xs" value={columnFilters.selectividad} onChange={e => handleFilterChange('selectividad', e.target.value)} onKeyDown={handleKeyDown} /></TableHead>
                <TableHead>Fecha Despacho</TableHead>
                <TableHead><Input placeholder="Incidencia..." className="h-8 text-xs" value={columnFilters.incidentType} onChange={e => handleFilterChange('incidentType', e.target.value)} onKeyDown={handleKeyDown} /></TableHead>
                <TableHead>Facturado</TableHead>
            </TableRow>
        </TableHeader>
    );
}
