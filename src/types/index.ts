
import { Timestamp } from 'firebase/firestore';

export type UserRole = 'gestor' | 'aforador' | 'ejecutivo' | 'coordinadora' | 'admin' | 'agente' | 'digitador' | 'supervisor' | 'revisor' | 'calificador' | 'autorevisor' | 'autorevisor_plus' | 'invitado' | 'facturador' | 'legal';

export interface ExamData {
  ne: string;
  reference?: string | null;
  manager: string;
  location: string;
  consignee: string;
}

export interface Product {
  id: string; // unique id for React keys and updates
  itemNumber?: string | null;
  weight?: string | null;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  unitMeasure?: string | null;
  serial?: string | null;
  origin?: string | null;
  numberPackages?: string | null;
  quantityPackages?: number | string | null;
  quantityUnits?: number | string | null;
  packagingCondition?: string | null;
  observation?: string | null;
  isConform: boolean;
  isExcess: boolean;
  isMissing: boolean;
  isFault: boolean;
  productTimestampSaveAt?: Timestamp;
}

// User type from Firebase, can be extended
export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role?: UserRole | null;
  roleTitle?: string | null; // Custom title for display purposes
  isStaticUser?: boolean;
  hasReportsAccess?: boolean; // For CustomsReports
  hasPaymentAccess?: boolean; // For databasePay
  visibilityGroup?: { uid: string; displayName: string; email: string; }[]; // For executive groups - stores UIDs and names/emails
  canReviewUserEmails?: string[]; // For autorevisor_plus
  consigneeDirectory?: { name: string, createdAt: Timestamp }[]; // Subcollection
  agentLicense?: string;
  cedula?: string;
}

export interface ExamDocument extends ExamData {
  id?: string; // Add optional id for mapping in reports
  products: Product[];
  savedBy: string | null; // Email of the user who saved it
  status?: 'incomplete' | 'complete' | 'requested' | 'assigned'; // To track exam status
  lock?: 'on' | 'off'; // To prevent concurrent edits
  createdAt?: Timestamp | null; // When the exam was first created
  savedAt?: Timestamp | null; // When the exam was last saved (preview)
  lastUpdated?: Timestamp | null; // To track last soft save
  completedAt?: Timestamp | null; // When the exam was finalized
  commentCount?: number; // For report comment counts
  requestedBy?: string | null; // email of executive
  requestedAt?: Timestamp | null;
  assignedTo?: string | null; // name of gestor
  assignedAt?: Timestamp | null;
  isArchived?: boolean; // For soft delete
  pagos?: InitialDataContext[];
}

export interface Comment {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    authorRoleTitle?: string | null; // Custom title for display
    createdAt: Timestamp;
}

// Interface for data passed to downloadExcelFile
// It accommodates both PreviewScreen (without savedAt/savedBy) and DatabasePage (with them)
export interface ExportableExamData extends ExamData {
  products?: Product[] | null;
  createdAt?: Timestamp | Date | null;
  completedAt?: Timestamp | Date | null;
  savedBy?: string | null;
  savedAt?: Timestamp | Date | null;
}

export interface AuditLogEntry {
    examNe: string;
    action: 'product_added' | 'product_updated' | 'product_deleted';
    changedBy: string | null;
    changedAt: Timestamp;
    details: {
        productId: string;
        previousData?: Partial<Product> | null;
        newData?: Partial<Product> | null;
        [key: string]: any;
    };
}

export interface AdminAuditLogEntry {
    id: string;
    collection: string;
    docId: string;
    adminId: string;
    adminEmail: string;
    timestamp: Timestamp;
    action: 'update';
    changes: {
        field: string;
        oldValue: any;
        newValue: any;
    }[];
}


export interface ExamRequest {
    id: string;
    ne: string;
    reference?: string | null;
    consignee: string;
    location: string;
    status: 'pendiente' | 'asignado' | 'completado';
    requestedBy: string; // email of executive
    requestedAt: Timestamp;
    assignedTo?: string; // name of gestor
    assignedAt?: Timestamp;
}

export interface ReportAccessRequest {
  id: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: Timestamp;
  processedAt?: Timestamp;
}

export type AforoCaseStatus = 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Revalidación Solicitada' | 'Zona Franca';
export type AforadorStatus = 'En proceso' | 'Incompleto' | 'En revisión' | 'Pendiente ' | 'Zona Franca';
export type DigitacionStatus = 'Pendiente de Digitación' | 'En Proceso' | 'Almacenado' | 'Completar Trámite' | 'Trámite Completo' | 'Pendiente';
export type IncidentStatus = 'Pendiente' | 'Aprobada' | 'Rechazada';
export type PreliquidationStatus = 'Pendiente' | 'Aprobada';
export type ValueDoubtStatus = 'Proceso Administrativo' | 'Allanamiento';
export type IncidentType = 'Rectificacion' | 'Duda de Valor';
export type FacturacionStatus = 'Pendiente' | 'Enviado a Facturacion' | 'Facturado';
export type LastUpdateInfo = { by: string; at: Timestamp };

export interface ExecutiveComment {
  id: string;
  author: string;
  text: string;
  createdAt: Timestamp;
}


export interface AforoCase {
  id: string; // Will be the NE value
  ne: string;
  executive: string;
  consignee: string;
  facturaNumber?: string | null;
  declarationPattern: string;
  isPatternValidated?: boolean; // New field for pattern validation
  merchandise: string;
  aforador: string; // Name of the person
  assignmentDate: Date | Timestamp | null;
  createdBy: string; // UID of the user who created it
  createdAt: Timestamp;
  totalPosiciones?: number;
  entregadoAforoAt?: Timestamp | null;
  acuseDeRecibido?: boolean;
  
  revisorAsignado?: string | null;
  revisorAsignadoLastUpdate?: LastUpdateInfo | null;
  revisorStatus?: AforoCaseStatus;
  revisorStatusLastUpdate?: LastUpdateInfo | null;
  
  observacionRevisor?: string | null;
  aforadorStatus?: AforadorStatus;
  aforadorStatusLastUpdate?: LastUpdateInfo | null;
  aforadorComment?: string | null;
  worksheetId?: string; // Link to the original worksheet
  
  digitacionStatus?: DigitacionStatus;
  digitacionStatusLastUpdate?: LastUpdateInfo | null;
  digitadorAsignado?: string | null;
  digitadorAsignadoAt?: Timestamp | null;
  digitadorAsignadoLastUpdate?: LastUpdateInfo | null;
  digitacionComment?: string | null;
  declaracionAduanera?: string | null; // Customs declaration number
  
  incidentType?: IncidentType;
  incidentReported?: boolean;
  incidentReason?: string | null; // Original simple reason
  incidentStatus?: IncidentStatus;
  incidentStatusLastUpdate?: LastUpdateInfo | null;
  incidentReportedBy?: string | null; // displayName of user
  incidentReportedAt?: Timestamp | null;
  incidentReviewedBy?: string | null; // displayName of agent
  incidentReviewedAt?: Timestamp | null;
  
  reciboDeCajaPagoInicial?: string | null;
  pagoInicialRealizado?: boolean;
  montoPagoInicial?: number | null;
  noLiquidacion?: string | null;
  motivoRectificacion?: string | null;
  observaciones?: string | null;
  observacionesContabilidad?: string | null;

  preliquidationStatus?: PreliquidationStatus;
  preliquidationStatusLastUpdate?: LastUpdateInfo | null;

  selectividad?: string | null;
  fechaDespacho?: Timestamp | null;
  
  facturacionStatus?: FacturacionStatus;
  enviadoAFacturacionAt?: Timestamp | null;
  facturadoAt?: Timestamp | null;
  cuentaDeRegistro?: string | null;
  facturadorAsignado?: string | null;
  facturadorAsignadoAt?: Timestamp | null;
  remisionId?: string | null; // ID of the remision document


  hasValueDoubt?: boolean;
  valueDoubtNotificationDate?: Timestamp | null;
  valueDoubtDueDate?: Timestamp | null;
  valueDoubtAmount?: number | null;
  valueDoubtStatus?: ValueDoubtStatus | null;
  valueDoubtAssignedToLegal?: boolean;
  valueDoubtExtensionRequested?: boolean;
  valueDoubtLevanteRequested?: boolean;

  executiveComments?: ExecutiveComment[];
  involvedUsers?: string[]; // Array of user UIDs involved in the incident

  pagos?: SolicitudRecord[];
  
  // RESA fields
  resaNumber?: string | null;
  resaNotificationDate?: Timestamp | null;
  resaDueDate?: Timestamp | null;
  
  isArchived?: boolean;
}

export interface AforoCaseUpdate {
    updatedAt: Timestamp | Date;
    updatedBy: string; // displayName of the user
    field: keyof AforoCase | 'status_change' | 'creation' | 'incident_report' | 'document_update' | 'value_doubt_report';
    oldValue: any;
    newValue: any;
    comment?: string; // For rejection reasons
}

export type DocumentStatus = 'Entregado' | 'En Trámite' | 'Pendiente' | 'Rechazado' | 'Sometido de Nuevo';

export interface WorksheetDocument {
  id: string; 
  type: string;
  number: string;
  isCopy: boolean;
  status?: DocumentStatus;
  [key: string]: any; // Allow other properties
}

export interface PermitComment {
    id: string;
    author: string;
    text: string;
    createdAt: Timestamp;
}

export interface RequiredPermit {
    id: string;
    name: string;
    status: DocumentStatus;
    facturaNumber?: string;
    tramiteDate?: Timestamp | null;
    estimatedDeliveryDate?: Timestamp | null;
    assignedExecutive?: string;
    comments?: PermitComment[];
    // Unified field
    tipoTramite?: string;
    // INE Specific fields
    item?: string;
    marcaEquipo?: string;
    modeloEquipo?: string;
    equipoType?: 'Refrigerador' | 'Aire Acondicionado';
}


export interface Worksheet {
  id: string; // The NE
  worksheetType?: 'hoja_de_trabajo' | 'anexo_5' | 'anexo_7' | 'corporate_report';
  ne: string;
  executive: string;
  consignee: string;
  eta?: Timestamp | null;
  appliesTLC?: boolean;
  tlcName?: string;
  appliesModexo?: boolean;
  modexoCode?: string;
  resa?: string | null; 
  facturaNumber?: string | null;
  grossWeight: string;
  netWeight: string;
  description: string;
  packageNumber: string;
  entryCustoms: string;
  dispatchCustoms: string;
  transportMode: 'aereo' | 'maritimo' | 'frontera' | 'terrestre';
  transportDocumentType?: 'guia_aerea' | 'bl' | 'carta_porte' | null;
  transportCompany?: string | null;
  transportDocumentNumber?: string | null;
  inLocalWarehouse: boolean;
  inCustomsWarehouse: boolean;
  location?: string;
  documents: WorksheetDocument[];
  requiredPermits: RequiredPermit[];
  operationType?: 'importacion' | 'exportacion' | null;
  patternRegime?: string;
  subRegime?: string;
  isJointOperation: boolean;
  jointNe?: string;
  jointReference?: string;
  dcCorrespondiente?: string;
  isSplit?: boolean;
  observations?: string;
  createdAt: Timestamp;
  lastUpdatedAt?: Timestamp;
  createdBy: string; // user email
  // Anexo 5 / 7 Fields
  ruc?: string;
  codigoAduanero?: string;
  marcaVehiculo?: string;
  placaVehiculo?: string;
  motorVehiculo?: string;
  chasisVehiculo?: string;
  vin?: string;
  nombreConductor?: string;
  licenciaConductor?: string;
  cedulaConductor?: string;
  tipoMedio?: string;
  pesoVacioVehiculo?: string;
  aforador?: string;
  precinto?: string;
  precintoLateral?: string;
  // New anexo_7 fields
  almacenSalida?: string;
  codigoAlmacen?: string;
  // corporate_report fields
  proveedor?: string;
  fechaEnvioCliente?: Timestamp | null;
  proveedorTransporte?: string;
  fechaNacionalizacion?: Timestamp | null;
  selectividad?: 'verde' | 'amarillo' | 'rojo' | null;
  fechaDespacho?: Timestamp | null;
  // Totals for anexo
  cantidadTotal?: number;
  unidadMedidaTotal?: string;
  resaNotificationDate?: Timestamp | null;
  resaDueDate?: Timestamp | null;
  isArchived?: boolean;
}

export interface WorksheetWithCase extends AforoCase {
    worksheet: Worksheet | null;
    acuseDeRecibido?: boolean;
    acuseLog?: AforoCaseUpdate | null;
}

export interface PreliquidacionItem {
    id: string;
    description: string;
    value: number;
    tax: number;
}

export interface Preliquidation {
    id: string;
    caseId: string;
    noLiquidacion: string;
    totalGravamen: number;
    totalMultas: number;
    totalGeneral: number;
    items: PreliquidacionItem[];
    createdAt: Timestamp;
    createdBy: string;
}

export interface InitialDataContext {
  id?: string;
  ne: string;
  reference?: string;
  manager: string;
  date: Date;
  recipient: string;
  isMemorandum: boolean;
  // New fields for pre-filling data from AforoCase
  consignee?: string;
  declaracionAduanera?: string | null;
  caseId?: string; // To link back to the AforoCase
}

export interface SolicitudData {
  id: string;
  monto?: number;
  montoMoneda?: 'cordoba' | 'dolar' | 'euro';
  cantidadEnLetras?: string;
  consignatario?: string;
  declaracionNumero?: string;
  unidadRecaudadora?: string;
  codigo1?: string;
  codigo2?: string;
  banco?: 'BAC' | 'BANPRO' | 'BANCENTRO' | 'FICOSHA' | 'AVANZ' | 'ATLANTIDA' | 'ACCION POR CHEQUE/NO APLICA BANCO' | 'Otros';
  bancoOtros?: string;
  numeroCuenta?: string;
  monedaCuenta?: 'cordoba' | 'dolar' | 'euro' | 'Otros';
  monedaCuentaOtros?: string;
  elaborarChequeA?: string;
  elaborarTransferenciaA?: string;
  impuestosPagadosCliente?: boolean;
  impuestosPagadosRC?: string;
  impuestosPagadosTB?: string;
  impuestosPagadosCheque?: string;
  impuestosPendientesCliente?: boolean;
  soporte?: boolean;
  documentosAdjuntos?: boolean;
  constanciasNoRetencion?: boolean;
  constanciasNoRetencion1?: boolean;
  constanciasNoRetencion2?: boolean;
  pagoServicios?: boolean;
  tipoServicio?: 'COMIECO' | 'MARCHAMO' | 'FUMIGACION' | 'RECORRIDO' | 'EPN' | 'ANALISIS_Y_LABORATORIO' | 'OTROS';
  otrosTipoServicio?: string;
  facturaServicio?: string;
  institucionServicio?: string;
  correo?: string;
  observation?: string;
  isMemorandum?: boolean;
  memorandumCollaborators?: { id: string; name: string; number: string; }[];
}


export interface SolicitudRecord {
  examNe: string;
  examReference: string | null;
  examManager: string;
  examDate: Date | undefined;
  examRecipient: string;
  solicitudId: string;
  monto: number | null;
  montoMoneda: 'cordoba' | 'dolar' | 'euro' | null;
  cantidadEnLetras: string | null;
  consignatario: string | null;
  declaracionNumero: string | null;
  unidadRecaudadora: string | null;
  codigo1: string | null;
  codigo2: string | null;
  banco: 'BAC' | 'BANPRO' | 'BANCENTRO' | 'FICOSHA' | 'AVANZ' | 'ATLANTIDA' | 'ACCION POR CHEQUE/NO APLICA BANCO' | 'Otros' | null;
  bancoOtros: string | null;
  numeroCuenta: string | null;
  monedaCuenta: 'cordoba' | 'dolar' | 'euro' | 'Otros' | null;
  monedaCuentaOtros: string | null;
  elaborarChequeA: string | null;
  elaborarTransferenciaA: string | null;
  impuestosPagadosCliente: boolean;
  impuestosPagadosRC: string | null;
  impuestosPagadosTB: string | null;
  impuestosPagadosCheque: string | null;
  impuestosPendientesCliente: boolean;
  soporte: boolean;
  documentosAdjuntos: boolean;
  constanciasNoRetencion: boolean;
  constanciasNoRetencion1: boolean;
  constanciasNoRetencion2: boolean;
  pagoServicios: boolean;
  tipoServicio: 'COMIECO' | 'MARCHAMO' | 'FUMIGACION' | 'RECORRIDO' | 'EPN' | 'ANALISIS_Y_LABORATORIO' | 'OTROS' | null;
  otrosTipoServicio: string | null;
  facturaServicio: string | null;
  institucionServicio: string | null;
  correo: string | null;
  observation: string | null;
  isMemorandum: boolean;
  memorandumCollaborators?: { id: string; name: string; number: string; }[] | null;
  savedAt: Date | undefined;
  savedBy: string | null;
  paymentStatus: string | null;
  paymentStatusLastUpdatedBy: string | null;
  paymentStatusLastUpdatedAt: Date | undefined;
  minutaNumber?: string | null;
  recepcionDCStatus: boolean;
  recepcionDCLastUpdatedBy: string | null;
  recepcionDCLastUpdatedAt: Date | undefined;
  emailMinutaStatus: boolean;
  emailMinutaLastUpdatedBy: string | null;
  emailMinutaLastUpdatedAt: Date | undefined;
  rhPaymentStatus: 'caso_no_iniciado' | 'en_tramite_rh' | 'pagado_efectivo' | 'proceso_deduccion' | 'otros' | null;
  rhPaymentOtherDetails: string | null;
  rhPaymentDate: Date | undefined;
  rhPaymentStartDate: Date | undefined;
  rhPaymentEndDate: Date | undefined;
  rhStatusLastUpdatedAt: Date | undefined;
  rhStatusLastUpdatedBy: string | null;
  commentsCount: number;
  hasOpenUrgentComment?: boolean;
}

export interface DeletionAuditEvent {
  id: string;
  action: 'deleted';
  deletedBy: string;
  deletedAt: Timestamp;
}

export interface ValidacionRecord {
  id: string;
  resolvedBy: string;
  resolvedAt: Timestamp;
  duplicateKey: string;
  duplicateIds: string[];
  resolutionStatus: 'validated_not_duplicate' | 'deletion_requested';
  ne: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: Timestamp;
  linkUrl?: string;
  linkText?: string;
}

export interface LegalServiceItem {
  serviceType: string;
  quantity: number;
  // INE Specific fields
  factura?: string;
  contenedor?: string;
  item?: string;
  marcaEquipo?: string;
  modeloEquipo?: string;
  equipoType?: 'Refrigerador' | 'Aire Acondicionado';
}

export interface LegalRequest {
  id: string;
  ne: string;
  consignee: string;
  services: LegalServiceItem[];
  observations?: string;
  authorizedByClient: boolean;
  status: 'pendiente' | 'en_proceso' | 'completado' | 'rechazado';
  requestedBy: string;
  requestedAt: Timestamp;
  completedAt?: Timestamp;
  completedBy?: string;
}

export interface RemisionCase {
  ne: string;
  reference: string;
  consignee: string;
  cuentaDeRegistro: string;
}

export interface Remision {
  id: string;
  recipientName: string;
  createdAt: Timestamp;
  createdBy: string;
  totalCases: number;
  cases: RemisionCase[];
}
