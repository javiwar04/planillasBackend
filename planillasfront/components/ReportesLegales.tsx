"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre, tipoPeriodoLabel } from "@/lib/format";
import { exportarExcel } from "@/lib/excel";
import type { Empleado, BoletaLista, Periodo, DeclaracionAnual } from "@/lib/types";

interface Parametro { clave: string; valor: number }
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ---------------- Planilla IGSS ---------------- */
export function PlanillaIGSS() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [empMap, setEmpMap] = useState<Map<number, Empleado>>(new Map());
  const [tasaLab, setTasaLab] = useState(4.83);
  const [tasaPat, setTasaPat] = useState(10.67);
  const [periodoId, setPeriodoId] = useState(0);
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Periodo[]>("/periodospago"),
      api<Empleado[]>("/empleados?soloActivos=false"),
      api<Parametro[]>("/parametrosnomina"),
    ]).then(([per, emp, par]) => {
      setPeriodos(per);
      setEmpMap(new Map(emp.map((e) => [e.empleadoId, e])));
      const l = par.find((p) => p.clave === "IGSS_LABORAL"); if (l) setTasaLab(l.valor);
      const p2 = par.find((p) => p.clave === "IGSS_PATRONAL"); if (p2) setTasaPat(p2.valor);
    }).catch((e) => setError(e instanceof ApiError ? e.message : "Error al cargar."));
  }, []);

  async function cargar(id: number) {
    setPeriodoId(id); setBoletas([]);
    if (!id) return;
    setCargando(true); setError(null);
    try { setBoletas(await api<BoletaLista[]>(`/boletas?periodoId=${id}`)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "No se pudo cargar."); }
    finally { setCargando(false); }
  }

  const filas = boletas.map((b) => {
    const e = empMap.get(b.empleadoId);
    const base = e?.sueldoBase ?? 0;
    return { nombre: b.empleadoNombre, nit: e?.nit ?? "", base, laboral: r2(base * tasaLab / 100), patronal: r2(base * tasaPat / 100) };
  });
  const tot = filas.reduce((a, f) => ({ base: a.base + f.base, lab: a.lab + f.laboral, pat: a.pat + f.patronal }), { base: 0, lab: 0, pat: 0 });

  function exportar() {
    const per = periodos.find((p) => p.periodoPagoId === periodoId);
    const datos = filas.map((f) => ({
      Colaborador: f.nombre, NIT: f.nit, "Salario base": f.base,
      "IGSS laboral": f.laboral, "IGSS patronal": f.patronal, "Total IGSS": r2(f.laboral + f.patronal),
    }));
    exportarExcel(`planilla_igss_${per ? `${per.mes}_${per.anio}` : periodoId}`, datos, "Planilla IGSS");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Período</span>
          <select className="input min-w-64" value={periodoId} onChange={(e) => cargar(Number(e.target.value))}>
            <option value={0}>Seleccione…</option>
            {periodos.map((p) => (
              <option key={p.periodoPagoId} value={p.periodoPagoId}>
                {mesNombre(p.mes)} {p.anio} · {tipoPeriodoLabel(p.tipo)}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-slate-500">Laboral {tasaLab}% · Patronal {tasaPat}%</span>
        {filas.length > 0 && <button onClick={exportar} className="btn-ghost btn-sm">Exportar Excel</button>}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {periodoId > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Colaborador</th><th className="th">NIT</th>
                  <th className="th text-right">Salario base</th>
                  <th className="th text-right">IGSS laboral</th>
                  <th className="th text-right">IGSS patronal</th>
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Cargando…</td></tr>
                ) : filas.length === 0 ? (
                  <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Sin boletas en el período.</td></tr>
                ) : filas.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900">{f.nombre}</td>
                    <td className="td text-slate-500">{f.nit}</td>
                    <td className="td text-right">{money(f.base)}</td>
                    <td className="td text-right">{money(f.laboral)}</td>
                    <td className="td text-right">{money(f.patronal)}</td>
                    <td className="td text-right font-semibold">{money(f.laboral + f.patronal)}</td>
                  </tr>
                ))}
              </tbody>
              {filas.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="td font-bold" colSpan={2}>Totales</td>
                    <td className="td text-right font-semibold">{money(tot.base)}</td>
                    <td className="td text-right font-semibold">{money(tot.lab)}</td>
                    <td className="td text-right font-semibold">{money(tot.pat)}</td>
                    <td className="td text-right font-bold">{money(tot.lab + tot.pat)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Declaración jurada anual (SAT) ---------------- */
// Columnas EXACTAS del archivo que entrega contabilidad a la SAT (mismo orden y
// textos). Las casillas que el sistema no alimenta van en blanco; las de "rentas
// exentas" (aguinaldo / bono 14) se repiten igual que en el formato oficial.
const COLS_SAT = [
  "NIT Empleado", "Sueldos", "Horas Extras", "Bono Decreto 37-2001", "Otras Bonificaciones",
  "Comisiones", "Propinas", "Aguinaldo", "Bono Anual de trabajadores (14)", "Viáticos",
  "Gasto de representación", "Dietas", "Gratificaciones", "Remuneraciones", "Prestaciones IGSS",
  "Otros", "Indemnizaciones o pensiones por causa de muerte", "Indemnizaciones por tiempo servido",
  "Remuneraciones de los diplomáticos", "Gastos de representación y viáticos comprobables",
  "Aguinaldo", "Bono Anual de trabajadores (14)", "Donaciones a Universidades",
  "Cuotas IGSS  y Otros planes de seguridad social **", "Seguro de vida",
  "Otras Donaciones (Con limite 5% sobre Rentas Brutas)",
];

function filaSat(f: DeclaracionAnual): (string | number)[] {
  const n = (v: number) => (v ? Math.round(v * 100) / 100 : "");
  return [
    f.nit ?? "", n(f.sueldos), n(f.horasExtras), n(f.bonoDecreto), n(f.otrasBonificaciones),
    n(f.comisiones), n(f.propinas), n(f.aguinaldo), n(f.bono14), "",
    "", "", "", "", "",
    n(f.otrosIngresos), "", "",
    "", "",
    n(f.aguinaldo), n(f.bono14), "",
    n(f.igssLaboral), "", "",
  ];
}

export function DeclaracionAnualReporte() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [filas, setFilas] = useState<DeclaracionAnual[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try { setFilas(await api<DeclaracionAnual[]>(`/reportes/declaracion-anual?anio=${anio}`)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "No se pudo generar la declaración."); }
    finally { setCargando(false); }
  }, [anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const tot = filas.reduce((a, f) => ({
    sueldos: a.sueldos + f.sueldos, bonoDecreto: a.bonoDecreto + f.bonoDecreto,
    otras: a.otras + f.otrasBonificaciones, comisiones: a.comisiones + f.comisiones,
    propinas: a.propinas + f.propinas, aguinaldo: a.aguinaldo + f.aguinaldo,
    bono14: a.bono14 + f.bono14, igss: a.igss + f.igssLaboral,
  }), { sueldos: 0, bonoDecreto: 0, otras: 0, comisiones: 0, propinas: 0, aguinaldo: 0, bono14: 0, igss: 0 });

  // CSV con punto y coma + BOM (lo que espera Excel/SAT en GT), columnas exactas.
  function exportarCsv() {
    const sep = ";";
    const esc = (v: string | number) => {
      const s = String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [COLS_SAT.join(sep), ...filas.map((f) => filaSat(f).map(esc).join(sep))];
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `declaracion_anual_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarExcelSat() {
    const datos = filas.map((f) => Object.fromEntries(COLS_SAT.map((c, i) => [c, filaSat(f)[i]])));
    exportarExcel(`declaracion_anual_${anio}`, datos as Record<string, string | number>[], "Declaración");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Año</span>
          <input type="number" className="input w-28" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </label>
        {filas.length > 0 && (
          <>
            <button onClick={exportarCsv} className="btn-ghost btn-sm">Exportar CSV (SAT)</button>
            <button onClick={exportarExcelSat} className="btn-ghost btn-sm">Exportar Excel</button>
          </>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Acumulado del año por colaborador de planilla (todas las boletas), separando sueldos, horas
        extra, bonificación incentivo, otras bonificaciones, comisiones, propinas, aguinaldo, bono 14 e
        IGSS laboral. El CSV sale con las columnas y textos exactos del formato SAT.
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Colaborador</th><th className="th">NIT</th>
                <th className="th text-right">Sueldos</th>
                <th className="th text-right">Bono Dto.</th>
                <th className="th text-right">Otras bonif.</th>
                <th className="th text-right">Comisiones</th>
                <th className="th text-right">Propinas</th>
                <th className="th text-right">Aguinaldo</th>
                <th className="th text-right">Bono 14</th>
                <th className="th text-right">IGSS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={10} className="td py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={10} className="td py-8 text-center text-slate-400">Sin boletas de planilla en {anio}.</td></tr>
              ) : filas.map((f) => (
                <tr key={f.empleadoId} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900">{f.nombre}</td>
                  <td className="td text-slate-500">{f.nit ?? "—"}</td>
                  <td className="td text-right">{money(f.sueldos)}</td>
                  <td className="td text-right">{money(f.bonoDecreto)}</td>
                  <td className="td text-right">{money(f.otrasBonificaciones)}</td>
                  <td className="td text-right">{money(f.comisiones)}</td>
                  <td className="td text-right">{money(f.propinas)}</td>
                  <td className="td text-right">{money(f.aguinaldo)}</td>
                  <td className="td text-right">{money(f.bono14)}</td>
                  <td className="td text-right">{money(f.igssLaboral)}</td>
                </tr>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="td font-bold" colSpan={2}>Totales {anio}</td>
                  <td className="td text-right font-semibold">{money(tot.sueldos)}</td>
                  <td className="td text-right font-semibold">{money(tot.bonoDecreto)}</td>
                  <td className="td text-right font-semibold">{money(tot.otras)}</td>
                  <td className="td text-right font-semibold">{money(tot.comisiones)}</td>
                  <td className="td text-right font-semibold">{money(tot.propinas)}</td>
                  <td className="td text-right font-semibold">{money(tot.aguinaldo)}</td>
                  <td className="td text-right font-semibold">{money(tot.bono14)}</td>
                  <td className="td text-right font-semibold">{money(tot.igss)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Libro de salarios ---------------- */
export function LibroSalarios() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [filas, setFilas] = useState<{ nombre: string; mes: number; tipo: string; ingresos: number; egresos: number; liquido: number }[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const periodos = (await api<Periodo[]>("/periodospago")).filter((p) => p.anio === anio);
      const todas: { nombre: string; mes: number; tipo: string; ingresos: number; egresos: number; liquido: number }[] = [];
      for (const p of periodos) {
        const bs = await api<BoletaLista[]>(`/boletas?periodoId=${p.periodoPagoId}`);
        for (const b of bs) {
          todas.push({ nombre: b.empleadoNombre, mes: p.mes, tipo: p.tipo, ingresos: b.totalIngresos, egresos: b.totalEgresos, liquido: b.liquido });
        }
      }
      todas.sort((a, z) => a.nombre.localeCompare(z.nombre) || a.mes - z.mes);
      setFilas(todas);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar el libro.");
    } finally { setCargando(false); }
  }, [anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const tot = filas.reduce((a, f) => ({ ing: a.ing + f.ingresos, egr: a.egr + f.egresos, liq: a.liq + f.liquido }), { ing: 0, egr: 0, liq: 0 });

  function exportar() {
    const datos = filas.map((f) => ({
      Colaborador: f.nombre, Mes: mesNombre(f.mes), Tipo: tipoPeriodoLabel(f.tipo),
      Ingresos: f.ingresos, Egresos: f.egresos, Líquido: f.liquido,
    }));
    exportarExcel(`libro_salarios_${anio}`, datos, "Libro de salarios");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Año</span>
          <input type="number" className="input w-28" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </label>
        {filas.length > 0 && <button onClick={exportar} className="btn-ghost btn-sm">Exportar Excel</button>}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Colaborador</th><th className="th">Mes</th><th className="th">Tipo</th>
                <th className="th text-right">Ingresos</th><th className="th text-right">Egresos</th><th className="th text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Sin boletas en {anio}.</td></tr>
              ) : filas.map((f, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900">{f.nombre}</td>
                  <td className="td">{mesNombre(f.mes)}</td>
                  <td className="td text-slate-500">{tipoPeriodoLabel(f.tipo)}</td>
                  <td className="td text-right">{money(f.ingresos)}</td>
                  <td className="td text-right">{money(f.egresos)}</td>
                  <td className="td text-right font-semibold">{money(f.liquido)}</td>
                </tr>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="td font-bold" colSpan={3}>Totales {anio}</td>
                  <td className="td text-right font-semibold">{money(tot.ing)}</td>
                  <td className="td text-right font-semibold">{money(tot.egr)}</td>
                  <td className="td text-right font-bold">{money(tot.liq)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
