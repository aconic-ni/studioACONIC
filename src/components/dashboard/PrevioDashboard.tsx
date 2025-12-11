"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import type { DateRange } from 'react-day-picker';
import type { ExamDocument } from '@/types';
import { getMonth, getYear, format, eachMonthOfInterval, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { DatePicker } from '@/components/reports/DatePicker';
import { FileText, Package, DivideCircle, Users, Download } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Button } from '../ui/button';
import html2canvas from 'html2canvas';
import Image from 'next/image';

interface PrevioDashboardProps {
    allExams: ExamDocument[];
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: 0, label: 'Enero' }, { value: 1, label: 'Febrero' }, { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' }, { value: 4, label: 'Mayo' }, { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' }, { value: 10, label: 'Noviembre' }, { value: 11, label: 'Diciembre' }
];

export function PrevioDashboard({ allExams }: PrevioDashboardProps) {
  const [filteredExams, setFilteredExams] = useState<ExamDocument[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'range' | 'month' | 'year' | 'specific'>('year');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [specificDate, setSpecificDate] = useState<Date | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()));
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  const lineChartRef = useRef<HTMLDivElement>(null);
  const gestorExamsChartRef = useRef<HTMLDivElement>(null);
  const gestorProductsChartRef = useRef<HTMLDivElement>(null);


 const filterExams = useCallback((start: Date, end: Date) => {
    return allExams.filter(exam => {
        const dateFields: (Timestamp | null | undefined)[] = [ exam.completedAt, exam.createdAt, exam.lastUpdated, exam.savedAt, exam.assignedAt, exam.requestedAt ];
        for (const dateField of dateFields) {
          if (dateField) {
            const examDate = dateField.toDate();
            if (examDate >= start && examDate <= end) {
              return true;
            }
          }
        }
        return false;
    });
 }, [allExams]);

  const applyFilters = useCallback(() => {
    let examsToProcess: ExamDocument[] = [];

    if (filterType === 'all') {
        examsToProcess = allExams;
    }
    else if (filterType === 'range' && dateRange?.from) {
        const start = dateRange.from;
        const end = dateRange.to || new Date();
        end.setHours(23, 59, 59, 999);
        examsToProcess = filterExams(start, end);
    } else if (filterType === 'month') {
        const start = startOfMonth(new Date(selectedYear, selectedMonth));
        const end = endOfMonth(new Date(selectedYear, selectedMonth));
        examsToProcess = filterExams(start, end);
    } else if (filterType === 'year') {
        const start = startOfYear(new Date(selectedYear, 0, 1));
        const end = endOfYear(new Date(selectedYear, 11, 31));
        examsToProcess = filterExams(start, end);
    } else if (filterType === 'specific' && specificDate) {
        const start = new Date(specificDate);
        start.setHours(0,0,0,0);
        const end = new Date(specificDate);
        end.setHours(23,59,59,999);
        examsToProcess = filterExams(start, end);
    }
    setFilteredExams(examsToProcess);
  }, [allExams, filterType, dateRange, selectedMonth, selectedYear, specificDate, filterExams]);

  useEffect(() => {
    applyFilters();
  }, [filterType, dateRange, selectedMonth, selectedYear, specificDate, allExams, applyFilters]);

  const dashboardData = useMemo(() => {
    const yearForChart = filterType === 'year' || filterType === 'month' ? selectedYear : currentYear;
    const monthsInYear = eachMonthOfInterval({
        start: startOfYear(new Date(yearForChart, 0, 1)),
        end: endOfYear(new Date(yearForChart, 11, 31))
    });

    const monthCounts: { [key: string]: number } = {};
    monthsInYear.forEach(m => {
        const monthKey = format(m, 'MMM', { locale: es });
        monthCounts[monthKey] = 0;
    });

    allExams.forEach(exam => {
        const dateFields: (Timestamp | null | undefined)[] = [ exam.completedAt, exam.createdAt, exam.lastUpdated, exam.savedAt, exam.assignedAt, exam.requestedAt ];
        const uniqueMonths = new Set<string>();

        for (const dateField of dateFields) {
          if (dateField) {
            const date = dateField.toDate();
            if (getYear(date) === yearForChart) {
                const monthKey = format(date, 'MMM', { locale: es });
                uniqueMonths.add(monthKey);
            }
          }
        }
        
        uniqueMonths.forEach(monthKey => {
           if (monthCounts.hasOwnProperty(monthKey)) {
                monthCounts[monthKey]++;
            }
        })
    });

    const examsByMonth = Object.keys(monthCounts).map(monthKey => ({
      month: monthKey,
      total: monthCounts[monthKey]
    }));

    const totalExams = filteredExams.length;
    const totalProducts = filteredExams.reduce((acc, exam) => acc + (exam.products?.length || 0), 0);

    const managerCounts: { [key: string]: { examCount: number; productCount: number } } = {};
    filteredExams.forEach(exam => {
      const manager = exam.manager || 'No asignado';
      if (!managerCounts[manager]) {
        managerCounts[manager] = { examCount: 0, productCount: 0 };
      }
      managerCounts[manager].examCount += 1;
      managerCounts[manager].productCount += exam.products?.length || 0;
    });

    const examsByManager = Object.entries(managerCounts).map(([name, data]) => ({ name, total: data.examCount })).sort((a, b) => b.total - a.total).slice(0,10);
    const productsByManager = Object.entries(managerCounts).map(([name, data]) => ({ name, total: data.productCount })).sort((a, b) => b.total - a.total).slice(0,10);
    
    const avgProductsPerExam = totalExams > 0 ? parseFloat((totalProducts / totalExams).toFixed(1)) : 0;
    const managerCount = Object.keys(managerCounts).length;
    const avgExamsPerManager = managerCount > 0 ? parseFloat((totalExams / managerCount).toFixed(1)) : 0;

    return { totalExams, totalProducts, examsByManager, productsByManager, examsByMonth, avgProductsPerExam, avgExamsPerManager };
  }, [filteredExams, allExams, filterType, selectedYear]);
  
  const handleDownloadChart = (chartRef: React.RefObject<HTMLDivElement>, chartName: string) => {
    if (chartRef.current) {
        const captureDiv = chartRef.current;
        const header = captureDiv.querySelector('.download-header') as HTMLElement;
        
        if(header) header.style.display = 'block';

        html2canvas(captureDiv, { 
          scale: 1.5, 
          backgroundColor: null,
          onclone: (document) => {
            const clonedHeader = document.querySelector('.download-header');
            if (clonedHeader) {
                (clonedHeader as HTMLElement).style.display = 'block';
            }
          }
        }).then((canvas) => {
            const link = document.createElement('a');
            link.download = `grafico_${chartName}_${new Date().toISOString().split('T')[0]}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
            if(header) header.style.display = 'none';
        });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader>
              <CardTitle className="text-2xl">Dashboard de Operaciones (Previos)</CardTitle>
              <CardDescription>Resumen interactivo de la actividad de exámenes previos.</CardDescription>
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
          {[
              { title: 'Total de Exámenes', value: dashboardData.totalExams, icon: FileText },
              { title: 'Total de Productos', value: dashboardData.totalProducts, icon: Package },
              { title: 'Productos / Examen (Prom)', value: dashboardData.avgProductsPerExam, icon: DivideCircle },
              { title: 'Exámenes / Gestor (Prom)', value: dashboardData.avgExamsPerManager, icon: Users },
          ].map((item, index) => (
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

      <Card ref={lineChartRef}>
           <div className="download-header" style={{ display: 'none', padding: '1rem', backgroundColor: 'white' }}>
              <Image
                  src="/AconicExaminer/imagenes/HEADERSEXA.svg"
                  alt="Examen Header"
                  width={800}
                  height={100}
                  className="w-full h-auto mb-4"
                  priority
              />
           </div>
          <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Operaciones Anual</CardTitle>
                  <CardDescription>Volumen de exámenes previos completados a lo largo del tiempo.</CardDescription>
                </div>
                <Button onClick={() => handleDownloadChart(lineChartRef, 'operaciones_anual')} variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
              </div>
          </CardHeader>
          <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.examsByMonth} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Total de Exámenes" dot={{ r: 4 }} activeDot={{ r: 8 }}/>
                  </LineChart>
              </ResponsiveContainer>
          </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
          <Card ref={gestorExamsChartRef}>
              <div className="download-header" style={{ display: 'none', padding: '1rem', backgroundColor: 'white' }}><Image src="/AconicExaminer/imagenes/HEADERSEXA.svg" alt="Header" width={800} height={100} priority/></div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Exámenes por Gestor</CardTitle>
                    <CardDescription>Top 10 gestores por volumen de exámenes.</CardDescription>
                  </div>
                  <Button onClick={() => handleDownloadChart(gestorExamsChartRef, 'examenes_por_gestor')} variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={dashboardData.examsByManager} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis dataKey="name" type="category" width={100} interval={0} tick={{fontSize: 12}} />
                          <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                          <Legend />
                          <Bar dataKey="total" fill="hsl(var(--chart-2))" name="Total Exámenes" barSize={20}/>
                      </BarChart>
                  </ResponsiveContainer>
              </CardContent>
          </Card>
          
          <Card ref={gestorProductsChartRef}>
              <div className="download-header" style={{ display: 'none', padding: '1rem', backgroundColor: 'white' }}><Image src="/AconicExaminer/imagenes/HEADERSEXA.svg" alt="Header" width={800} height={100} priority/></div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Productos Inspeccionados por Gestor</CardTitle>
                    <CardDescription>Top 10 gestores por volumen de productos.</CardDescription>
                  </div>
                  <Button onClick={() => handleDownloadChart(gestorProductsChartRef, 'productos_por_gestor')} variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                   <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={dashboardData.productsByManager} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} interval={0} tick={{fontSize: 12}}/>
                          <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                          <Legend />
                          <Bar dataKey="total" fill="hsl(var(--chart-5))" name="Total Productos" barSize={20}/>
                      </BarChart>
                  </ResponsiveContainer>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
