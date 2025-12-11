"use client";
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import type { InitialDataFormData } from './FormParts/zodSchemas';
import { initialDataSchema } from './FormParts/zodSchemas';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, StickyNote } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function extractNameFromEmail(email?: string | null): string {
  if (!email) return "";
  try {
    const localPart = email.substring(0, email.lastIndexOf('@'));
    const nameParts = localPart.split(/[._-]/);
    const formattedName = nameParts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
    return formattedName;
  } catch (error) {
    console.error("Error extracting name from email:", error);
    return "";
  }
}

export function InitialDataForm() {
  const { setInitialContextData, setCurrentStep, initialContextData: existingInitialContextData, setIsMemorandumMode } = useAppContext();
  const { user } = useAuth();
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  const defaultManagerName =
    existingInitialContextData?.manager ||
    user?.displayName || // Try displayName first
    (user?.email ? extractNameFromEmail(user.email) : ''); // Fallback to email


  const form = useForm<InitialDataFormData>({
    resolver: zodResolver(initialDataSchema),
    defaultValues: {
      ne: existingInitialContextData?.ne || '',
      reference: existingInitialContextData?.reference || '',
      manager: defaultManagerName || '',
      date: existingInitialContextData?.date || undefined,
      recipient: existingInitialContextData?.recipient || '',
    },
  });

  const handleRecipientClick = (recipient: string) => {
    form.setValue('recipient', recipient, { shouldValidate: true });
    if (recipient.toLowerCase() === 'memorandum') {
        setIsMemorandumMode(true);
    } else {
        setIsMemorandumMode(false);
    }
  };


function onSubmit(data: InitialDataFormData) {
  setInitialContextData({
    ...existingInitialContextData,
    ...data,
    reference: data.reference || "",
  });
  if (data.recipient.toLowerCase() === 'memorandum') {
    setIsMemorandumMode(true);
  } else {
    setIsMemorandumMode(false);
  }
  setCurrentStep(ExamStep.PRODUCT_LIST);
}

  return (
    <Card className="w-full custom-shadow">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-gray-800">Solicitud de Cheque</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>A: *</FormLabel>
                    <FormControl>
                      <Input placeholder="Destinatario o Departamento" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecipientClick('Contabilidad')}
                        className="text-xs"
                      >
                        Contabilidad
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecipientClick('Harol Ampie - Contabilidad')}
                        className="text-xs"
                      >
                        Harol Ampie - Contabilidad
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecipientClick('Jose Daniel Cerros - Contabilidad')}
                        className="text-xs"
                      >
                        Jose Daniel Cerros - Contabilidad
                      </Button>
                       <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRecipientClick('Memorandum')}
                        className="text-xs"
                      >
                        <StickyNote className="mr-2 h-4 w-4" />
                        Memorandum
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>De (Nombre Usuario) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo del usuario" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha *</FormLabel>
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: es })
                            ) : (
                              <span>Seleccione una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setIsDatePickerOpen(false);
                          }}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ne"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NE (Seguimiento NX1) * / No usar &quot;/&quot;, ni &quot;-&quot;.</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: NX112345" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referencia (Contenedor, D/Embarque, #FA, Servicio...)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: MSKU1234567" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" className="btn-primary px-6 py-3">
                Continuar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
