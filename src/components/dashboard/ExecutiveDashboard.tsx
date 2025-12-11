
"use client";
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { AforoCase, Worksheet, SolicitudRecord, AppUser } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { DatePicker } from '@/components/reports/DatePicker';
import type { DateRange } from 'react-day-picker';
import { getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { GitBranch, AlertTriangle, FileCheck2, FilePlus, Briefcase, FileInput } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AforoPieChartCard } from './AforoPieChartCard';


interface ExecutiveDashboardProps {
    allCases: AforoCase[];
    allWorksheets: Worksheet[];
    allSolicitudes: SolicitudRecord[];
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

export function ExecutiveDashboard({ allCases, allWorksheets, allSolicitudes }: ExecutiveDashboardProps) {
    const { user } = useAuth();
    const [filterType, setFilterType] = useState<'all' | 'range' | 'month' | 'year' | 'specific' | 'today'>('today');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [specificDate, setSpecificDate] = useState<Date | undefined>();
    const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()));
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedExecutive, setSelectedExecutive] = useState<string>('all');
    
    const executiveUsers = useMemo(() => {
        const executives = new Set<string>();
        allCases.forEach(c => { if(c.executive) executives.add(c.executive) });
        allWorksheets.forEach(ws => { if(ws.executive) executives.add(ws.executive) });
        return Array.from(executives).sort();
    }, [allCases, allWorksheets]);

    const filterByDate = useCallback((items: any[], dateField: string, start: Date, end: Date) => {
        return items.filter(item => {
            const itemDate = (item[dateField] as Timestamp)?.toDate();
            return itemDate && itemDate >= start && itemDate <= end;
        });
    }, []);

    const dashboardData = useMemo(() => {
        let start: Date, end: Date;
        const now = new Date();
        switch (filterType) {
            case 'range':
                start = dateRange?.from || now;
                end = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(start);
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
                start = specificDate ? startOfDay(specificDate) : startOfDay(now);
                end = specificDate ? endOfDay(specificDate) : endOfDay(now);
                break;
             case 'today':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'all':
            default:
                start = new Date(2000, 0, 1);
                end = new Date(3000, 0, 1);
                break;
        }

        const filteredByExecCases = selectedExecutive === 'all' ? allCases : allCases.filter(c => c.executive === selectedExecutive);
        const filteredByExecWorksheets = selectedExecutive === 'all' ? allWorksheets : allWorksheets.filter(ws => ws.executive === selectedExecutive);
        const filteredByExecSolicitudes = selectedExecutive === 'all' ? allSolicitudes : allSolicitudes.filter(s => s.savedBy && s.savedBy.includes(selectedExecutive));

        const filteredCases = filterByDate(filteredByExecCases, 'createdAt', start, end);
        const filteredWorksheets = filterByDate(filteredByExecWorksheets, 'createdAt', start, end);
        const filteredSolicitudes = filterByDate(filteredByExecSolicitudes, 'savedAt', start, end);
        
        let userFilteredCases = filteredCases;
        let userFilteredWorksheets = filteredWorksheets;
        let userFilteredSolicitudes = filteredSolicitudes;

        if (user && user.role === 'ejecutivo' && selectedExecutive === 'all') {
            userFilteredCases = filteredCases.filter(c => c.executive === user.displayName);
            userFilteredWorksheets = filteredWorksheets.filter(ws => ws.executive === user.displayName);
            userFilteredSolicitudes = filteredSolicitudes.filter(s => s.savedBy === user.email);
        }

        const totalOperaciones = userFilteredCases.length;
        const casosFacturados = userFilteredCases.filter(c => c.facturado).length;
        const incidenciasRectificacion = userFilteredCases.filter(c => c.incidentType === 'Rectificacion').length;
        const incidenciasDudaValor = userFilteredCases.filter(c => c.hasValueDoubt).length;
        
        let permisosAsignados = 0;
        let permisosEntregados = 0;
        userFilteredWorksheets.forEach(ws => {
            permisosAsignados += (ws.requiredPermits || []).length;
            permisosEntregados += (ws.requiredPermits || []).filter(p => p.status === 'Entregado').length;
        });

        const solicitudesPago = userFilteredSolicitudes.length;
        
        const groupDataByExecutive = (items: any[], userField: 'executive' | 'savedBy') => {
            const stats: { [key: string]: number } = {};
            items.forEach(item => {
                const executiveName = userField === 'executive' ? item.executive : item.savedBy;
                if(executiveName) {
                    stats[executiveName] = (stats[executiveName] || 0) + 1;
                }
            });
            return Object.entries(stats).map(([name, value]) => ({ name, value }));
        };
        
        const groupPermitsByExecutive = (worksheets: Worksheet[]) => {
            const stats: { [key: string]: number } = {};
            worksheets.forEach(ws => {
                const executive = ws.executive;
                if (executive) {
                    stats[executive] = (stats[executive] || 0) + (ws.requiredPermits?.length || 0);
                }
            });
            return Object.entries(stats).map(([name, value]) => ({ name, value }));
        }

        const operacionesPorEjecutivo = groupDataByExecutive(userFilteredCases, 'executive');
        const incidenciasRectPorEjecutivo = groupDataByExecutive(userFilteredCases.filter(c => c.incidentType === 'Rectificacion'), 'executive');
        const incidenciasDudaPorEjecutivo = groupDataByExecutive(userFilteredCases.filter(c => c.hasValueDoubt), 'executive');
        const casosFacturadosPorEjecutivo = groupDataByExecutive(userFilteredCases.filter(c => c.facturado), 'executive');
        const solicitudesPorEjecutivo = groupDataByExecutive(userFilteredSolicitudes, 'savedBy');
        const permisosPorEjecutivo = groupPermitsByExecutive(userFilteredWorksheets);


        return {
            totalOperaciones,
            permisosAsignados,
            permisosEntregados,
            incidenciasRectificacion,
            incidenciasDudaValor,
            casosFacturados,
            solicitudesPago,
            operacionesPorEjecutivo,
            incidenciasRectPorEjecutivo,
            incidenciasDudaPorEjecutivo,
            casosFacturadosPorEjecutivo,
            solicitudesPorEjecutivo,
            permisosPorEjecutivo
        };
    }, [allCases, allWorksheets, allSolicitudes, filterType, dateRange, selectedMonth, selectedYear, specificDate, filterByDate, user, selectedExecutive]);

    const metricCards = [
        { title: 'Total Operaciones', value: dashboardData.totalOperaciones, icon: Briefcase },
        { title: 'Total Permisos Asignados', value: dashboardData.permisosAsignados, icon: GitBranch },
        { title: 'Total Permisos Entregados', value: dashboardData.permisosEntregados, icon: FileCheck2 },
        { title: 'Total Incidencias (Rectificación)', value: dashboardData.incidenciasRectificacion, icon: AlertTriangle },
        { title: 'Total Incidencias (Duda de Valor)', value: dashboardData.incidenciasDudaValor, icon: AlertTriangle },
        { title: 'Total Casos Facturados', value: dashboardData.casosFacturados, icon: FileInput },
        { title: 'Total Solicitudes de Pago', value: dashboardData.solicitudesPago, icon: FilePlus },
    ];
    
    const showCharts = user?.role === 'admin' || user?.role === 'coordinadora';
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Dashboard Ejecutivo</CardTitle>
                    <CardDescription>Resumen de actividad y rendimiento.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                     <Select value={filterType} onValueChange={(value) => setFilterType(value as any)}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hoy</SelectItem>
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
                    
                    {showCharts && (
                         <Select value={selectedExecutive} onValueChange={setSelectedExecutive}>
                            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filtrar por ejecutivo..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Ejecutivos</SelectItem>
                                {executiveUsers.map(exec => <SelectItem key={exec} value={exec}>{exec}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>

             {!showCharts ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {metricCards.map((item, index) => (
                        <Card key={index} className="transition-all hover:shadow-lg hover:-translate-y-1">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                                <item.icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{item.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                 </div>
             ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                   <AforoPieChartCard title="Operaciones por Ejecutivo" description="Total de casos de aforo registrados." data={dashboardData.operacionesPorEjecutivo} />
                   <AforoPieChartCard title="Incidencias (Rectificación)" description="Total de rectificaciones reportadas." data={dashboardData.incidenciasRectPorEjecutivo} />
                   <AforoPieChartCard title="Incidencias (Duda de Valor)" description="Total de dudas de valor reportadas." data={dashboardData.incidenciasDudaPorEjecutivo} />
                   <AforoPieChartCard title="Casos Facturados" description="Total de casos marcados como facturados." data={dashboardData.casosFacturadosPorEjecutivo} />
                   <AforoPieChartCard title="Solicitudes de Pago" description="Total de solicitudes de pago creadas." data={dashboardData.solicitudesPorEjecutivo} />
                   <AforoPieChartCard title="Permisos Asignados" description="Total de permisos requeridos en hojas de trabajo." data={dashboardData.permisosPorEjecutivo} />
                </div>
             )}
        </div>
    );
}
