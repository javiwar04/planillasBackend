"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { IconPlus } from "@/components/icons";
import type { Empleado, EmpleadoCreate, Establecimiento, Departamento } from "@/lib/types";

const VACIO: EmpleadoCreate = {
  nombres: "", apellidos: "", nit: "", dpi: "", codigo: "",
  establecimientoId: 0, departamentoId: null, tipo: "PLANILLA",
  sueldoBase: 0, montoQuincena: 1200, banco: "", cuentaBanco: "", fechaIngreso: null,
};

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const toast = useToast();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

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

  useEffect(() => { cargar(); }, [cargar]);

  function abrirNuevo() {
    setEditId(null);
    setForm({ ...VACIO, establecimientoId: establecimientos[0]?.establecimientoId ?? 0 });
    setFormError(null);
    setModal(true);
  }

  function abrirEditar(e: Empleado) {
    setEditId(e.empleadoId);
    setForm({
      nombres: e.nombres, apellidos: e.apellidos, nit: e.nit ?? "", dpi: e.dpi ?? "",
      codigo: e.codigo ?? "", establecimientoId: e.establecimientoId,
      departamentoId: e.departamentoId ?? null, puestoId: e.puestoId ?? null,
      tipo: e.tipo, sueldoBase: e.sueldoBase, montoQuincena: e.montoQuincena,
      banco: e.banco ?? "", cuentaBanco: e.cuentaBanco ?? "", fechaIngreso: e.fechaIngreso ?? null,
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
      toast.success(editId ? "Colaborador actualizado." : "Colaborador creado.");
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
      toast.success("Colaborador dado de baja.");
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo dar de baja.");
    }
  }

  const filtrados = empleados.filter((e) =>
    `${e.nombres} ${e.apellidos} ${e.nit ?? ""}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empleados</h1>
          <p className="text-sm text-slate-500">{empleados.length} activos</p>
        </div>
        <div className="flex gap-2">
          <Link href="/empleados/importar" className="btn-ghost">Importar Excel</Link>
          <button onClick={abrirNuevo} className="btn-primary">
            <IconPlus className="h-4 w-4" /> Nuevo empleado
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <input
        className="input max-w-xs"
        placeholder="Buscar por nombre o NIT…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Nombre</th>
                <th className="th">Establecimiento</th>
                <th className="th">Tipo</th>
                <th className="th text-right">Sueldo</th>
                <th className="th text-right">Quincena</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={6} className="td py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={6} className="td py-10 text-center text-slate-400">
                  {empleados.length === 0 ? "Sin empleados todavía." : "Sin coincidencias."}
                </td></tr>
              ) : (
                filtrados.map((e) => (
                  <tr key={e.empleadoId} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="font-medium text-slate-900">{e.nombres} {e.apellidos}</div>
                      {e.nit && <div className="text-xs text-slate-400">NIT {e.nit}</div>}
                    </td>
                    <td className="td">{e.establecimientoNombre}</td>
                    <td className="td">
                      <span className={`badge ${e.tipo === "PLANILLA" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-700"}`}>
                        {e.tipo}
                      </span>
                    </td>
                    <td className="td text-right">{money(e.sueldoBase)}</td>
                    <td className="td text-right">{e.tipo === "PLANILLA" ? money(e.montoQuincena) : "—"}</td>
                    <td className="td text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(e)} className="mr-3 font-medium text-brand-700 hover:underline">Editar</button>
                      <button onClick={() => darDeBaja(e)} className="font-medium text-red-600 hover:underline">Baja</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              {editId ? "Editar empleado" : "Nuevo empleado"}
            </h2>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Nombres" req>
                  <input className="input" required value={form.nombres}
                    onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
                </Campo>
                <Campo label="Apellidos" req>
                  <input className="input" required value={form.apellidos}
                    onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
                </Campo>
                <Campo label="NIT">
                  <input className="input" value={form.nit ?? ""}
                    onChange={(e) => setForm({ ...form, nit: e.target.value })} />
                </Campo>
                <Campo label="DPI">
                  <input className="input" value={form.dpi ?? ""}
                    onChange={(e) => setForm({ ...form, dpi: e.target.value })} />
                </Campo>
                <Campo label="Establecimiento" req>
                  <select className="input" required value={form.establecimientoId}
                    onChange={(e) => setForm({ ...form, establecimientoId: Number(e.target.value) })}>
                    <option value={0} disabled>Seleccione…</option>
                    {establecimientos.map((es) => (
                      <option key={es.establecimientoId} value={es.establecimientoId}>{es.nombre}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Departamento">
                  <select className="input" value={form.departamentoId ?? 0}
                    onChange={(e) => setForm({ ...form, departamentoId: Number(e.target.value) || null })}>
                    <option value={0}>—</option>
                    {departamentos.map((d) => (
                      <option key={d.departamentoId} value={d.departamentoId}>{d.nombre}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Tipo" req>
                  <select className="input" value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as "PLANILLA" | "EXTRA" })}>
                    <option value="PLANILLA">PLANILLA</option>
                    <option value="EXTRA">EXTRA</option>
                  </select>
                </Campo>
                <Campo label="Fecha de ingreso">
                  <input type="date" className="input" value={form.fechaIngreso ?? ""}
                    onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value || null })} />
                </Campo>
                <Campo label="Sueldo base" req>
                  <input type="number" step="0.01" min="0" className="input" required value={form.sueldoBase}
                    onChange={(e) => setForm({ ...form, sueldoBase: Number(e.target.value) })} />
                </Campo>
                {form.tipo === "PLANILLA" && (
                  <Campo label="Monto quincena">
                    <input type="number" step="0.01" min="0" className="input" value={form.montoQuincena}
                      onChange={(e) => setForm({ ...form, montoQuincena: Number(e.target.value) })} />
                  </Campo>
                )}
                <Campo label="Banco">
                  <input className="input" value={form.banco ?? ""}
                    onChange={(e) => setForm({ ...form, banco: e.target.value })} />
                </Campo>
                <Campo label="Cuenta">
                  <input className="input" value={form.cuentaBanco ?? ""}
                    onChange={(e) => setForm({ ...form, cuentaBanco: e.target.value })} />
                </Campo>
              </div>

              {form.tipo === "PLANILLA" && !form.nit?.trim() && (
                <p className="text-xs text-amber-600">El NIT es obligatorio para empleados de planilla.</p>
              )}
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-primary">
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

function Campo({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label} {req && <span className="text-red-500">*</span>}</span>
      {children}
    </label>
  );
}
