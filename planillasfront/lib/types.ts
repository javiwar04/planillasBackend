// Tipos que reflejan los DTOs de la API CORPETUR.

export type Rol = "ADMIN" | "CONTABILIDAD" | "CAPTURA" | "LECTURA";

export interface Usuario {
  usuarioId: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export interface LoginResponse {
  token: string;
  expiraEn: string;
  usuario: Usuario;
}

export interface Auditoria {
  auditoriaId: number;
  fecha: string;
  usuarioId?: number | null;
  usuario?: string | null;
  accion: "CREAR" | "MODIFICAR" | "ELIMINAR";
  entidad: string;
  entidadId?: string | null;
  detalle?: string | null;
}

export interface UsuarioCreate {
  nombre: string;
  email: string;
  rol: Rol;
  password?: string | null;
}

export interface Establecimiento {
  establecimientoId: number;
  codigo: string;
  nombre: string;
  esEntidadContable: boolean;
  activo: boolean;
}

export interface Departamento {
  departamentoId: number;
  nombre: string;
}

export interface Puesto {
  puestoId: number;
  nombre: string;
}

export interface Vacacion {
  vacacionId: number;
  empleadoId: number;
  empleadoNombre?: string | null;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  observacion?: string | null;
}

export type TipoAusencia = "INCAPACIDAD" | "PERMISO_CON_GOCE" | "PERMISO_SIN_GOCE" | "FALTA" | "SUSPENSION";
export interface Ausencia {
  ausenciaId: number;
  empleadoId: number;
  empleadoNombre?: string | null;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  tipo: TipoAusencia;
  descontable: boolean;
  observacion?: string | null;
}

export interface EmpleadoMovimiento {
  empleadoMovimientoId: number;
  empleadoId: number;
  fecha: string;
  motivo?: string | null;
  establecimientoAnteriorId?: number | null;
  establecimientoAnterior?: string | null;
  establecimientoNuevoId?: number | null;
  establecimientoNuevo?: string | null;
  departamentoAnteriorId?: number | null;
  departamentoAnterior?: string | null;
  departamentoNuevoId?: number | null;
  departamentoNuevo?: string | null;
  puestoAnteriorId?: number | null;
  puestoAnterior?: string | null;
  puestoNuevoId?: number | null;
  puestoNuevo?: string | null;
  sueldoAnterior?: number | null;
  sueldoNuevo?: number | null;
}

export type TipoEmpleado = "PLANILLA" | "EXTRA";

export interface Empleado {
  empleadoId: number;
  codigo?: string | null;
  nombres: string;
  apellidos: string;
  dpi?: string | null;
  nit?: string | null;
  establecimientoId: number;
  establecimientoNombre?: string | null;
  departamentoId?: number | null;
  departamentoNombre?: string | null;
  puestoId?: number | null;
  tipo: TipoEmpleado;
  sueldoBase: number;
  montoQuincena: number;
  banco?: string | null;
  cuentaBanco?: string | null;
  fechaIngreso?: string | null;
  fechaBaja?: string | null;
  activo: boolean;
}

export interface EmpleadoCreate {
  codigo?: string | null;
  nombres: string;
  apellidos: string;
  dpi?: string | null;
  nit?: string | null;
  establecimientoId: number;
  departamentoId?: number | null;
  puestoId?: number | null;
  tipo: TipoEmpleado;
  sueldoBase: number;
  montoQuincena: number;
  banco?: string | null;
  cuentaBanco?: string | null;
  fechaIngreso?: string | null;
}

// --- Períodos ---
export type TipoPeriodo = "QUINCENA" | "FIN_MES" | "EXTRA";
export type EstadoPeriodo = "ABIERTO" | "CALCULADO" | "CERRADO";

export interface Periodo {
  periodoPagoId: number;
  anio: number;
  mes: number;
  tipo: TipoPeriodo;
  fechaInicio: string;
  fechaFin: string;
  fechaPago?: string | null;
  estado: EstadoPeriodo;
}

export interface PeriodoCreate {
  anio: number;
  mes: number;
  tipo: TipoPeriodo;
  fechaInicio: string;
  fechaFin: string;
  fechaPago?: string | null;
}

export interface GenerarResultado {
  periodoPagoId: number;
  tipo: string;
  estado: string;
  boletasCreadas: number;
  boletasActualizadas: number;
  empleadosPlanilla: number;
}

export interface ProvisionesResultado {
  anio: number;
  mes: number;
  generadas: number;
  actualizadas: number;
}

// --- Boletas ---
export type EstadoBoleta = "BORRADOR" | "CALCULADA" | "PAGADA";

export interface BoletaLista {
  boletaId: number;
  empleadoId: number;
  empleadoNombre: string;
  periodoPagoId: number;
  estado: EstadoBoleta;
  totalIngresos: number;
  totalEgresos: number;
  liquido: number;
}

export interface BoletaDetalle {
  boletaDetalleId: number;
  conceptoId: number;
  conceptoCodigo: string;
  conceptoNombre: string;
  naturaleza: "INGRESO" | "EGRESO";
  monto: number;
  descripcion?: string | null;
  esCalculado: boolean;
  prestamoMovimientoId?: number | null;
}

export interface Boleta {
  boletaId: number;
  empleadoId: number;
  empleadoNombre: string;
  periodoPagoId: number;
  estado: EstadoBoleta;
  totalIngresos: number;
  totalEgresos: number;
  liquido: number;
  observaciones?: string | null;
  detalles: BoletaDetalle[];
}

export interface Concepto {
  conceptoId: number;
  codigo: string;
  nombre: string;
  naturaleza: "INGRESO" | "EGRESO";
  esCalculado: boolean;
  orden: number;
  activo: boolean;
}

// --- Préstamos ---
export interface Prestamo {
  prestamoId: number;
  empleadoId: number;
  empleadoNombre?: string | null;
  tipo: string;
  montoOriginal: number;
  cuotaSugerida?: number | null;
  saldo: number;
  fechaInicio: string;
  estado: string;
}

export interface PrestamoMovimiento {
  prestamoMovimientoId: number;
  prestamoId: number;
  periodoPagoId?: number | null;
  fecha: string;
  tipo: "DESEMBOLSO" | "ABONO" | "AJUSTE";
  monto: number;
  saldoResultante: number;
}

// --- Declaración jurada anual (SAT) ---
export interface DeclaracionAnual {
  empleadoId: number;
  nombre: string;
  nit?: string | null;
  establecimiento?: string | null;
  sueldos: number;
  horasExtras: number;
  bonoDecreto: number;
  otrasBonificaciones: number;
  comisiones: number;
  propinas: number;
  aguinaldo: number;
  bono14: number;
  viaticos: number;
  gastoRepresentacion: number;
  dietas: number;
  gratificaciones: number;
  otrosIngresos: number;
  igssLaboral: number;
}

// --- Pasivo laboral (cuadro Kurt) ---
export interface ProvisionLaboral {
  provisionLaboralId: number;
  empleadoId: number;
  empleadoNombre?: string | null;
  anio: number;
  mes: number;
  baseCalculo: number;
  indemnizacion: number;
  bono14: number;
  aguinaldo: number;
  vacaciones: number;
  igssPatronal: number;
  intecap: number;
}

// --- Reparto de comisión ---
export interface RepartoResultadoItem {
  empleadoId: number;
  empleadoNombre: string;
  monto: number;
}
export interface RepartoResultado {
  montoTotal: number;
  montoRepartido: number;
  empleados: number;
  detalle: RepartoResultadoItem[];
}
