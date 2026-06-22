"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { mesNombre } from "@/lib/format";
import { IconPlus } from "@/components/icons";
import type { Periodo, PeriodoCreate, GenerarResultado, ProvisionesResultado } from "@/lib/types";

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
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<PeriodoCreate>(VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPeriodos(await api<Periodo[]>("/periodospago"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los períodos.");
    } finally {
      setCargando(false);
    }
  }, []);

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

  async function accion(p: Periodo, tipo: "generar" | "provisiones" | "cerrar") {
    setAviso(null);
    setError(null);
    if (tipo === "cerrar" && !confirm(`¿Cerrar el período ${p.tipo} ${mesNombre(p.mes)} ${p.anio}? Ya no se podrá editar.`)) return;
    setOcupado(p.periodoPagoId);
    try {
      if (tipo === "generar") {
        const r = await api<GenerarResultado>(`/periodospago/${p.periodoPagoId}/generar`, { method: "POST" });
        setAviso(`Boletas generadas: ${r.boletasCreadas} nuevas, ${r.boletasActualizadas} actualizadas (${r.empleadosPlanilla} de planilla).`);
      } else if (tipo === "provisiones") {
        const r = await api<ProvisionesResultado>(`/periodospago/${p.periodoPagoId}/provisiones`, { method: "POST" });
        setAviso(`Provisiones del ${mesNombre(r.mes)} ${r.anio}: ${r.generadas} generadas, ${r.actualizadas} actualizadas.`);
      } else {
        await api(`/periodospago/${p.periodoPagoId}/cerrar`, { method: "POST" });
        setAviso(`Período ${p.tipo} ${mesNombre(p.mes)} ${p.anio} cerrado.`);
      }
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la acción.");
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
        <button onClick={() => { setForm(VACIO); setFormError(null); setModal(true); }} className="btn-primary">
          <IconPlus className="h-4 w-4" /> Nuevo período
        </button>
      </div>

      {aviso && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
                <tr><td colSpan={5} className="td py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : periodos.length === 0 ? (
                <tr><td colSpan={5} className="td py-10 text-center text-slate-400">Sin períodos. Crea el primero.</td></tr>
              ) : (
                periodos.map((p) => {
                  const busy = ocupado === p.periodoPagoId;
                  return (
                    <tr key={p.periodoPagoId} className="hover:bg-slate-50">
                      <td className="td font-medium text-slate-900">{mesNombre(p.mes)} {p.anio}</td>
                      <td className="td">
                        <span className="badge bg-slate-100 text-slate-700">
                          {p.tipo === "QUINCENA" ? "Quincena" : "Fin de mes"}
                        </span>
                      </td>
                      <td className="td text-slate-500">{p.fechaInicio} → {p.fechaFin}</td>
                      <td className="td">
                        <span className={`badge ${estadoBadge[p.estado]}`}>{p.estado}</span>
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link href={`/periodos/${p.periodoPagoId}`} className="btn-ghost btn-sm">Ver boletas</Link>
                          {p.estado !== "CERRADO" && (
                            <>
                              <button disabled={busy} onClick={() => accion(p, "generar")} className="btn-ghost btn-sm">
                                {busy ? "…" : "Generar"}
                              </button>
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
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as "QUINCENA" | "FIN_MES" })}>
                    <option value="QUINCENA">Quincena (anticipo)</option>
                    <option value="FIN_MES">Fin de mes (liquidación)</option>
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
    </div>
  );
}
