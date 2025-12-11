"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import type { SolicitudData, InitialDataContext } from '@/types';
import { Check, ArrowLeft, User, Landmark, FileText, Banknote, Hash, Users, Mail, MessageSquare, Building, Code, CalendarDays, Info, Send, CheckSquare, Square, Settings2, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


const PreviewDetailItem: React.FC<{ label: string; value?: string | number | null | boolean | Date, icon?: React.ElementType, className?: string }> = ({ label, value, icon: Icon, className }) => {
  let displayValue: string;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else if (value instanceof Date) {
    displayValue = format(value, "PPP", { locale: es });
  }
  else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div className={cn("py-1", className)}>
      <p className="text-xs font-medium text-muted-foreground flex items-center">
         {Icon && <Icon className="h-3.5 w-3.5 mr-1.5 text-primary/70" />}
         {label}
      </p>
      <p className="text-sm text-foreground break-words">{displayValue}</p>
    </div>
  );
};

const CheckboxPreviewItem: React.FC<{ label: string; checked?: boolean; subLabel?: string }> = ({ label, checked, subLabel }) => (
  <div className="flex items-center py-1">
    {checked ? <CheckSquare className="h-4 w-4 text-green-600 mr-2" /> : <Square className="h-4 w-4 text-muted-foreground mr-2" />}
    <span className="text-sm text-foreground">{label}</span>
    {subLabel && <span className="text-xs text-muted-foreground ml-1">{subLabel}</span>}
  </div>
);

const formatCurrencyPreview = (amount?: number | string, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';
    return `${prefix}${num.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getBancoDisplayPreview = (solicitud: SolicitudData) => {
    if (solicitud.banco === 'ACCION POR CHEQUE/NO APLICA BANCO') return 'Acción por Cheque / No Aplica Banco';
    if (solicitud.banco === 'Otros') return solicitud.bancoOtros || 'Otros (No especificado)';
    return solicitud.banco;
};

const getMonedaCuentaDisplayPreview = (solicitud: SolicitudData) => {
    if (solicitud.monedaCuenta === 'Otros') return solicitud.monedaCuentaOtros || 'Otros (No especificado)';
    return solicitud.monedaCuenta;
};


export function PreviewScreen() {
  const { initialContextData, solicitudes, setCurrentStep, isMemorandumMode } = useAppContext();

  if (!initialContextData) {
    return (
       <Card className="w-full custom-shadow">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Vista Previa de la Solicitud de Cheque</CardTitle>
          <CardDescription className="text-muted-foreground">Cargando datos iniciales...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-10 text-muted-foreground">
            No se encontraron datos iniciales. Por favor, inicie una nueva solicitud.
            <Button onClick={() => setCurrentStep(ExamStep.INITIAL_DATA)} className="mt-4">
              Ir al Inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleConfirm = () => {
    setCurrentStep(ExamStep.SUCCESS);
  };

  return (
    <Card className="w-full custom-shadow">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Vista Previa de la Solicitud de Cheque</CardTitle>
        <CardDescription className="text-muted-foreground">Revise la información antes de confirmar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-lg font-medium mb-2 text-foreground">Informacion General</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-secondary/30 p-4 rounded-md shadow-sm text-sm">
            <PreviewDetailItem label="A (Destinatario)" value={initialContextData.recipient} icon={Send} />
            <PreviewDetailItem label="De (Usuario)" value={initialContextData.manager} icon={User} />
            <PreviewDetailItem label="Fecha de Solicitud" value={initialContextData.date} icon={CalendarDays} />
            <PreviewDetailItem label="NE (Tracking NX1)" value={initialContextData.ne} icon={Info} />
            <PreviewDetailItem label="Referencia" value={initialContextData.reference || 'N/A'} icon={FileText} />
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium mb-3 text-foreground">Solicitudes ({solicitudes.length})</h4>
          {solicitudes.length > 0 ? (
            <ScrollArea className="h-[400px] w-full">
              <div className="space-y-6 pr-4">
                {solicitudes.map((solicitud, index) => (
                  <div key={solicitud.id} className="p-4 border border-border bg-card rounded-lg shadow">
                    <h5 className="text-md font-semibold mb-3 text-primary flex justify-between items-center">
                      <span>Solicitud {index + 1} ({solicitud.id})</span>
                      {isMemorandumMode && (
                        <Badge variant="destructive"><StickyNote className="h-3.5 w-3.5 mr-1.5" />Memorándum</Badge>
                      )}
                    </h5>

                    {isMemorandumMode && solicitud.memorandumCollaborators && solicitud.memorandumCollaborators.length > 0 && (
                      <div className="mb-3 p-3 border border-destructive/50 rounded-md bg-destructive/5">
                        <h6 className="text-sm font-medium text-destructive mb-1">Colaboradores</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                          {solicitud.memorandumCollaborators.map(collab => (
                            <div key={collab.id} className="text-xs">
                              <p><span className="font-semibold">Nombre:</span> {collab.name}</p>
                              <p><span className="font-semibold">Número:</span> {collab.number}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}


                    <div className="space-y-3 divide-y divide-border/50">

                      <div className="pt-2">
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Por este medio me dirijo a usted para solicitarle que elabore cheque por la cantidad de:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 items-start mb-2">
                            <div className="flex items-baseline py-1">
                               <Banknote className="h-4 w-4 mr-1.5 text-primary shrink-0" />
                               <p className="text-sm text-foreground break-words">{formatCurrencyPreview(solicitud.monto, solicitud.montoMoneda)}</p>
                            </div>
                            <div className="flex items-baseline py-1">
                                <FileText className="h-4 w-4 mr-1.5 text-primary shrink-0" />
                                <p className="text-sm text-foreground break-words">{solicitud.cantidadEnLetras || 'N/A'}</p>
                            </div>
                        </div>
                      </div>


                      <div className="pt-3">
                        <h6 className="text-sm font-medium text-accent mb-1">Información Adicional</h6>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
                           <PreviewDetailItem label="Consignatario" value={solicitud.consignatario} icon={Users} />
                           <PreviewDetailItem label="Declaración Número" value={solicitud.declaracionNumero} icon={Hash} />
                           <PreviewDetailItem label="Unidad Recaudadora" value={solicitud.unidadRecaudadora} icon={Building} />
                           <PreviewDetailItem label="Código 1" value={solicitud.codigo1} icon={Code} />
                           <PreviewDetailItem label="Codigo MUR" value={solicitud.codigo2} icon={Code} />
                         </div>
                      </div>


                      <div className="pt-3">
                        <h6 className="text-sm font-medium text-accent mb-1">Cuenta Bancaria</h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 items-start">
                          <PreviewDetailItem label="Banco" value={getBancoDisplayPreview(solicitud)} icon={Landmark} />
                          {solicitud.banco !== 'ACCION POR CHEQUE/NO APLICA BANCO' && (
                            <>
                              <PreviewDetailItem label="Número de Cuenta" value={solicitud.numeroCuenta} icon={Hash} />
                              <PreviewDetailItem label="Moneda de la Cuenta" value={getMonedaCuentaDisplayPreview(solicitud)} icon={Banknote} />
                            </>
                          )}
                        </div>
                      </div>


                      <div className="pt-3">
                        <h6 className="text-sm font-medium text-accent mb-1">Beneficiario del Pago</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                          <PreviewDetailItem label="Elaborar Cheque A" value={solicitud.elaborarChequeA} icon={User} />
                          <PreviewDetailItem label="Elaborar Transferencia A" value={solicitud.elaborarTransferenciaA} icon={User} />
                        </div>
                      </div>


                      <div className="pt-3">
                        <h6 className="text-sm font-medium text-accent mb-1">Documentación y Estados</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <div className="space-y-1">
                                <CheckboxPreviewItem label="Impuestos pendientes de pago por el cliente" checked={solicitud.impuestosPendientesCliente} />
                                <CheckboxPreviewItem label="Soporte" checked={solicitud.soporte} />
                                <CheckboxPreviewItem label="Impuestos pagados por el cliente" checked={solicitud.impuestosPagadosCliente} />
                                {solicitud.impuestosPagadosCliente && (
                                <div className="ml-6 pl-2 border-l border-dashed text-xs">
                                    <PreviewDetailItem label="R/C No." value={solicitud.impuestosPagadosRC} />
                                    <PreviewDetailItem label="T/B No." value={solicitud.impuestosPagadosTB} />
                                    <PreviewDetailItem label="Cheque No." value={solicitud.impuestosPagadosCheque} />
                                </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <CheckboxPreviewItem label="Se añaden documentos adjuntos" checked={solicitud.documentosAdjuntos} />
                                <CheckboxPreviewItem label="Constancias de no retención" checked={solicitud.constanciasNoRetencion} />
                                {solicitud.constanciasNoRetencion && (
                                <div className="ml-6 pl-2 border-l border-dashed text-xs">
                                    <CheckboxPreviewItem label="1%" checked={solicitud.constanciasNoRetencion1} />
                                    <CheckboxPreviewItem label="2%" checked={solicitud.constanciasNoRetencion2} />
                                </div>
                                )}
                            </div>
                        </div>
                      </div>

                      {solicitud.pagoServicios && (
                        <div className="pt-3">
                          <h6 className="text-sm font-medium text-accent mb-1">Pago de Servicios</h6>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                            <PreviewDetailItem label="Tipo de Servicio" value={solicitud.tipoServicio === 'OTROS' ? solicitud.otrosTipoServicio : solicitud.tipoServicio} icon={Settings2} />
                            <PreviewDetailItem label="Factura Servicio" value={solicitud.facturaServicio} icon={FileText} />
                            <PreviewDetailItem label="Institución Servicio" value={solicitud.institucionServicio} icon={Building} />
                          </div>
                        </div>
                      )}

                      <div className="pt-3">
                        <h6 className="text-sm font-medium text-accent mb-1">Comunicación</h6>
                        <PreviewDetailItem label="Correos de Notificación" value={solicitud.correo} icon={Mail} />
                        <PreviewDetailItem label="Observación" value={solicitud.observation} icon={MessageSquare} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground">No hay solicitudes para mostrar.</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-border mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(ExamStep.PRODUCT_LIST)} className="hover:bg-accent/50 w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Lista de Solicitudes
            </Button>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center sm:justify-end gap-3">
                <Button onClick={handleConfirm} className="btn-primary w-full sm:w-auto">
                    <Check className="mr-2 h-4 w-4" /> Confirmar Solicitud
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
