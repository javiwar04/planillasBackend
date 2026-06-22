"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Empleado, EmpleadoCreate, Establecimiento, Departamento } from "@/lib/types";

const VACIO: EmpleadoCreate = {
  nombres: "",
  apellidos: "",
  nit: "",
  dpi: "",
  codigo: "",
  establecimientoId: 0,
  departamentoId: null,
  tipo: "PLANILLA",
  sueldoBase: 0,
  montoQuincena: 1200,
  banco: "",
  cuentaBanco: "",
  fechaIngreso: null,
};

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EmpleadoCreate>(VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [emps, ests, deps] = await Promise.all([
        api<Empleado[]>("/empleados?soloActivos=true"),
        api<Establecimiento[]>("/establecimientos"),
        api<Departamento[]>("/departamentos"),
      ]);
      setEmpleados(emps);
      setEstablecimientos(ests);
      setDepartamentos(deps);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirNuevo() {
    setEditId(null);
    setForm({ ...VACIO, establecimientoId: establecimientos[0]?.establecimientoId ?? 0 });
    setFormError(null);
    setModal(true);
  }

  function abrirEditar(e: Empleado) {
    setEditId(e.empleadoId);
    setForm({
      nombres: e.nombres,
      apellidos: e.apellidos,
      nit: e.nit ?? "",
      dpi: e.dpi ?? "",
      codigo: e.codigo ?? "",
      establecimientoId: e.establecimientoId,
      departamentoId: e.departamentoId ?? null,
      puestoId: e.puestoId ?? null,
      tipo: e.tipo,
      sueldoBase: e.sueldoBase,
      montoQuincena: e.montoQuincena,
      banco: e.banco ?? "",
      cuentaBanco: e.cuentaBanco ?? "",
      fechaIngreso: e.fechaIngreso ?? null,
    });
    setFormError(null);
    setModal(true);
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setFormError(null);
    const payload: EmpleadoCreate = {
      ...form,
      nit: form.nit?.trim() || null,
      dpi: form.dpi?.trim() || null,
      codigo: form.codigo?.trim() || null,
      banco: form.banco?.trim() || null,
      cuentaBanco: form.cuentaBanco?.trim() || null,
      fechaIngreso: form.fechaIngreso || null,
      departamentoId: form.departamentoId || null,
    };
    try {
      if (editId) await api(`/empleados/${editId}`, { method: "PUT", body: payload });
      else await api("/empleados", { method: "POST", body: payload });
      setModal(false);
      await cargar();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function darDeBaja(e: Empleado) {
    if (!confirm(`¿Dar de baja a ${e.nombres} ${e.apellidos}? Se conserva en el histórico.`)) return;
    try {
      await api(`/empleados/${e.empleadoId}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "No se pudo dar de baja.");
    }
  }

  const money = (n: number) =>
    n.toLocaleString("es-GT", { style: "currency", currency: "GTQ" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Empleados</h1>
        <button
          onClick={abrirNuevo}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          + Nuevo empleado
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Establecimiento</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Sueldo</th>
              <th className="px-4 py-3 text-right">Quincena</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
            ) : empleados.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin empleados todavía.</td></tr>
            ) : (
              empleados.map((e) => (
                <tr key={e.empleadoId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{e.nombres} {e.apellidos}</div>
                    {e.nit && <div className="text-xs text-slate-400">NIT {e.nit}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.establecimientoNombre}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.tipo === "PLANILLA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>{e.tipo}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{money(e.sueldoBase)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {e.tipo === "PLANILLA" ? money(e.montoQuincena) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => abrirEditar(e)} className="mr-3 text-sm font-medium text-slate-600 hover:text-slate-900">Editar</button>
                    <button onClick={() => darDeBaja(e)} className="text-sm font-medium text-red-600 hover:text-red-800">Baja</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              {editId ? "Editar empleado" : "Nuevo empleado"}
            </h2>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Nombres" req>
                  <input className={inp} required value={form.nombres}
                    onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
                </Campo>
                <Campo label="Apellidos" req>
                  <input className={inp} required value={form.apellidos}
                    onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
                </Campo>
                <Campo label="NIT">
                  <input className={inp} value={form.nit ?? ""}
                    onChange={(e) => setForm({ ...form, nit: e.target.value })} />
                </Campo>
                <Campo label="DPI">
                  <input className={inp} value={form.dpi ?? ""}
                    onChange={(e) => setForm({ ...form, dpi: e.target.value })} />
                </Campo>
                <Campo label="Establecimiento" req>
                  <select className={inp} required value={form.establecimientoId}
                    onChange={(e) => setForm({ ...form, establecimientoId: Number(e.target.value) })}>
                    <option value={0} disabled>Seleccione…</option>
                    {establecimientos.map((es) => (
                      <option key={es.establecimientoId} value={es.establecimientoId}>{es.nombre}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Departamento">
                  <select className={inp} value={form.departamentoId ?? 0}
                    onChange={(e) => setForm({ ...form, departamentoId: Number(e.target.value) || null })}>
                    <option value={0}>—</option>
                    {departamentos.map((d) => (
                      <option key={d.departamentoId} value={d.departamentoId}>{d.nombre}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Tipo" req>
                  <select className={inp} value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as "PLANILLA" | "EXTRA" })}>
                    <option value="PLANILLA">PLANILLA</option>
                    <option value="EXTRA">EXTRA</option>
                  </select>
                </Campo>
                <Campo label="Fecha de ingreso">
                  <input type="date" className={inp} value={form.fechaIngreso ?? ""}
                    onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value || null })} />
                </Campo>
                <Campo label="Sueldo base" req>
                  <input type="number" step="0.01" min="0" className={inp} required value={form.sueldoBase}
                    onChange={(e) => setForm({ ...form, sueldoBase: Number(e.target.value) })} />
                </Campo>
                {form.tipo === "PLANILLA" && (
                  <Campo label="Monto quincena">
                    <input type="number" step="0.01" min="0" className={inp} value={form.montoQuincena}
                      onChange={(e) => setForm({ ...form, montoQuincena: Number(e.target.value) })} />
                  </Campo>
                )}
                <Campo label="Banco">
                  <input className={inp} value={form.banco ?? ""}
                    onChange={(e) => setForm({ ...form, banco: e.target.value })} />
                </Campo>
                <Campo label="Cuenta">
                  <input className={inp} value={form.cuentaBanco ?? ""}
                    onChange={(e) => setForm({ ...form, cuentaBanco: e.target.value })} />
                </Campo>
              </div>

              {form.tipo === "PLANILLA" && !form.nit?.trim() && (
                <p className="text-xs text-amber-600">El NIT es obligatorio para empleados de planilla.</p>
              )}
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";

function Campo({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {req && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
