
"use client";
import { useState, useMemo, useCallback } from 'react';
import type { AforoCase } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { DatePicker } from '@/components/reports/DatePicker';
import { getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { AforoPieChartCard } from './AforoPieChartCard';


interface AforoDashboardProps {
    allCases: AforoCase[];
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

export function AforoDashboard({ allCases }: AforoDashboardProps) {
    const [filterType, setFilterType] = useState<'all' | 'range' | 'month' | 'year' | 'specific'>('year');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [specificDate, setSpecificDate] = useState<Date | undefined>();
    const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()));
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);

    const filteredCases = useMemo(() => {
        let examsToProcess: AforoCase[] = [];

        const filterCases = (start: Date, end: Date) => {
            return allCases.filter(c => {
                const caseDate = (c.createdAt as Timestamp)?.toDate();
                return caseDate && caseDate >= start && caseDate <= end;
            });
        };

        if (filterType === 'all') {
            examsToProcess = allCases;
        } else if (filterType === 'range' && dateRange?.from) {
            const start = dateRange.from;
            const end = dateRange.to || new Date();
            end.setHours(23, 59, 59, 999);
            examsToProcess = filterCases(start, end);
        } else if (filterType === 'month') {
            const start = startOfMonth(new Date(selectedYear, selectedMonth));
            const end = endOfMonth(new Date(selectedYear, selectedMonth));
            examsToProcess = filterCases(start, end);
        } else if (filterType === 'year') {
            const start = startOfYear(new Date(selectedYear, 0, 1));
            const end = endOfYear(new Date(selectedYear, 11, 31));
            examsToProcess = filterCases(start, end);
        } else if (filterType === 'specific' && specificDate) {
            const start = new Date(specificDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(specificDate);
            end.setHours(23, 59, 59, 999);
            examsToProcess = filterCases(start, end);
        }
        return examsToProcess;
    }, [allCases, filterType, dateRange, selectedMonth, selectedYear, specificDate]);


    const aforoData = useMemo(() => {
        const aforadorStats: { [key: string]: { assigned: number; readyForReview: number; revalidated: number } } = {};

        filteredCases.forEach(c => {
            const aforadorName = c.aforador || 'Sin Asignar';
            if (!aforadorStats[aforadorName]) {
                aforadorStats[aforadorName] = { assigned: 0, readyForReview: 0, revalidated: 0 };
            }

            aforadorStats[aforadorName].assigned += 1;

            if (c.aforadorStatus === 'En revisión') {
                aforadorStats[aforadorName].readyForReview += 1;
            }

            if (c.revisorStatus === 'Revalidación Solicitada') {
                aforadorStats[aforadorName].revalidated += 1;
            }
        });
        
        const assignedData = Object.entries(aforadorStats).map(([name, data]) => ({ name, value: data.assigned }));
        const readyForReviewData = Object.entries(aforadorStats).map(([name, data]) => ({ name, value: data.readyForReview }));
        const revalidatedData = Object.entries(aforadorStats).map(([name, data]) => ({ name, value: data.revalidated }));

        return { assignedData, readyForReviewData, revalidatedData };

    }, [filteredCases]);

    const digitacionData = useMemo(() => {
        const digitadorStats: { [key: string]: { assigned: number; liquidated: number; stored: number } } = {};

        filteredCases.forEach(c => {
            const digitadorName = c.digitadorAsignado || 'Sin Asignar';
             if (!digitadorStats[digitadorName]) {
                digitadorStats[digitadorName] = { assigned: 0, liquidated: 0, stored: 0 };
            }

            // Count assigned cases for digitization
            if (c.digitadorAsignado) {
                digitadorStats[digitadorName].assigned += 1;
            }

            // Count liquidated cases (those with a declaration number)
            if (c.declaracionAduanera) {
                 digitadorStats[digitadorName].liquidated += 1;
            }
            
            // Count stored cases
            if (c.digitacionStatus === 'Almacenado') {
                 digitadorStats[digitadorName].stored += 1;
            }
        });

        const assignedData = Object.entries(digitadorStats).map(([name, data]) => ({ name, value: data.assigned }));
        const liquidatedData = Object.entries(digitadorStats).map(([name, data]) => ({ name, value: data.liquidated }));
        const storedData = Object.entries(digitadorStats).map(([name, data]) => ({ name, value: data.stored }));

        return { assignedData, liquidatedData, storedData };
    }, [filteredCases]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Dashboard de Operaciones (Aforo & Digitación)</CardTitle>
                    <CardDescription>Resumen interactivo de la actividad de casos.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                    <Select value={filterType} onValueChange={(value) => setFilterType(value as any)}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="year">Por Año</SelectItem>
                            <SelectItem value="month">Mes Específico</SelectItem>
                            <SelectItem value="range">Rango de Fechas</SelectItem>
                            <SelectItem value="specific">Fecha Específica</SelectItem>
                            <SelectItem value="all">Todo el tiempo</SelectItem>
                        </SelectContent>
                    </Select>
                    {(filterType === 'month' || filterType === 'year') && (
                        <div className="flex gap-2">
                            {filterType === 'month' &&
                                <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
                                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mes" /></SelectTrigger>
                                    <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                            }
                            <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Año" /></SelectTrigger>
                                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    {filterType === 'range' && <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
                    {filterType === 'specific' && <DatePicker date={specificDate} onDateChange={setSpecificDate} />}
                </CardContent>
            </Card>
            
            <div className="space-y-2">
                 <h3 className="text-xl font-semibold">Métricas de Aforo</h3>
                <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                    <AforoPieChartCard
                        title="Casos Asignados por Aforador"
                        description="Total de casos asignados en el período."
                        data={aforoData.assignedData}
                    />
                    <AforoPieChartCard
                        title="Casos Listos para Revisión"
                        description={`Total de casos marcados como "En revisión" en el período.`}
                        data={aforoData.readyForReviewData}
                    />
                    <AforoPieChartCard
                        title="Casos con Solicitud de Revalidación"
                        description="Total de casos devueltos para revalidación."
                        data={aforoData.revalidatedData}
                    />
                </div>
            </div>

            <div className="space-y-2 pt-6">
                 <h3 className="text-xl font-semibold">Métricas de Digitación</h3>
                 <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                    <AforoPieChartCard
                        title="Casos Asignados por Digitador"
                        description="Total de casos asignados para digitación."
                        data={digitacionData.assignedData}
                    />
                    <AforoPieChartCard
                        title="Casos Liquidados por Digitador"
                        description="Total de casos con declaración aduanera registrada."
                        data={digitacionData.liquidatedData}
                    />
                    <AforoPieChartCard
                        title="Casos Almacenados por Digitador"
                        description="Total de casos marcados como 'Almacenado'."
                        data={digitacionData.storedData}
                    />
                </div>
            </div>

        </div>
    );
}
