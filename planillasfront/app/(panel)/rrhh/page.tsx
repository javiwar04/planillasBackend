"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { exportarExcel } from "@/lib/excel";
import { exportarKardexExcel } from "@/lib/kardexExcel";
import { SkeletonRows } from "@/components/Skeleton";
import { usePaginado, Paginacion } from "@/components/Paginacion";
import type { Empleado, Establecimiento, Puesto } from "@/lib/types";

const CONTRATOS: Record<string, string> = {
  INDEFINIDO: "Indefinido", TEMPORAL: "Temporal", POR_TEMPORADA: "Por temporada", POR_OBRA: "Por obra",
};
const etiquetaContrato = (t?: string | null) => (t ? CONTRATOS[t] ?? t : "—");
const etiquetaJornada = (j?: string | null) => (j === "PARCIAL" ? "Parcial" : j === "COMPLETA" ? "Completa" : "—");

// Kardex de personal: listado maestro de todos los colaboradores con sus datos de
// RRHH, con buscador, filtro por establecimiento y exportación a Excel. Cada fila
// enlaza al expediente individual (donde está el detalle completo + kardex individual).
export default function RrhhPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [puestos, setPuestos] = useState<Map<number, string>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstab, setFiltroEstab] = useState(0);
  const [incluirBajas, setIncluirBajas] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [emps, ests, pues] = await Promise.all([
        api<Empleado[]>(`/empleados?soloActivos=${incluirBajas ? "false" : "true"}`),
        api<Establecimiento[]>("/establecimientos?soloActivos=false"),
        api<Puesto[]>("/puestos"),
      ]);
      setEmpleados(emps);
      setEstablecimientos(ests);
      setPuestos(new Map(pues.map((p) => [p.puestoId, p.nombre])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los colaboradores.");
    } finally {
      setCargando(false);
    }
  }, [incluirBajas]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => empleados.filter((e) => {
    if (filtroEstab && e.establecimientoId !== filtroEstab) return false;
    const t = busqueda.toLowerCase();
    return !t || `${e.nombres} ${e.apellidos} ${e.nit ?? ""} ${e.codigo ?? ""}`.toLowerCase().includes(t);
  }), [empleados, busqueda, filtroEstab]);

  const pag = usePaginado(filtrados);

  function exportar() {
    const filas = filtrados.map((e) => ({
      Código: e.codigo ?? "",
      Nombres: e.nombres,
      Apellidos: e.apellidos,
      NIT: e.nit ?? "",
      DPI: e.dpi ?? "",
      Tipo: e.tipo,
      Establecimiento: e.establecimientoNombre ?? "",
      Departamento: e.departamentoNombre ?? "",
      Puesto: e.puestoId ? (puestos.get(e.puestoId) ?? "") : "",
      Supervisor: e.supervisorEfectivo ?? "",
      "Tipo de contrato": etiquetaContrato(e.tipoContrato),
      Jornada: etiquetaJornada(e.jornada),
      "Convenio colectivo": e.convenioColectivo ?? "",
      "Sueldo base": e.sueldoBase,
      Quincena: e.montoQuincena,
      Banco: e.banco ?? "",
      Cuenta: e.cuentaBanco ?? "",
      Teléfono: e.telefono ?? "",
      Correo: e.email ?? "",
      Dirección: e.direccion ?? "",
      "No. afiliación IGSS": e.noAfiliacionIgss ?? "",
      "No. póliza seguro": e.noPolizaSeguro ?? "",
      "Tipo de sangre": e.tipoSangre ?? "",
      "Contacto emergencia": e.contactoEmergenciaNombre ?? "",
      Parentesco: e.contactoEmergenciaParentesco ?? "",
      "Tel. emergencia": e.contactoEmergenciaTelefono ?? "",
      "Aptitud médica vence": e.aptitudMedicaVence ?? "",
      "Carnet manipulador vence": e.carnetManipuladorVence ?? "",
      Alergias: e.alergias ?? "",
      "Fecha ingreso": e.fechaIngreso ?? "",
      "Fecha baja": e.fechaBaja ?? "",
      Activo: e.activo ? "Sí" : "No",
    }));
    exportarExcel(`kardex_personal_${new Date().toISOString().slice(0, 10)}`, filas, "Kardex");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recursos Humanos · Kardex</h1>
          <p className="text-sm text-slate-500">Expediente de personal de toda la corporación. Clic en un colaborador para ver su ficha completa.</p>
        </div>
        <button onClick={exportar} disabled={filtrados.length === 0} className="btn-primary">
          Exportar Excel
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Buscar nombre, NIT o código…"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select className="input max-w-xs" value={filtroEstab} onChange={(e) => setFiltroEstab(Number(e.target.value))}>
          <option value={0}>Todos los establecimientos</option>
          {establecimientos.map((es) => (
            <option key={es.establecimientoId} value={es.establecimientoId}>{es.nombre}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={incluirBajas} onChange={(e) => setIncluirBajas(e.target.checked)} />
          Incluir bajas
        </label>
        <span className="ml-auto text-sm text-slate-500">{filtrados.length} colaboradores</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Colaborador</th>
                <th className="th">Establecimiento</th>
                <th className="th">Puesto</th>
                <th className="th">Supervisor</th>
                <th className="th">Contrato</th>
                <th className="th">Jornada</th>
                <th className="th">Ingreso</th>
                <th className="th text-right">Kardex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <SkeletonRows cols={8} />
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={8} className="td py-10 text-center text-slate-400">Sin coincidencias.</td></tr>
              ) : (
                pag.visibles.map((e) => (
                  <tr key={e.empleadoId} className="hover:bg-slate-50">
                    <td className="td">
                      <Link href={`/empleados/${e.empleadoId}`} className="font-medium text-brand-700 hover:underline">
                        {e.nombres} {e.apellidos}
                      </Link>
                      {!e.activo && <span className="ml-2 badge bg-slate-100 text-slate-500">Baja</span>}
                      <div className="text-xs text-slate-400">{e.nit ?? "sin NIT"}</div>
                    </td>
                    <td className="td text-slate-600">{e.establecimientoNombre ?? "—"}</td>
                    <td className="td text-slate-600">{e.puestoId ? (puestos.get(e.puestoId) ?? "—") : "—"}</td>
                    <td className="td text-slate-600">{e.supervisorEfectivo ?? "—"}</td>
                    <td className="td text-slate-600">{etiquetaContrato(e.tipoContrato)}</td>
                    <td className="td text-slate-600">{etiquetaJornada(e.jornada)}</td>
                    <td className="td text-slate-600">{e.fechaIngreso ?? "—"}</td>
                    <td className="td text-right whitespace-nowrap">
                      <button onClick={() => exportarKardexExcel(e, e.puestoId ? (puestos.get(e.puestoId) ?? "") : "").catch(() => {})}
                        className="mr-3 font-medium text-brand-700 hover:underline">Excel</button>
                      <a href={`/empleados/${e.empleadoId}/kardex`} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-slate-600 hover:underline">PDF</a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacion {...pag} />
      </div>
    </div>
  );
}
