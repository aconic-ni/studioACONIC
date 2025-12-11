"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import type { AforoCase, Remision, RemisionCase } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp, writeBatch, doc } from 'firebase/firestore';

interface RemisionPrintProps {
  cases: AforoCase[];
  onClose: () => void;
}

export const RemisionPrint: React.FC<RemisionPrintProps> = ({ cases, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipientName, setRecipientName] = useState('');
  const [isRecipientSet, setIsRecipientSet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleContinue = async () => {
    if (!user || !user.email) {
      toast({ title: 'Error de Autenticación', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const remisionCases: RemisionCase[] = cases.map(c => ({
      ne: c.ne,
      reference: c.worksheet?.reference || '',
      consignee: c.consignee,
      cuentaDeRegistro: c.cuentaDeRegistro || 'N/A',
    }));

    const newRemision: Omit<Remision, 'id'> = {
      recipientName: recipientName,
      createdAt: Timestamp.now(),
      createdBy: user.email,
      totalCases: cases.length,
      cases: remisionCases,
    };
    
    const batch = writeBatch(db);

    try {
      const remisionesCollection = collection(db, 'remisiones');
      const newRemisionRef = doc(remisionesCollection); // Create a new doc ref with auto-ID
      
      batch.set(newRemisionRef, newRemision);

      // Update the remisionId for each case included
      cases.forEach(caseItem => {
        const caseDocRef = doc(db, 'AforoCases', caseItem.id);
        batch.update(caseDocRef, { remisionId: newRemisionRef.id });
      });

      await batch.commit();

      toast({ title: 'Remisión Guardada', description: `Se ha guardado la remisión con ID: ${newRemisionRef.id}` });
      setIsRecipientSet(true);

    } catch (error) {
       console.error("Error saving remision:", error);
       toast({ title: 'Error al Guardar', description: 'No se pudo guardar la remisión en la base de datos.', variant: 'destructive' });
    } finally {
       setIsSaving(false);
    }
  };
  
  if (!isRecipientSet) {
    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Generar Remisión</DialogTitle>
                    <DialogDescription>
                        Ingrese el nombre de la persona a quien se remiten las cuentas. Esto guardará un registro permanente.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="recipient-name">Nombre del Destinatario</Label>
                    <Input 
                        id="recipient-name"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Ej: Lic. Nombre Apellido"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleContinue} disabled={!recipientName || isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {isSaving ? 'Guardando...' : 'Guardar y Continuar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
  }

  return (
    <div className="bg-background min-h-screen p-4 sm:p-8" id="printable-area">
        <div className="max-w-4xl mx-auto">
            <div className="no-print mb-6 flex justify-between items-center">
                <Button variant="outline" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
                <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir Remisión</Button>
            </div>
            
            <Card className="shadow-lg print:shadow-none print:border-none print:bg-transparent">
                <CardHeader className="print:p-0">
                    <Image
                        src="/imagenes/HEADERSEXA.svg"
                        alt="Header"
                        width={800}
                        height={100}
                        className="w-full h-auto"
                        priority
                    />
                     <div className="text-center my-4 print:my-2">
                        <h1 className="font-bold text-xl print:text-lg">Remisión de Cuentas</h1>
                        <p className="text-sm text-muted-foreground print:text-xs">Generado el: {format(new Date(), 'PPP', { locale: es })}</p>
                    </div>
                </CardHeader>
                <CardContent className="print:p-0">
                    <div className="text-sm space-y-4 print:text-xs">
                        <p>Estimado Lic. {recipientName};</p>
                        <p>Por este medio se le remiten las siguientes {cases.length} cuentas:</p>
                    </div>
                    
                    <div className="my-6 border rounded-lg overflow-hidden print:my-4 print:border-gray-400">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="print:text-xs">NE</TableHead>
                                    <TableHead className="print:text-xs">Referencia</TableHead>
                                    <TableHead className="print:text-xs">Consignatario</TableHead>
                                    <TableHead className="print:text-xs">Cuenta de Registro</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cases.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium print:text-xs">{c.ne}</TableCell>
                                    <TableCell className="print:text-xs">{c.worksheet?.reference || 'N/A'}</TableCell>
                                    <TableCell className="print:text-xs">{c.consignee}</TableCell>
                                    <TableCell className="print:text-xs">{c.cuentaDeRegistro}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    
                    <div className="text-sm space-y-4 print:text-xs mt-6">
                        <p>Sin más a que hacer referencia, esperando se encuentre bien. Atentamente Equipo ACONIC.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-8 print:pt-4">
                        <div>
                            <h5 className="text-sm text-center font-medium mb-2 print:text-xs print:mb-1">Recibido</h5>
                            <div className="p-4 border rounded-md bg-muted/30 min-h-[2.5rem] print:p-1 print:min-h-[2.5rem]"></div>
                        </div>
                        <div>
                            <h5 className="text-sm text-center font-medium mb-2 print:text-xs print:mb-1">Entregado</h5>
                            <div className="p-4 border rounded-md bg-muted/30 min-h-[2.5rem] print:p-1 print:min-h-[2.5rem]"></div>
                        </div>
                    </div>
                    <Image
                        src="/AconicExaminer/imagenes/FOOTERSOLICITUDETAIL.svg"
                        alt="Footer"
                        width={800}
                        height={50}
                        className="w-full h-auto mt-12 print:mt-8"
                    />
                </CardContent>
            </Card>
        </div>
    </div>
  );
};
