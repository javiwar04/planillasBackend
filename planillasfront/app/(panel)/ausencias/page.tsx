"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Empleado, Ausencia, TipoAusencia } from "@/lib/types";

const hoyISO = new Date().toISOString().slice(0, 10);

const TIPOS: { value: TipoAusencia; label: string; descontable: boolean }[] = [
  { value: "INCAPACIDAD", label: "Incapacidad (IGSS)", descontable: false },
  { value: "PERMISO_CON_GOCE", label: "Permiso con goce", descontable: false },
  { value: "PERMISO_SIN_GOCE", label: "Permiso sin goce", descontable: true },
  { value: "FALTA", label: "Falta", descontable: true },
  { value: "SUSPENSION", label: "Suspensión", descontable: true },
];
const tipoLabel = (t: string) => TIPOS.find((x) => x.value === t)?.label ?? t;

export default function AusenciasPage() {
  const toast = useToast();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState(0);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ fechaInicio: hoyISO, fechaFin: hoyISO, dias: "", tipo: "INCAPACIDAD" as TipoAusencia, descontable: false, observacion: "" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { api<Empleado[]>("/empleados?soloActivos=false").then(setEmpleados).catch(() => {}); }, []);

  async function cargar(id: number) {
    setEmpleadoId(id);
    setAusencias([]);
    if (!id) return;
    try {
      setAusencias(await api<Ausencia[]>(`/ausencias?empleadoId=${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudieron cargar las ausencias.");
    }
  }

  function cambiarTipo(t: TipoAusencia) {
    setForm({ ...form, tipo: t, descontable: TIPOS.find((x) => x.value === t)?.descontable ?? false });
  }

  async function agregar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!empleadoId) return;
    setGuardando(true);
    try {
      await api("/ausencias", {
        method: "POST",
        body: {
          empleadoId, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin,
          dias: Number(form.dias), tipo: form.tipo, descontable: form.descontable,
          observacion: form.observacion.trim() || null,
        },
      });
      toast.success("Ausencia registrada.");
      setForm({ fechaInicio: hoyISO, fechaFin: hoyISO, dias: "", tipo: "INCAPACIDAD", descontable: false, observacion: "" });
      await cargar(empleadoId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(a: Ausencia) {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await api(`/ausencias/${a.ausenciaId}`, { method: "DELETE" });
      toast.success("Registro eliminado.");
      await cargar(empleadoId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ausencias e incapacidades</h1>
        <p className="text-sm text-slate-500">Registro por colaborador. Los descuentos al pago se aplican como línea en la boleta.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card p-5">
        <label className="block max-w-md">
          <span className="label">Colaborador</span>
          <select className="input" value={empleadoId} onChange={(e) => cargar(Number(e.target.value))}>
            <option value={0}>Seleccione…</option>
            {empleados.map((e) => (
              <option key={e.empleadoId} value={e.empleadoId}>{e.apellidos}, {e.nombres}{!e.activo ? " (baja)" : ""}</option>
            ))}
          </select>
        </label>
      </div>

      {empleadoId > 0 && (
        <>
          <form onSubmit={agregar} className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Registrar ausencia</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="block"><span className="label">Tipo</span>
                <select className="input" value={form.tipo} onChange={(e) => cambiarTipo(e.target.value as TipoAusencia)}>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="block"><span className="label">Desde</span>
                <input type="date" className="input" required value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} /></label>
              <label className="block"><span className="label">Hasta</span>
                <input type="date" className="input" required value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} /></label>
              <label className="block"><span className="label">Días</span>
                <input type="number" step="0.5" min="0" className="input" required value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} /></label>
              <label className="block sm:col-span-2"><span className="label">Observación</span>
                <input className="input" value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} /></label>
            </div>
            <label className="mt-3 flex items-center gap-2">
              <input type="checkbox" checked={form.descontable} onChange={(e) => setForm({ ...form, descontable: e.target.checked })} />
              <span className="text-sm text-slate-700">Descontable del pago</span>
            </label>
            <div className="mt-3 flex justify-end">
              <button type="submit" disabled={guardando} className="btn-primary">{guardando ? "Guardando…" : "Registrar"}</button>
            </div>
          </form>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">Historial</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Tipo</th><th className="th">Desde</th><th className="th">Hasta</th>
                    <th className="th text-right">Días</th><th className="th">Descontable</th><th className="th">Observación</th><th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ausencias.length === 0 ? (
                    <tr><td colSpan={7} className="td py-8 text-center text-slate-400">Sin registros.</td></tr>
                  ) : ausencias.map((a) => (
                    <tr key={a.ausenciaId} className="hover:bg-slate-50">
                      <td className="td"><span className="badge bg-slate-100 text-slate-700">{tipoLabel(a.tipo)}</span></td>
                      <td className="td">{a.fechaInicio}</td>
                      <td className="td">{a.fechaFin}</td>
                      <td className="td text-right font-semibold">{a.dias}</td>
                      <td className="td">{a.descontable
                        ? <span className="badge bg-red-100 text-red-700">Sí</span>
                        : <span className="badge bg-brand-100 text-brand-800">No</span>}</td>
                      <td className="td text-slate-600">{a.observacion ?? "—"}</td>
                      <td className="td text-right">
                        <button onClick={() => borrar(a)} className="font-medium text-red-600 hover:underline">Eliminar</button>
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
