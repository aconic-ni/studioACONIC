
"use client";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import type { InitialInfoFormData} from './FormParts/zodSchemas';
import { initialInfoSchema } from './FormParts/zodSchemas';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useState } from 'react';

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

export function InitialInfoForm() {
  const { setExamData, setCurrentStep, examData: existingExamData, softSaveExam } = useAppContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultManagerName =
    existingExamData?.manager ||
    (user?.email ? extractNameFromEmail(user.email) : '');

  const form = useForm<InitialInfoFormData>({
    resolver: zodResolver(initialInfoSchema),
    defaultValues: {
      ne: existingExamData?.ne || '',
      reference: existingExamData?.reference || '',
      consignee: existingExamData?.consignee || '',
      manager: defaultManagerName || '',
      location: existingExamData?.location || '',
    },
  });

  async function onSubmit(data: InitialInfoFormData) {
    setIsSubmitting(true);
    const ne = data.ne.toUpperCase().trim();

    // Prevent submitting if NE exists, unless it's the one being recovered/edited.
    if (!existingExamData?.ne) {
        const examDocRef = doc(db, "examenesPrevios", ne);
        const docSnap = await getDoc(examDocRef);
        if (docSnap.exists()) {
            toast({
                title: "NE Duplicado",
                description: `El examen NE: ${ne} ya existe. Si desea continuarlo, use la función de recuperar.`,
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }
    }
    
    // Update context with the validated data
    const validatedData = { ...data, ne: ne };
    setExamData(validatedData);

    try {
      await softSaveExam(validatedData, []); 
      toast({
        title: "Información Guardada",
        description: "La información inicial del examen ha sido guardada. Ahora puede añadir productos.",
      });
      setCurrentStep(ExamStep.PRODUCT_LIST);
    } catch (error) {
      toast({
        title: "Error al Guardar",
        description: "No se pudo guardar la información inicial. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
      console.error("Failed to soft save initial info:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-3xl mx-auto custom-shadow">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-gray-800">
            {existingExamData?.ne ? `Continuando Examen: ${existingExamData.ne}` : 'Nuevo Examen'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="ne"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NE (Seguimiento NX1) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: NX1-12345" {...field} value={field.value ?? ''} disabled={!!existingExamData?.ne} />
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
               <FormField
                control={form.control}
                name="consignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignatario *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del consignatario" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Gestor *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo del gestor" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación de la Mercancía *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Almacén Central, Bodega 5" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between items-center pt-2">
               <Button type="button" variant="ghost" onClick={() => setCurrentStep(ExamStep.WELCOME)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
              <Button type="submit" className="btn-primary px-6 py-3" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Guardando...' : 'Guardar y Continuar'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
