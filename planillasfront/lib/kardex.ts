import { money } from "@/lib/format";
import type { Empleado } from "@/lib/types";

// Datos del kardex de personal, ya formateados, organizados por secciones.
// Lo comparten la exportación a Excel (con estilo) y la vista imprimible a PDF.

const CONTRATOS: Record<string, string> = {
  INDEFINIDO: "Indefinido", TEMPORAL: "Temporal", POR_TEMPORADA: "Por temporada", POR_OBRA: "Por obra",
};
export const etiquetaContrato = (t?: string | null) => (t ? CONTRATOS[t] ?? t : "No registrado");
export const etiquetaJornada = (j?: string | null) => (j === "PARCIAL" ? "Parcial" : j === "COMPLETA" ? "Completa" : "No registrada");
export const fechaGt = (s?: string | null) => {
  if (!s) return null;
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
};

export interface SeccionKardex { titulo: string; campos: [string, string][] }

export function kardexSecciones(e: Empleado, puestoNombre: string): SeccionKardex[] {
  const nd = "No registrado";
  return [
    {
      titulo: "1. Información general",
      campos: [
        ["Código", e.codigo || "Sin código"],
        ["Nombre completo", `${e.nombres} ${e.apellidos}`],
        ["Tipo", e.tipo],
        ["Activo", e.activo ? "Sí" : "No"],
        ["DPI", e.dpi || nd],
        ["NIT", e.nit || nd],
      ],
    },
    {
      titulo: "2. Datos laborales",
      campos: [
        ["Establecimiento", e.establecimientoNombre || nd],
        ["Departamento", e.departamentoNombre || nd],
        ["Puesto", puestoNombre || nd],
        ["Supervisor", e.supervisorEfectivo || nd],
        ["Contrato", etiquetaContrato(e.tipoContrato)],
        ["Jornada", etiquetaJornada(e.jornada)],
        ["Convenio colectivo", e.convenioColectivo || nd],
        ["Fecha ingreso", fechaGt(e.fechaIngreso) || nd],
        ["Sueldo base", money(e.sueldoBase)],
        ["Quincena", money(e.montoQuincena)],
      ],
    },
    {
      titulo: "3. Información bancaria y contacto",
      campos: [
        ["Banco", e.banco || nd],
        ["Cuenta", e.cuentaBanco || nd],
        ["Teléfono", e.telefono || nd],
        ["Correo", e.email || nd],
        ["Dirección", e.direccion || nd],
      ],
    },
    {
      titulo: "4. Documentos, seguro y salud",
      campos: [
        ["Afiliación IGSS", e.noAfiliacionIgss || nd],
        ["Póliza seguro", e.noPolizaSeguro || nd],
        ["Tipo de sangre", e.tipoSangre || nd],
        ["Alergias", e.alergias || "No registradas"],
        ["Aptitud médica vence", fechaGt(e.aptitudMedicaVence) || "No registrado"],
        ["Carnet manipulador vence", fechaGt(e.carnetManipuladorVence) || "No registrado"],
      ],
    },
    {
      titulo: "5. Contacto de emergencia",
      campos: [
        ["Contacto", e.contactoEmergenciaNombre || nd],
        ["Parentesco", e.contactoEmergenciaParentesco || nd],
        ["Teléfono emergencia", e.contactoEmergenciaTelefono || nd],
        ["Fecha baja", fechaGt(e.fechaBaja) || "No aplica"],
      ],
    },
  ];
}
