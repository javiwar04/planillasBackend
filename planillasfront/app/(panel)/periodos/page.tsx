"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { mesNombre, money, tipoPeriodoLabel } from "@/lib/format";
import { IconPlus } from "@/components/icons";
import { SkeletonRows } from "@/components/Skeleton";
import type { Periodo, PeriodoCreate, GenerarResultado, ProvisionesResultado, Empleado } from "@/lib/types";

const hoy = new Date();
const VACIO: PeriodoCreate = {
  anio: hoy.getFullYear(),
  mes: hoy.getMonth() + 1,
  tipo: "QUINCENA",
  fechaInicio: "",
  fechaFin: "",
};

const estadoBadge: Record<string, string> = {
  ABIERTO: "bg-slate-100 text-slate-600",
  CALCULADO: "bg-amber-100 text-amber-700",
  CERRADO: "bg-brand-100 text-brand-800",
};

export default function PeriodosPage() {
  const toast = useToast();
  const { usuario } = useAuth();
  const puedeOperar = usuario?.rol === "ADMIN" || usuario?.rol === "CONTABILIDAD";
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<PeriodoCreate>(VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Modal de generación de quincena con overrides por persona.
  const [genPeriodo, setGenPeriodo] = useState<Periodo | null>(null);
  const [empleadosGen, setEmpleadosGen] = useState<Empleado[]>([]);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [busquedaGen, setBusquedaGen] = useState("");
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setPeriodos(await api<Periodo[]>("/periodospago"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudieron cargar los períodos.");
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setFormError(null);
    try {
      await api("/periodospago", { method: "POST", body: form });
      setModal(false);
      setForm(VACIO);
      await cargar();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear el período.");
    } finally {
      setGuardando(false);
    }
  }

  // Abre el modal de quincena: carga empleados de planilla y prepara overrides.
  async function abrirGenerarQuincena(p: Periodo) {
    setGenPeriodo(p);
    setBusquedaGen("");
    setEmpleadosGen([]);
    setOverrides({});
    try {
      const emps = await api<Empleado[]>("/empleados?tipo=PLANILLA&soloActivos=true");
      setEmpleadosGen(emps);
      setOverrides(Object.fromEntries(emps.map((e) => [e.empleadoId, String(e.montoQuincena)])));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudieron cargar los colaboradores.");
    }
  }

  async function confirmarGenerarQuincena() {
    if (!genPeriodo) return;
    setGenerando(true);
    try {
      // Solo se envían los que difieren del monto estándar de la persona.
      const overridesQuincena = empleadosGen
        .filter((e) => Number(overrides[e.empleadoId]) !== e.montoQuincena)
        .map((e) => ({ empleadoId: e.empleadoId, monto: Number(overrides[e.empleadoId] || 0) }));
      const r = await api<GenerarResultado>(`/periodospago/${genPeriodo.periodoPagoId}/generar`,
        { method: "POST", body: { overridesQuincena } });
      toast.success(`Quincena generada: ${r.boletasCreadas} nuevas, ${r.boletasActualizadas} actualizadas` +
        (overridesQuincena.length ? ` (${overridesQuincena.length} con ajuste).` : "."));
      setGenPeriodo(null);
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo generar la quincena.");
    } finally {
      setGenerando(false);
    }
  }

  async function accion(p: Periodo, tipo: "generar" | "provisiones" | "cerrar" | "reabrir") {
    if (tipo === "cerrar" && !confirm(`¿Cerrar el período ${p.tipo} ${mesNombre(p.mes)} ${p.anio}? Ya no se podrá editar.`)) return;
    if (tipo === "reabrir" && !confirm(`¿Reabrir el período ${p.tipo} ${mesNombre(p.mes)} ${p.anio}? Las boletas volverán a CALCULADA para corregir.`)) return;
    setOcupado(p.periodoPagoId);
    try {
      if (tipo === "generar") {
        const r = await api<GenerarResultado>(`/periodospago/${p.periodoPagoId}/generar`, { method: "POST" });
        toast.success(`Boletas generadas: ${r.boletasCreadas} nuevas, ${r.boletasActualizadas} actualizadas (${r.empleadosPlanilla} de planilla).`);
      } else if (tipo === "provisiones") {
        const r = await api<ProvisionesResultado>(`/periodospago/${p.periodoPagoId}/provisiones`, { method: "POST" });
        toast.success(`Provisiones del ${mesNombre(r.mes)} ${r.anio}: ${r.generadas} generadas, ${r.actualizadas} actualizadas.`);
      } else if (tipo === "reabrir") {
        await api(`/periodospago/${p.periodoPagoId}/reabrir`, { method: "POST" });
        toast.success(`Período ${p.tipo} ${mesNombre(p.mes)} ${p.anio} reabierto.`);
      } else {
        await api(`/periodospago/${p.periodoPagoId}/cerrar`, { method: "POST" });
        toast.success(`Período ${p.tipo} ${mesNombre(p.mes)} ${p.anio} cerrado.`);
      }
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Períodos y boletas</h1>
          <p className="text-sm text-slate-500">Genera quincenas y fin de mes, provisiones y cierre.</p>
        </div>
        {puedeOperar && (
          <button onClick={() => { setForm(VACIO); setFormError(null); setModal(true); }} className="btn-primary">
            <IconPlus className="h-4 w-4" /> Nuevo período
          </button>
        )}
      </div>


      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Período</th>
                <th className="th">Tipo</th>
                <th className="th">Fechas</th>
                <th className="th">Estado</th>
                <th className="th text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <SkeletonRows cols={5} />
              ) : periodos.length === 0 ? (
                <tr><td colSpan={5} className="td py-10 text-center text-slate-400">Sin períodos. Crea el primero.</td></tr>
              ) : (
                periodos.map((p) => {
                  const busy = ocupado === p.periodoPagoId;
                  return (
                    <tr key={p.periodoPagoId} className="hover:bg-slate-50">
                      <td className="td font-medium text-slate-900">{mesNombre(p.mes)} {p.anio}</td>
                      <td className="td">
                        <span className="badge bg-slate-100 text-slate-700">{tipoPeriodoLabel(p.tipo)}</span>
                      </td>
                      <td className="td text-slate-500">{p.fechaInicio} → {p.fechaFin}</td>
                      <td className="td">
                        <span className={`badge ${estadoBadge[p.estado]}`}>{p.estado}</span>
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link href={`/periodos/${p.periodoPagoId}`} className="btn-ghost btn-sm">Ver boletas</Link>
                          {puedeOperar && p.estado !== "CERRADO" && (
                            <>
                              {p.tipo !== "EXTRA" && (
                                <button disabled={busy}
                                  onClick={() => p.tipo === "QUINCENA" ? abrirGenerarQuincena(p) : accion(p, "generar")}
                                  className="btn-ghost btn-sm">
                                  {busy ? "…" : "Generar"}
                                </button>
                              )}
                              {p.tipo === "FIN_MES" && (
                                <button disabled={busy} onClick={() => accion(p, "provisiones")} className="btn-ghost btn-sm">
                                  Provisiones
                                </button>
                              )}
                              <button disabled={busy} onClick={() => accion(p, "cerrar")} className="btn-primary btn-sm">
                                Cerrar
                              </button>
                            </>
                          )}
                          {puedeOperar && p.estado === "CERRADO" && (
                            <button disabled={busy} onClick={() => accion(p, "reabrir")} className="btn-ghost btn-sm">
                              {busy ? "…" : "Reabrir"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Nuevo período</h2>
            <form onSubmit={crear} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Año *</span>
                  <input type="number" className="input" required value={form.anio}
                    onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} />
                </label>
                <label className="block">
                  <span className="label">Mes *</span>
                  <select className="input" value={form.mes}
                    onChange={(e) => setForm({ ...form, mes: Number(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{mesNombre(m)}</option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 block">
                  <span className="label">Tipo *</span>
                  <select className="input" value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as "QUINCENA" | "FIN_MES" | "EXTRA" })}>
                    <option value="QUINCENA">Quincena (anticipo)</option>
                    <option value="FIN_MES">Fin de mes (liquidación)</option>
                    <option value="EXTRA">Pago especial (propina / comisión / bono)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Desde *</span>
                  <input type="date" className="input" required value={form.fechaInicio}
                    onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">Hasta *</span>
                  <input type="date" className="input" required value={form.fechaFin}
                    onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
                </label>
              </div>

              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-primary">
                  {guardando ? "Creando…" : "Crear período"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: generar quincena con overrides */}
      {genPeriodo && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card flex max-h-[88vh] w-full max-w-xl flex-col p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Generar quincena · {mesNombre(genPeriodo.mes)} {genPeriodo.anio}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Cada colaborador recibe su anticipo estándar. Ajusta solo los que cambien este mes.
            </p>

            <input className="input mt-3" placeholder="Buscar colaborador…"
              value={busquedaGen} onChange={(e) => setBusquedaGen(e.target.value)} />

            <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-slate-200">
              {empleadosGen.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Cargando colaboradores…</p>
              ) : (
                empleadosGen
                  .filter((e) => `${e.nombres} ${e.apellidos}`.toLowerCase().includes(busquedaGen.toLowerCase()))
                  .map((e) => {
                    const distinto = Number(overrides[e.empleadoId]) !== e.montoQuincena;
                    return (
                      <div key={e.empleadoId} className="flex items-center justify-between gap-3 border-b border-slate-50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800">{e.nombres} {e.apellidos}</div>
                          <div className="text-xs text-slate-400">Estándar: {money(e.montoQuincena)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" step="0.01" min="0"
                            className={`input w-28 py-1 ${distinto ? "border-amber-400" : ""}`}
                            value={overrides[e.empleadoId] ?? ""}
                            onChange={(ev) => setOverrides({ ...overrides, [e.empleadoId]: ev.target.value })} />
                          {distinto && (
                            <button type="button" title="Restaurar estándar"
                              onClick={() => setOverrides({ ...overrides, [e.empleadoId]: String(e.montoQuincena) })}
                              className="text-xs text-slate-400 hover:text-slate-700">↺</button>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setGenPeriodo(null)} className="btn-ghost">Cancelar</button>
              <button type="button" onClick={confirmarGenerarQuincena} disabled={generando || empleadosGen.length === 0}
                className="btn-primary">
                {generando ? "Generando…" : "Generar quincena"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
