"use client";
import { useState, useMemo } from 'react';
import type { CombinedActivityLog } from '@/app/admin/control/updates/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { DatePicker } from '@/components/reports/DatePicker';
import type { DateRange } from 'react-day-picker';
import { getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AforoPieChartCard } from './AforoPieChartCard';
import { Users, Activity, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ActivityDashboardProps {
    allLogs: CombinedActivityLog[];
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const mapUserToRole = (user: string): string => {
    if (!user) return 'Desconocido';
    const lowerUser = user.toLowerCase();
    if (lowerUser.includes('admin')) return 'Admin';
    if (lowerUser.includes('coordinacion')) return 'Coordinadora';
    if (lowerUser.includes('harol') || lowerUser.includes('cerros') || lowerUser.includes('calificador')) return 'Calificador';
    if (lowerUser.includes('revisor')) return 'Revisor';
    if (lowerUser.includes('agente')) return 'Agente';
    if (lowerUser.includes('supervisor')) return 'Supervisor';
    if (lowerUser.includes('aforador')) return 'Aforador';
    if (lowerUser.includes('aconicsa')) return 'Ejecutivo';
    return 'Gestor';
};

export function ActivityDashboard({ allLogs }: ActivityDashboardProps) {
    const [filterType, setFilterType] = useState<'all' | 'range' | 'month' | 'year' | 'specific'>('year');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [specificDate, setSpecificDate] = useState<Date | undefined>();
    const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()));
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);

    const filteredLogs = useMemo(() => {
        let start: Date, end: Date;

        switch(filterType) {
            case 'range':
                if (!dateRange?.from) return allLogs;
                start = dateRange.from;
                end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(start);
                break;
            case 'month':
                start = startOfMonth(new Date(selectedYear, selectedMonth));
                end = endOfMonth(new Date(selectedYear, selectedMonth));
                break;
            case 'year':
                start = startOfYear(new Date(selectedYear, 0, 1));
                end = endOfYear(new Date(selectedYear, 11, 31));
                break;
            case 'specific':
                if (!specificDate) return allLogs;
                start = startOfDay(specificDate);
                end = endOfDay(specificDate);
                break;
            case 'all':
            default:
                return allLogs;
        }

        return allLogs.filter(log => {
            const logDate = log.date;
            return logDate >= start && logDate <= end;
        });

    }, [allLogs, filterType, dateRange, selectedMonth, selectedYear, specificDate]);

    const activityData = useMemo(() => {
        const userStats: { [key: string]: number } = {};
        const roleStats: { [key: string]: number } = {};
        const activeUsers = new Set<string>();

        filteredLogs.forEach(log => {
            const userIdentifier = log.user || 'Desconocido';
            userStats[userIdentifier] = (userStats[userIdentifier] || 0) + 1;
            activeUsers.add(userIdentifier);
            
            const role = mapUserToRole(userIdentifier);
            roleStats[role] = (roleStats[role] || 0) + 1;
        });

        const activityByUser = Object.entries(userStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        const activityByRole = Object.entries(roleStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
            
        const totalUpdates = filteredLogs.length;

        return { totalUpdates, activeUserCount: activeUsers.size, activityByUser, activityByRole };
    }, [filteredLogs]);


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">Dashboard de Actividad de Usuarios</CardTitle>
                            <CardDescription>Estadísticas de uso de la aplicación por usuario y rol.</CardDescription>
                        </div>
                        <Button asChild variant="outline">
                            <Link href="/admin/control">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Control de Registros
                            </Link>
                        </Button>
                    </div>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Actualizaciones</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{activityData.totalUpdates}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{activityData.activeUserCount}</div></CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Actividad Total por Usuario (Top 10)</CardTitle>
                        <CardDescription>Número de cambios registrados por cada usuario.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={activityData.activityByUser} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis dataKey="name" type="category" width={150} interval={0} tick={{fontSize: 10}}/>
                                <Tooltip
                                    cursor={{fill: 'hsl(var(--muted))'}}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                />
                                <Bar dataKey="value" name="Actualizaciones" fill="hsl(var(--chart-1))" barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <AforoPieChartCard
                    title="Actividad por Rol de Usuario"
                    description="Distribución de la actividad según el rol asignado."
                    data={activityData.activityByRole}
                />
            </div>
        </div>
    );
}
