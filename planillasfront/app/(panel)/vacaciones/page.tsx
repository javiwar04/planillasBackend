"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Empleado, Vacacion } from "@/lib/types";

const hoyISO = new Date().toISOString().slice(0, 10);
const DIA = 86400000;

export default function VacacionesPage() {
  const toast = useToast();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState(0);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ fechaInicio: hoyISO, fechaFin: hoyISO, dias: "", observacion: "" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { api<Empleado[]>("/empleados?soloActivos=false").then(setEmpleados).catch(() => {}); }, []);

  async function cargarVac(id: number) {
    setEmpleadoId(id);
    setVacaciones([]);
    if (!id) return;
    try {
      setVacaciones(await api<Vacacion[]>(`/vacaciones?empleadoId=${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudieron cargar las vacaciones.");
    }
  }

  const emp = empleados.find((e) => e.empleadoId === empleadoId);

  const resumen = useMemo(() => {
    if (!emp?.fechaIngreso) return null;
    const ing = new Date(emp.fechaIngreso);
    const anios = Math.max(0, (Date.now() - ing.getTime()) / DIA / 365);
    const acumulados = 15 * anios; // 15 días por año de servicio
    const gozados = vacaciones.reduce((s, v) => s + v.dias, 0);
    return {
      anios, acumulados: Math.round(acumulados * 100) / 100,
      gozados, disponibles: Math.round((acumulados - gozados) * 100) / 100,
    };
  }, [emp, vacaciones]);

  async function agregar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!empleadoId) return;
    setGuardando(true);
    try {
      await api("/vacaciones", {
        method: "POST",
        body: {
          empleadoId, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin,
          dias: Number(form.dias), observacion: form.observacion.trim() || null,
        },
      });
      toast.success("Vacaciones registradas.");
      setForm({ fechaInicio: hoyISO, fechaFin: hoyISO, dias: "", observacion: "" });
      await cargarVac(empleadoId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(v: Vacacion) {
    if (!confirm("¿Eliminar este registro de vacaciones?")) return;
    try {
      await api(`/vacaciones/${v.vacacionId}`, { method: "DELETE" });
      toast.success("Registro eliminado.");
      await cargarVac(empleadoId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vacaciones</h1>
        <p className="text-sm text-slate-500">Control de días por colaborador (15 días por año de servicio).</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card p-5">
        <label className="block max-w-md">
          <span className="label">Colaborador</span>
          <select className="input" value={empleadoId} onChange={(e) => cargarVac(Number(e.target.value))}>
            <option value={0}>Seleccione…</option>
            {empleados.map((e) => (
              <option key={e.empleadoId} value={e.empleadoId}>
                {e.apellidos}, {e.nombres}{!e.activo ? " (baja)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {empleadoId > 0 && (
        <>
          {resumen ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Tarjeta titulo="Acumulados" valor={`${resumen.acumulados} días`} sub={`${resumen.anios.toFixed(1)} años de servicio`} />
              <Tarjeta titulo="Gozados" valor={`${resumen.gozados} días`} />
              <Tarjeta titulo="Disponibles" valor={`${resumen.disponibles} días`} destacado />
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Este colaborador no tiene fecha de ingreso registrada; no se puede calcular el acumulado.
            </p>
          )}

          <form onSubmit={agregar} className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Registrar vacaciones gozadas</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block"><span className="label">Desde</span>
                <input type="date" className="input" required value={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} /></label>
              <label className="block"><span className="label">Hasta</span>
                <input type="date" className="input" required value={form.fechaFin}
                  onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} /></label>
              <label className="block"><span className="label">Días</span>
                <input type="number" step="0.5" min="0" className="input" required value={form.dias}
                  onChange={(e) => setForm({ ...form, dias: e.target.value })} /></label>
              <label className="block"><span className="label">Observación</span>
                <input className="input" value={form.observacion}
                  onChange={(e) => setForm({ ...form, observacion: e.target.value })} /></label>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </form>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">Historial</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Desde</th><th className="th">Hasta</th>
                    <th className="th text-right">Días</th><th className="th">Observación</th><th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vacaciones.length === 0 ? (
                    <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Sin registros.</td></tr>
                  ) : vacaciones.map((v) => (
                    <tr key={v.vacacionId} className="hover:bg-slate-50">
                      <td className="td">{v.fechaInicio}</td>
                      <td className="td">{v.fechaFin}</td>
                      <td className="td text-right font-semibold">{v.dias}</td>
                      <td className="td text-slate-600">{v.observacion ?? "—"}</td>
                      <td className="td text-right">
                        <button onClick={() => borrar(v)} className="font-medium text-red-600 hover:underline">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
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
