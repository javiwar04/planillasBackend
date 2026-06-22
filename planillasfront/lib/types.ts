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
