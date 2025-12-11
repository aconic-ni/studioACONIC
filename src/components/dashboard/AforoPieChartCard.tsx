
"use client"
import React, { useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ChartData {
  name: string;
  value: number;
}

interface AforoPieChartCardProps {
  title: string;
  description: string;
  data: ChartData[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210 20% 90%)',
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Don't render label for small slices

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-semibold">
      {`(${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};


export const AforoPieChartCard: React.FC<AforoPieChartCardProps> = ({ title, description, data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = () => {
    if (chartRef.current) {
        const captureDiv = chartRef.current;
        const header = captureDiv.querySelector('.download-header') as HTMLElement;
        
        if(header) header.style.display = 'block';

        html2canvas(captureDiv, { 
          scale: 1.5,
          onclone: (document) => {
            const clonedHeader = document.querySelector('.download-header');
            if (clonedHeader) {
                (clonedHeader as HTMLElement).style.display = 'block';
            }
          }
        }).then((canvas) => {
            const link = document.createElement('a');
            const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            link.download = `grafico_${sanitizedTitle}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
            
            if(header) header.style.display = 'none';
        });
    }
  };

  const totalValue = useMemo(() => data.reduce((acc, entry) => acc + entry.value, 0), [data]);
  const filteredData = data.filter(entry => entry.value > 0).sort((a,b) => b.value - a.value);

  return (
    <Card ref={chartRef} className="flex flex-col">
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
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
            <Button onClick={handleDownloadImage} variant="ghost" size="icon">
                <Download className="h-4 w-4" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {totalValue === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No hay datos para mostrar.
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center gap-4">
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={filteredData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                    >
                        {filteredData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="w-full flex-1">
                <h4 className="font-semibold text-center mb-2">Total: {totalValue}</h4>
                 <ScrollArea>
                    <Table>
                      <TableHeader className="sr-only">
                        <TableRow>
                          <TableHead>Color</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Porcentaje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((entry, index) => {
                            const percentage = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                            return (
                              <TableRow key={index} className="hover:bg-transparent border-none">
                                <TableCell className="p-1 w-4">
                                  <span className="h-2.5 w-2.5 rounded-full shrink-0 block" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                </TableCell>
                                <TableCell className="p-1 font-medium text-muted-foreground truncate">
                                  {entry.name}
                                </TableCell>
                                <TableCell className="p-1 text-right font-semibold w-12">
                                  {entry.value}
                                </TableCell>
                                <TableCell className="p-1 text-right w-20">
                                   <div className="text-foreground text-xs font-semibold">({percentage.toFixed(1)}%)</div>
                                </TableCell>
                              </TableRow>
                            )
                        })}
                      </TableBody>
                    </Table>
                </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
