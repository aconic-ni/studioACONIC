
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

export const initialInfoSchema = z.object({
  ne: z.string().min(1, "NE es requerido."),
  reference: z.string().optional(),
  manager: z.string().min(1, "Nombre del Gestor es requerido."),
  location: z.string().min(1, "Ubicación es requerida."),
  consignee: z.string().min(1, "Consignatario es requerido."),
});

export type InitialInfoFormData = z.infer<typeof initialInfoSchema>;

export const productSchema = z.object({
  id: z.string().optional(), // Optional for new products, required for updates
  itemNumber: z.string().optional(),
  weight: z.string().optional(),
  description: z.string().min(1, 'Descripción es requerida.'),
  brand: z.string().optional(),
  model: z.string().optional(),
  unitMeasure: z.string().optional(),
  serial: z.string().optional(),
  origin: z.string().optional(),
  numberPackages: z.string().min(1, 'Numeración de Bultos es requerida.'),
  quantityPackages: z.coerce.number({
    required_error: 'Cantidad de Bultos es requerida.',
    invalid_type_error: "Debe ser un número."
   }).min(0, "Cantidad de bultos debe ser positiva."),
  quantityUnits: z.coerce.number({
    required_error: 'Cantidad de Unidades es requerida.',
    invalid_type_error: "Debe ser un número."
  }).min(0, "Cantidad de unidades debe ser positiva."),
  packagingCondition: z.string().optional(),
  observation: z.string().optional(),
  isConform: z.boolean().default(false),
  isExcess: z.boolean().default(false),
  isMissing: z.boolean().default(false),
  isFault: z.boolean().default(false),
  productTimestampSaveAt: z.custom<Timestamp>().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const anexoDocumentSchema = z.object({
    id: z.string(),
    cantidad: z.coerce.number().optional(),
    origen: z.string().optional(),
    um: z.string().optional(),
    sac: z.string().optional(),
    peso: z.coerce.number().optional(),
    descripcion: z.string().min(1, "Descripción es requerida."),
    linea: z.string().optional(),
    guia: z.string().optional(),
    bulto: z.coerce.number().optional(),
    total: z.coerce.number().optional(),
});

export type AnexoDocumentFormData = z.infer<typeof anexoDocumentSchema>;

export const corporateReportSchema = z.object({
  worksheetType: z.literal('corporate_report').default('corporate_report'),
  ne: z.string().min(1, "El campo NE es requerido."),
  reference: z.string().optional(),
  entryCustoms: z.string().min(1, "Aduana de ingreso es requerida."),
  dispatchCustoms: z.string().min(1, "Aduana de despacho es requerida."),
  consignee: z.string().min(1, "Consignatario es requerido."),
  proveedor: z.string().optional(),
  documents: z.array(z.object({
    id: z.string(),
    type: z.literal('FACTURA'),
    number: z.string(),
    noADMI: z.string(),
  })).optional(),
  fechaEnvioCliente: z.date().optional().nullable(),
  requiredPermits: z.array(z.any()).optional(),
  proveedorTransporte: z.string().optional(),
  declaracionNumero: z.string().optional(),
  fechaNacionalizacion: z.date().optional().nullable(),
  selectividad: z.enum(['verde', 'amarillo', 'rojo']).optional().nullable(),
  fechaDespacho: z.date().optional().nullable(),
  observations: z.string().optional(),
});

export type CorporateReportFormData = z.infer<typeof corporateReportSchema>;
