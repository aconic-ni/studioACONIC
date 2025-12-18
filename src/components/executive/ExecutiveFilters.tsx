"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Search, ChevronsUpDown, RefreshCw, Download, CalendarRange, Calendar, CalendarDays } from 'lucide-react';

const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, 'label': 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

type DateFilterType = 'range' | 'month' | 'today';
type TabValue = 'worksheets' | 'anexos' | 'corporate';

interface ExecutiveFiltersProps {
    activeTab: TabValue;
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    facturadoFilter: { facturado: boolean; noFacturado: boolean; };
    setFacturadoFilter: (value: { facturado: boolean; noFacturado: boolean; }) => void;
    acuseFilter: { conAcuse: boolean; sinAcuse: boolean; };
    setAcuseFilter: (value: { conAcuse: boolean; sinAcuse: boolean; }) => void;
    preliquidationFilter: boolean;
    setPreliquidationFilter: (value: boolean) => void;
    dateFilterType: DateFilterType;
    setDateFilterType: (value: DateFilterType) => void;
    dateRangeInput: DateRange | undefined;
    setDateRangeInput: (value: DateRange | undefined) => void;
    setAppliedFilters: (filters: any) => void;
    setCurrentPage: (page: number) => void;
    isExporting: boolean;
    allCasesCount: number;
    searchHint: { foundIn: TabValue; label: string } | null;
    clearFilters: () => void;
}

export function ExecutiveFilters({
    activeTab,
    searchTerm,
    setSearchTerm,
    facturadoFilter,
    setFacturadoFilter,
    acuseFilter,
    setAcuseFilter,
    preliquidationFilter,
    setPreliquidationFilter,
    dateFilterType,
    setDateFilterType,
    dateRangeInput,
    setDateRangeInput,
    setAppliedFilters,
    setCurrentPage,
    isExporting,
    allCasesCount,
    searchHint,
    clearFilters
}: ExecutiveFiltersProps) {
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);

    const handleSearch = () => {
        let dateRange: DateRange | undefined = undefined;
        if (dateFilterType === 'range') {
            dateRange = dateRangeInput;
        } else if (dateFilterType === 'month') {
            const start = new Date(selectedYear, selectedMonth, 1);
            const end = new Date(selectedYear, selectedMonth + 1, 0);
            dateRange = { from: start, to: end };
        } else if (dateFilterType === 'today') {
            const today = new Date();
            dateRange = { from: today, to: today };
        }

        setAppliedFilters({
            searchTerm,
            ...facturadoFilter,
            ...acuseFilter,
            preliquidation: preliquidationFilter,
            dateFilterType: dateFilterType,
            dateRange: dateRange,
            isSearchActive: true,
        });
        setCurrentPage(1);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Buscar por NE o Consignatario..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center flex-wrap gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[200px] justify-start"><ChevronsUpDown className="mr-2 h-4 w-4" /> Filtrar Visibilidad</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                            <div className="grid gap-2">
                                <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={facturadoFilter.noFacturado} onCheckedChange={(checked) => setFacturadoFilter(f => ({ ...f, noFacturado: !!checked }))} />No Facturados</label>
                                <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={facturadoFilter.facturado} onCheckedChange={(checked) => setFacturadoFilter(f => ({ ...f, facturado: !!checked }))} />Facturados</label>
                            </div>
                            <div className="grid gap-2 mt-2 pt-2 border-t">
                                <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={acuseFilter.sinAcuse} onCheckedChange={(checked) => setAcuseFilter(f => ({ ...f, sinAcuse: !!checked }))} />Sin Acuse</label>
                                <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={acuseFilter.conAcuse} onCheckedChange={(checked) => setAcuseFilter(f => ({ ...f, conAcuse: !!checked }))} />Con Acuse</label>
                            </div>
                            <div className="grid gap-2 mt-2 pt-2 border-t">
                                <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={preliquidationFilter} onCheckedChange={setPreliquidationFilter} />Pendiente Preliquidación</label>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                    <Button variant="outline" onClick={clearFilters}>Limpiar Filtros</Button>
                    <Button variant="outline" onClick={() => {}}><RefreshCw className="mr-2 h-4 w-4" /> Actualizar</Button>
                    <Button onClick={() => {}} disabled={allCasesCount === 0 || isExporting}><Download className="mr-2 h-4 w-4" />Exportar</Button>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant={dateFilterType === 'range' ? 'default' : 'ghost'} size="sm" onClick={() => setDateFilterType('range')}><CalendarRange className="mr-2 h-4 w-4" /> Rango</Button>
                    <Button variant={dateFilterType === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setDateFilterType('month')}><Calendar className="mr-2 h-4 w-4" /> Mes</Button>
                    <Button variant={dateFilterType === 'today' ? 'default' : 'ghost'} size="sm" onClick={() => setDateFilterType('today')}><CalendarDays className="mr-2 h-4 w-4" /> Hoy</Button>
                </div>
                {dateFilterType === 'range' && <DatePickerWithRange date={dateRangeInput} onDateChange={setDateRangeInput} />}
                {dateFilterType === 'month' && (
                    <div className="flex gap-2">
                        <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent></Select>
                        <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                    </div>
                )}
            </div>
        </div>
    );
}
