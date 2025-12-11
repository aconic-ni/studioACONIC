
"use client";
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext, SolicitudStep } from '@/context/AppContext'; // Changed ExamStep to SolicitudStep
import type { InitialDataFormData} from '@/components/examiner/FormParts/zodSchemas'; // Corrected path
import { initialDataSchema } from '@/components/examiner/FormParts/zodSchemas'; // Corrected path
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';


// Helper function to extract and format name from email
function extractNameFromEmail(email?: string | null): string {
  if (!email) return "";
  try {
    const localPart = email.substring(0, email.lastIndexOf('@'));
    const nameParts = localPart.split(/[._-]/); // Split by dot, underscore, or hyphen
    const formattedName = nameParts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
    return formattedName;
  } catch (error) {
    console.error("Error extracting name from email:", error);
    return ""; // Return empty string or a default name if extraction fails
  }
}

export function InitialDataForm() {
  const { setInitialContextData, setCurrentStep, initialContextData } = useAppContext(); // Changed examData to initialContextData and setExamData to setInitialContextData
  const { user } = useAuth(); // Get user from AuthContext
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);


  const defaultManagerName =
    initialContextData?.manager ||
    (user?.email ? extractNameFromEmail(user.email) : '');

  const form = useForm<InitialDataFormData>({
    resolver: zodResolver(initialDataSchema),
    defaultValues: {
      ne: initialContextData?.ne || '',
      reference: initialContextData?.reference || '',
      manager: defaultManagerName || '',
      date: initialContextData?.date || undefined, // Ensure 'date' comes from initialContextData
      recipient: initialContextData?.recipient || '', // Ensure 'recipient' comes from initialContextData
    },
  });

function onSubmit(data: InitialDataFormData) {
  setInitialContextData({ // Use setInitialContextData
    ...initialContextData, // Spread existing initialContextData first
    ...data, // Then spread new data
    reference: data.reference || "", 
  });
  setCurrentStep(SolicitudStep.PRODUCT_LIST); // Use SolicitudStep
}

  return (
    <Card className="w-full max-w-3xl mx-auto custom-shadow">
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
                        onClick={() => form.setValue('recipient', 'Contabilidad', { shouldValidate: true })}
                        className="text-xs"
                      >
                        Contabilidad
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.setValue('recipient', 'Harol Ampie - Contabilidad', { shouldValidate: true })}
                        className="text-xs"
                      >
                        Harol Ampie - Contabilidad
                      </Button>
                       <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.setValue('recipient', 'Jose Daniel Cerros - Contabilidad', { shouldValidate: true })}
                        className="text-xs"
                      >
                        Jose Daniel Cerros - Contabilidad
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
                                format(field.value, "PPP", { locale: es }) // Use es locale
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
                                setIsDatePickerOpen(false); // Close picker on select
                            }}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            locale={es} // Use es locale for calendar
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
                    <FormLabel>NE (Seguimiento NX1) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: NX1-12345" {...field} value={field.value ?? ''} />
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
                    <FormLabel>Referencia (Contenedor, Guía, BL, Factura...)</FormLabel>
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
