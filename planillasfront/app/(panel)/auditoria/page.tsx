"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SkeletonRows } from "@/components/Skeleton";
import { usePaginado, Paginacion } from "@/components/Paginacion";
import type { Auditoria } from "@/lib/types";

const accionBadge: Record<string, string> = {
  CREAR: "bg-brand-100 text-brand-800",
  MODIFICAR: "bg-amber-100 text-amber-700",
  ELIMINAR: "bg-red-100 text-red-700",
};

export default function AuditoriaPage() {
  const { usuario } = useAuth();
  const [filas, setFilas] = useState<Auditoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entidad, setEntidad] = useState("");
  const [accion, setAccion] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (entidad) qs.set("entidad", entidad);
      if (accion) qs.set("accion", accion);
      setFilas(await api<Auditoria[]>(`/auditoria?${qs.toString()}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar la auditoría.");
    } finally {
      setCargando(false);
    }
  }, [entidad, accion]);

  useEffect(() => { cargar(); }, [cargar]);

  const pag = usePaginado(filas);

  if (usuario && usuario.rol !== "ADMIN") {
    return <div className="card p-10 text-center text-slate-500">Esta sección es solo para administradores.</div>;
  }

  const fmt = (s: string) => new Date(s).toLocaleString("es-GT");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Auditoría</h1>
        <p className="text-sm text-slate-500">Quién creó, modificó o eliminó registros.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Entidad (ej. Empleado, Boleta…)"
          value={entidad} onChange={(e) => setEntidad(e.target.value)} />
        <select className="input max-w-[12rem]" value={accion} onChange={(e) => setAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          <option value="CREAR">Crear</option>
          <option value="MODIFICAR">Modificar</option>
          <option value="ELIMINAR">Eliminar</option>
        </select>
        <span className="text-sm text-slate-500">{filas.length} registros</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Usuario</th>
                <th className="th">Acción</th>
                <th className="th">Entidad</th>
                <th className="th">ID</th>
                <th className="th">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <SkeletonRows cols={6} />
              ) : filas.length === 0 ? (
                <tr><td colSpan={6} className="td py-10 text-center text-slate-400">Sin registros.</td></tr>
              ) : pag.visibles.map((a) => (
                <tr key={a.auditoriaId} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap text-slate-500">{fmt(a.fecha)}</td>
                  <td className="td">{a.usuario ?? "—"}</td>
                  <td className="td"><span className={`badge ${accionBadge[a.accion]}`}>{a.accion}</span></td>
                  <td className="td font-medium text-slate-800">{a.entidad}</td>
                  <td className="td text-slate-500">{a.entidadId ?? "—"}</td>
                  <td className="td text-slate-500">{a.detalle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion {...pag} />
      </div>
    </div>
  );
}
