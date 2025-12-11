
import { z } from 'zod';

// Renamed from initialInfoSchema
export const initialDataSchema = z.object({
  ne: z.string()
    .min(1, "NE es requerido.")
    .regex(/^[a-zA-Z0-9\s]*$/, "NE solo puede contener letras, números y espacios."),
  reference: z.string().optional(),
  manager: z.string().min(1, "Nombre del Usuario es requerido."),
  date: z.date({ required_error: "Fecha es requerida." }),
  recipient: z.string().min(1, "Destinatario es requerido."),
});

// Renamed from InitialInfoFormData
export type InitialDataFormData = z.infer<typeof initialDataSchema>;


const collaboratorSchema = z.object({
  id: z.string(), // uuid
  name: z.string().min(1, "Nombre del colaborador es requerido."),
  number: z.string().min(1, "Número de colaborador es requerido."),
});

// Zod schema for the "Nueva Solicitud" form (previously productSchema)
export const solicitudSchema = z.object({
  id: z.string().optional(),

  monto: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : (typeof val === 'string' ? parseFloat(String(val).replace(/,/g, '')) : val),
    z.number({
      required_error: "Monto es requerido.",
      invalid_type_error: "Monto debe ser un número."
    }).min(0.01, "Monto debe ser positivo.")
  ),
  montoMoneda: z.enum(['cordoba', 'dolar', 'euro'], { errorMap: () => ({ message: "Seleccione una moneda para el monto." })}).optional(),
  cantidadEnLetras: z.string().optional(),

  consignatario: z.string().optional(),
  declaracionNumero: z.string().optional(),
  unidadRecaudadora: z.string().optional(),
  codigo1: z.string().optional(),
  codigo2: z.string().optional(), // Codigo MUR

  banco: z.enum(['BAC', 'BANPRO', 'BANCENTRO', 'FICOSHA', 'AVANZ', 'ATLANTIDA', 'ACCION POR CHEQUE/NO APLICA BANCO', 'Otros'], { errorMap: () => ({ message: "Seleccione un banco." })}).optional(),
  bancoOtros: z.string().optional(),
  numeroCuenta: z.string().optional(),
  monedaCuenta: z.enum(['cordoba', 'dolar', 'euro', 'Otros'], { errorMap: () => ({ message: "Seleccione moneda de la cuenta." })}).optional(),
  monedaCuentaOtros: z.string().optional(),

  elaborarChequeA: z.string().optional(),
  elaborarTransferenciaA: z.string().optional(),

  impuestosPagadosCliente: z.boolean().default(false).optional(),
  impuestosPagadosRC: z.string().optional(),
  impuestosPagadosTB: z.string().optional(),
  impuestosPagadosCheque: z.string().optional(),

  impuestosPendientesCliente: z.boolean().default(false).optional(),
  soporte: z.boolean().default(false).optional(),
  documentosAdjuntos: z.boolean().default(false).optional(),

  constanciasNoRetencion: z.boolean().default(false).optional(),
  constanciasNoRetencion1: z.boolean().default(false).optional(),
  constanciasNoRetencion2: z.boolean().default(false).optional(),

  // New fields for Pago de servicios
  pagoServicios: z.boolean().default(false).optional(),
  tipoServicio: z.enum(['COMIECO', 'MARCHAMO', 'FUMIGACION', 'RECORRIDO', 'EPN', 'ANALISIS_Y_LABORATORIO', 'OTROS'], { errorMap: () => ({ message: "Seleccione un tipo de servicio." })}).optional(),
  otrosTipoServicio: z.string().optional(),
  facturaServicio: z.string().optional(),
  institucionServicio: z.string().optional(),

  correo: z.string().optional().refine(val => {
    if (!val) return true;
    return val.split(';').every(email => z.string().email().safeParse(email.trim()).success || email.trim() === '');
  }, "Uno o más correos no son válidos."),
  observation: z.string().optional(),

  // New field for Memorandum collaborators
  memorandumCollaborators: z.array(collaboratorSchema).optional(),

}).superRefine((data, ctx) => {
  if (data.banco === 'Otros' && !data.bancoOtros?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Especifique el otro banco.",
      path: ['bancoOtros'],
    });
  }
  if (data.monedaCuenta === 'Otros' && !data.monedaCuentaOtros?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Especifique la otra moneda de la cuenta.",
      path: ['monedaCuentaOtros'],
    });
  }
  // Conditional validation for Pago de servicios
  if (data.pagoServicios) {
    if (!data.tipoServicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tipo de servicio es requerido si habilita Pago de Servicios.",
        path: ['tipoServicio'],
      });
    }
    // Removed required validation for facturaServicio
    if (!data.institucionServicio?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Institución es requerida si habilita Pago de Servicios.",
        path: ['institucionServicio'],
      });
    }
  }
  if (data.tipoServicio === 'OTROS' && !data.otrosTipoServicio?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Especifique el otro tipo de servicio.",
      path: ['otrosTipoServicio'],
    });
  }
});

export type SolicitudFormData = z.infer<typeof solicitudSchema>;
