"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre } from "@/lib/format";
import { exportarExcel } from "@/lib/excel";
import type { Empleado } from "@/lib/types";

type Tipo = "AGUINALDO" | "BONO14";
const DIA = 86400000;
const dias = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DIA));

// Ciclo del beneficio que se paga en el año Y:
//  Aguinaldo: 1-dic (Y-1) a 30-nov (Y), se paga en diciembre.
//  Bono 14:   1-jul (Y-1) a 30-jun (Y), se paga en julio.
function ciclo(tipo: Tipo, anio: number) {
  return tipo === "AGUINALDO"
    ? { inicio: new Date(anio - 1, 11, 1), fin: new Date(anio, 10, 30) }
    : { inicio: new Date(anio - 1, 6, 1), fin: new Date(anio, 5, 30) };
}

export default function AguinaldoPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [tipo, setTipo] = useState<Tipo>("AGUINALDO");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Empleado[]>("/empleados?tipo=PLANILLA&soloActivos=true")
      .then(setEmpleados)
      .catch((e) => setError(e instanceof ApiError ? e.message : "No se pudieron cargar los colaboradores."));
  }, []);

  const filas = useMemo(() => {
    const { inicio, fin } = ciclo(tipo, anio);
    return empleados.map((e) => {
      const ing = e.fechaIngreso ? new Date(e.fechaIngreso) : inicio;
      const baja = e.fechaBaja ? new Date(e.fechaBaja) : fin;
      const desde = ing > inicio ? ing : inicio;
      const hasta = baja < fin ? baja : fin;
      const d = Math.min(365, dias(desde, hasta));
      const monto = Math.round((e.sueldoBase * d) / 365 * 100) / 100;
      return { nombre: `${e.nombres} ${e.apellidos}`, establecimiento: e.establecimientoNombre ?? "", sueldo: e.sueldoBase, dias: d, monto };
    }).filter((f) => f.monto > 0);
  }, [empleados, tipo, anio]);

  const total = filas.reduce((s, f) => s + f.monto, 0);
  const { inicio, fin } = ciclo(tipo, anio);
  const nombreTipo = tipo === "AGUINALDO" ? "Aguinaldo" : "Bono 14";

  function exportar() {
    const datos = filas.map((f) => ({
      Colaborador: f.nombre, Establecimiento: f.establecimiento, "Sueldo base": f.sueldo,
      "Días en ciclo": f.dias, Monto: f.monto,
    }));
    exportarExcel(`${tipo.toLowerCase()}_${anio}`, datos, nombreTipo);
  }

  const fmt = (d: Date) => d.toLocaleDateString("es-GT");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Aguinaldo / Bono 14</h1>
        <p className="text-sm text-slate-500">Corrida proporcional al tiempo trabajado en el ciclo (1 sueldo por año).</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Beneficio</span>
          <select className="input w-44" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            <option value="AGUINALDO">Aguinaldo (diciembre)</option>
            <option value="BONO14">Bono 14 (julio)</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Año de pago</span>
          <input type="number" className="input w-28" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </label>
        <span className="text-sm text-slate-500">Ciclo: {fmt(inicio)} → {fmt(fin)}</span>
        {filas.length > 0 && <button onClick={exportar} className="btn-ghost btn-sm">Exportar Excel</button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colaboradores</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{filas.length}</div>
        </div>
        <div className="card border-brand-200 bg-brand-50 p-5 sm:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total a pagar ({nombreTipo} {anio})</div>
          <div className="mt-1 text-2xl font-bold text-brand-800">{money(total)}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Colaborador</th>
                <th className="th">Establecimiento</th>
                <th className="th text-right">Sueldo base</th>
                <th className="th text-right">Días en ciclo</th>
                <th className="th text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.length === 0 ? (
                <tr><td colSpan={5} className="td py-10 text-center text-slate-400">Sin colaboradores con monto en el ciclo.</td></tr>
              ) : filas.map((f, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900">{f.nombre}</td>
                  <td className="td text-slate-600">{f.establecimiento}</td>
                  <td className="td text-right">{money(f.sueldo)}</td>
                  <td className="td text-right text-slate-500">{f.dias}</td>
                  <td className="td text-right font-semibold">{money(f.monto)}</td>
                </tr>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="td font-bold" colSpan={4}>Total</td>
                  <td className="td text-right text-base font-bold text-slate-900">{money(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-xs text-amber-600">
        Cálculo estándar (1 sueldo por año, proporcional a los días trabajados en el ciclo). El aguinaldo
        suele pagarse 50% en diciembre y 50% en enero; aquí se muestra el total del beneficio. Validar con el contador.
      </p>
    </div>
  );
}
