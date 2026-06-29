"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre, tipoPeriodoLabel } from "@/lib/format";
import type {
  Empleado, BoletaLista, Periodo, Prestamo, Vacacion, Ausencia, EmpleadoMovimiento, Puesto,
} from "@/lib/types";

type Tab = "boletas" | "prestamos" | "vacaciones" | "ausencias" | "traslados";
const DIA = 86400000;

export default function ExpedientePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [emp, setEmp] = useState<Empleado | null>(null);
  const [puesto, setPuesto] = useState<string>("");
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);
  const [periodos, setPeriodos] = useState<Record<number, Periodo>>({});
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [movs, setMovs] = useState<EmpleadoMovimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("boletas");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [e, bol, pers, pres, vac, aus, mv, pue] = await Promise.all([
        api<Empleado>(`/empleados/${id}`),
        api<BoletaLista[]>(`/boletas?empleadoId=${id}`),
        api<Periodo[]>("/periodospago"),
        api<Prestamo[]>(`/prestamos?empleadoId=${id}`),
        api<Vacacion[]>(`/vacaciones?empleadoId=${id}`),
        api<Ausencia[]>(`/ausencias?empleadoId=${id}`),
        api<EmpleadoMovimiento[]>(`/empleados/${id}/movimientos`),
        api<Puesto[]>("/puestos"),
      ]);
      setEmp(e);
      setBoletas(bol);
      setPeriodos(Object.fromEntries(pers.map((p) => [p.periodoPagoId, p])));
      setPrestamos(pres);
      setVacaciones(vac);
      setAusencias(aus);
      setMovs(mv);
      setPuesto(pue.find((p) => p.puestoId === e.puestoId)?.nombre ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el expediente.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalLiquido = useMemo(() => boletas.reduce((s, b) => s + b.liquido, 0), [boletas]);
  const saldoPrestamos = useMemo(
    () => prestamos.filter((p) => p.estado === "ACTIVO").reduce((s, p) => s + p.saldo, 0), [prestamos]);
  const vacDisponibles = useMemo(() => {
    if (!emp?.fechaIngreso) return null;
    const anios = Math.max(0, (Date.now() - new Date(emp.fechaIngreso).getTime()) / DIA / 365);
    return Math.round((15 * anios - vacaciones.reduce((s, v) => s + v.dias, 0)) * 100) / 100;
  }, [emp, vacaciones]);

  if (cargando) return <div className="card p-10 text-center text-slate-400">Cargando…</div>;
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!emp) return null;

  return (
    <div className="space-y-6">
      <Link href="/empleados" className="text-sm text-brand-700 hover:underline">← Colaboradores</Link>

      {/* Encabezado */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{emp.nombres} {emp.apellidos}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className={`badge ${emp.tipo === "PLANILLA" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-700"}`}>{emp.tipo}</span>
              <span className={`badge ${emp.activo ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>{emp.activo ? "Activo" : "Baja"}</span>
              <span>{emp.establecimientoNombre}</span>
              {puesto && <span>· {puesto}</span>}
            </div>
          </div>
          <a href={`/empleados/${emp.empleadoId}/constancia`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
            Constancia laboral
          </a>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <Dato k="NIT" v={emp.nit ?? "—"} />
          <Dato k="DPI" v={emp.dpi ?? "—"} />
          <Dato k="Departamento" v={emp.departamentoNombre ?? "—"} />
          <Dato k="Sueldo base" v={money(emp.sueldoBase)} />
          {emp.tipo === "PLANILLA" && <Dato k="Quincena" v={money(emp.montoQuincena)} />}
          <Dato k="Ingreso" v={emp.fechaIngreso ?? "—"} />
          {emp.fechaBaja && <Dato k="Baja" v={emp.fechaBaja} />}
          {emp.banco && <Dato k="Banco" v={`${emp.banco}${emp.cuentaBanco ? ` · ${emp.cuentaBanco}` : ""}`} />}
        </div>
      </div>

      {/* Datos personales y de RRHH */}
      <div className="card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Datos personales y de RRHH</div>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <Dato k="Teléfono" v={emp.telefono ?? "—"} />
          <Dato k="Correo" v={emp.email ?? "—"} />
          <Dato k="Dirección" v={emp.direccion ?? "—"} />
          <Dato k="No. afiliación IGSS" v={emp.noAfiliacionIgss ?? "—"} />
          <Dato k="No. póliza seguro" v={emp.noPolizaSeguro ?? "—"} />
          <Dato k="Tipo de sangre" v={emp.tipoSangre ?? "—"} />
          <Dato
            k="Contacto emergencia"
            v={emp.contactoEmergenciaNombre
              ? `${emp.contactoEmergenciaNombre}${emp.contactoEmergenciaParentesco ? ` (${emp.contactoEmergenciaParentesco})` : ""}${emp.contactoEmergenciaTelefono ? ` · ${emp.contactoEmergenciaTelefono}` : ""}`
              : "—"}
          />
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tarjeta titulo="Líquido histórico" valor={money(totalLiquido)} sub={`${boletas.length} boletas`} />
        <Tarjeta titulo="Saldo de préstamos" valor={money(saldoPrestamos)} sub={`${prestamos.filter((p) => p.estado === "ACTIVO").length} activos`} />
        <Tarjeta titulo="Vacaciones disponibles" valor={vacDisponibles === null ? "—" : `${vacDisponibles} días`} destacado />
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        <TabBtn a={tab === "boletas"} on={() => setTab("boletas")}>Boletas</TabBtn>
        <TabBtn a={tab === "prestamos"} on={() => setTab("prestamos")}>Préstamos</TabBtn>
        <TabBtn a={tab === "vacaciones"} on={() => setTab("vacaciones")}>Vacaciones</TabBtn>
        <TabBtn a={tab === "ausencias"} on={() => setTab("ausencias")}>Ausencias</TabBtn>
        <TabBtn a={tab === "traslados"} on={() => setTab("traslados")}>Traslados</TabBtn>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "boletas" && (
            <Tabla cols={["Período", "Tipo", "Ingresos", "Egresos", "Líquido", "Estado"]} vacio={boletas.length === 0}>
              {boletas.map((b) => {
                const p = periodos[b.periodoPagoId];
                return (
                  <tr key={b.boletaId} className="hover:bg-slate-50">
                    <td className="td">{p ? `${mesNombre(p.mes)} ${p.anio}` : "—"}</td>
                    <td className="td">{p ? tipoPeriodoLabel(p.tipo) : "—"}</td>
                    <td className="td text-right">{money(b.totalIngresos)}</td>
                    <td className="td text-right">{money(b.totalEgresos)}</td>
                    <td className="td text-right font-semibold">{money(b.liquido)}</td>
                    <td className="td"><span className="badge bg-slate-100 text-slate-600">{b.estado}</span></td>
                  </tr>
                );
              })}
            </Tabla>
          )}

          {tab === "prestamos" && (
            <Tabla cols={["Tipo", "Monto", "Saldo", "Estado", ""]} vacio={prestamos.length === 0}>
              {prestamos.map((p) => (
                <tr key={p.prestamoId} className="hover:bg-slate-50">
                  <td className="td">{p.tipo}</td>
                  <td className="td text-right">{money(p.montoOriginal)}</td>
                  <td className="td text-right font-semibold">{money(p.saldo)}</td>
                  <td className="td"><span className={`badge ${p.estado === "ACTIVO" ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>{p.estado}</span></td>
                  <td className="td text-right"><Link href={`/prestamos/${p.prestamoId}`} className="font-medium text-brand-700 hover:underline">Movimientos</Link></td>
                </tr>
              ))}
            </Tabla>
          )}

          {tab === "vacaciones" && (
            <Tabla cols={["Desde", "Hasta", "Días", "Observación"]} vacio={vacaciones.length === 0}>
              {vacaciones.map((v) => (
                <tr key={v.vacacionId} className="hover:bg-slate-50">
                  <td className="td">{v.fechaInicio}</td>
                  <td className="td">{v.fechaFin}</td>
                  <td className="td text-right font-semibold">{v.dias}</td>
                  <td className="td text-slate-600">{v.observacion ?? "—"}</td>
                </tr>
              ))}
            </Tabla>
          )}

          {tab === "ausencias" && (
            <Tabla cols={["Tipo", "Desde", "Hasta", "Días", "Descontable"]} vacio={ausencias.length === 0}>
              {ausencias.map((a) => (
                <tr key={a.ausenciaId} className="hover:bg-slate-50">
                  <td className="td">{a.tipo}</td>
                  <td className="td">{a.fechaInicio}</td>
                  <td className="td">{a.fechaFin}</td>
                  <td className="td text-right font-semibold">{a.dias}</td>
                  <td className="td">{a.descontable ? "Sí" : "No"}</td>
                </tr>
              ))}
            </Tabla>
          )}

          {tab === "traslados" && (
            <Tabla cols={["Fecha", "Cambio", "Motivo"]} vacio={movs.length === 0}>
              {movs.map((m) => (
                <tr key={m.empleadoMovimientoId} className="hover:bg-slate-50 align-top">
                  <td className="td">{m.fecha}</td>
                  <td className="td text-xs text-slate-600">
                    {m.establecimientoNuevo && <div>Establecimiento: {m.establecimientoAnterior ?? "—"} → <b>{m.establecimientoNuevo}</b></div>}
                    {m.departamentoNuevo && <div>Departamento: {m.departamentoAnterior ?? "—"} → <b>{m.departamentoNuevo}</b></div>}
                    {m.puestoNuevo && <div>Puesto: {m.puestoAnterior ?? "—"} → <b>{m.puestoNuevo}</b></div>}
                    {m.sueldoNuevo != null && <div>Sueldo: {money(m.sueldoAnterior ?? 0)} → <b>{money(m.sueldoNuevo)}</b></div>}
                  </td>
                  <td className="td text-slate-600">{m.motivo ?? "—"}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><span className="font-semibold text-slate-500">{k}:</span><span className="text-slate-800">{v}</span></div>;
}
function Tarjeta({ titulo, valor, sub, destacado }: { titulo: string; valor: string; sub?: string; destacado?: boolean }) {
  return (
    <div className={`card p-5 ${destacado ? "border-brand-200 bg-brand-50" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className={`mt-1 text-2xl font-bold ${destacado ? "text-brand-800" : "text-slate-900"}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
function TabBtn({ a, on, children }: { a: boolean; on: () => void; children: React.ReactNode }) {
  return (
    <button onClick={on} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${a ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}
function Tabla({ cols, vacio, children }: { cols: string[]; vacio: boolean; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead className="border-b border-slate-200 bg-slate-50">
        <tr>{cols.map((c, i) => <th key={i} className={`th ${c === "Ingresos" || c === "Egresos" || c === "Líquido" || c === "Monto" || c === "Saldo" || c === "Días" ? "text-right" : ""}`}>{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {vacio ? <tr><td colSpan={cols.length} className="td py-8 text-center text-slate-400">Sin registros.</td></tr> : children}
      </tbody>
    </table>
  );
}
