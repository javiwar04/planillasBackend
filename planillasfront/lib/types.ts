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
export type TipoPeriodo = "QUINCENA" | "FIN_MES";
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
