"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { IconPlus } from "@/components/icons";

type Valor = string | number | boolean | null;
export type FormVals = Record<string, Valor>;

export type Campo = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "checkbox" | "date";
  required?: boolean;
  options?: { value: string | number; label: string }[];
  hint?: string;
  span?: 1 | 2;
  step?: string;
  soloNuevo?: boolean; // se muestra solo al crear (p. ej. la clave/PK)
};

export type Columna<T> = {
  label: string;
  align?: "left" | "right";
  render: (item: T) => React.ReactNode;
};

export function Catalogo<T extends Record<string, unknown>>(props: {
  titulo: string;
  descripcion?: string;
  endpoint: string;
  idKey: keyof T & string;
  query?: string;
  columnas: Columna<T>[];
  campos: Campo[];
  vacio: FormVals;
  toForm?: (item: T) => FormVals;
  deleteLabel?: string;
  textoNuevo?: string;
}) {
  const { titulo, descripcion, endpoint, idKey, query = "", columnas, campos, vacio, toForm,
    deleteLabel = "Borrar", textoNuevo = "Nuevo" } = props;

  const toast = useToast();
  const [items, setItems] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<Valor>(null);
  const [form, setForm] = useState<FormVals>(vacio);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setItems(await api<T[]>(`${endpoint}${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, [endpoint, query]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirNuevo() {
    setEditId(null);
    setForm(vacio);
    setFormError(null);
    setModal(true);
  }

  function abrirEditar(item: T) {
    setEditId(item[idKey] as Valor);
    const base: FormVals = toForm
      ? toForm(item)
      : Object.fromEntries(campos.map((c) => {
          const v = item[c.name];
          if (c.type === "checkbox") return [c.name, Boolean(v)];
          if (c.type === "number") return [c.name, v == null ? 0 : Number(v)];
          return [c.name, v == null ? "" : String(v)];
        }));
    setForm(base);
    setFormError(null);
    setModal(true);
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setGuardando(true);
    setFormError(null);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? null : v]));
      if (editId !== null) await api(`${endpoint}/${editId}`, { method: "PUT", body });
      else await api(endpoint, { method: "POST", body });
      setModal(false);
      toast.success(editId !== null ? "Cambios guardados." : "Registro creado.");
      await cargar();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(item: T) {
    if (!confirm(`¿${deleteLabel} este registro?`)) return;
    try {
      await api(`${endpoint}/${item[idKey]}`, { method: "DELETE" });
      toast.success("Registro actualizado.");
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo completar.");
    }
  }

  const camposVisibles = campos.filter((c) => !(c.soloNuevo && editId !== null));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
          {descripcion && <p className="text-sm text-slate-500">{descripcion}</p>}
        </div>
        <button onClick={abrirNuevo} className="btn-primary">
          <IconPlus className="h-4 w-4" /> {textoNuevo}
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {columnas.map((c, i) => (
                  <th key={i} className={`th ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
                ))}
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={columnas.length + 1} className="td py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={columnas.length + 1} className="td py-10 text-center text-slate-400">Sin registros.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={String(item[idKey])} className="hover:bg-slate-50">
                    {columnas.map((c, i) => (
                      <td key={i} className={`td ${c.align === "right" ? "text-right" : ""}`}>{c.render(item)}</td>
                    ))}
                    <td className="td text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(item)} className="mr-3 font-medium text-brand-700 hover:underline">Editar</button>
                      <button onClick={() => borrar(item)} className="font-medium text-red-600 hover:underline">{deleteLabel}</button>
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
            <h2 className="mb-4 text-lg font-bold text-slate-900">{editId !== null ? "Editar" : textoNuevo}</h2>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {camposVisibles.map((c) => (
                  <div key={c.name} className={c.span === 2 || c.type === "checkbox" ? "col-span-2" : ""}>
                    {c.type === "checkbox" ? (
                      <label className="flex items-center gap-2 pt-5">
                        <input type="checkbox" checked={Boolean(form[c.name])}
                          onChange={(e) => setForm({ ...form, [c.name]: e.target.checked })} />
                        <span className="text-sm font-medium text-slate-700">{c.label}</span>
                      </label>
                    ) : (
                      <label className="block">
                        <span className="label">{c.label} {c.required && <span className="text-red-500">*</span>}</span>
                        {c.type === "select" ? (
                          <select className="input" required={c.required}
                            value={String(form[c.name] ?? "")}
                            onChange={(e) => setForm({ ...form, [c.name]: e.target.value })}>
                            <option value="">Seleccione…</option>
                            {c.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input
                            type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
                            step={c.type === "number" ? (c.step ?? "any") : undefined}
                            className="input" required={c.required}
                            value={form[c.name] === null || form[c.name] === undefined ? "" : String(form[c.name])}
                            onChange={(e) => setForm({
                              ...form,
                              [c.name]: c.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value,
                            })} />
                        )}
                        {c.hint && <span className="mt-1 block text-xs text-slate-400">{c.hint}</span>}
                      </label>
                    )}
                  </div>
                ))}
              </div>

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
