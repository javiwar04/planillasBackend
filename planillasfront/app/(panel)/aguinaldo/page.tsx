"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre } from "@/lib/format";
import { exportarExcel } from "@/lib/excel";
import { useToast } from "@/lib/toast";
import { IconCash, IconPlus } from "@/components/icons";
import type { Empleado, EmitirAguinaldoResultado, Periodo, PeriodoCreate } from "@/lib/types";

type Tipo = "AGUINALDO" | "BONO14";
type ModoPeriodo = "EXISTENTE" | "NUEVO";

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

function fechaIso(anio: number, mes: number, dia: number) {
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${anio}-${mm}-${dd}`;
}

function periodoSugerido(tipo: Tipo, anio: number): PeriodoCreate {
  const mes = tipo === "AGUINALDO" ? 12 : 7;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return {
    anio,
    mes,
    tipo: "EXTRA",
    fechaInicio: fechaIso(anio, mes, 1),
    fechaFin: fechaIso(anio, mes, ultimoDia),
    fechaPago: null,
  };
}

export default function AguinaldoPage() {
  const toast = useToast();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [periodosExtra, setPeriodosExtra] = useState<Periodo[]>([]);
  const [tipo, setTipo] = useState<Tipo>("AGUINALDO");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  const [modalEmitir, setModalEmitir] = useState(false);
  const [modoPeriodo, setModoPeriodo] = useState<ModoPeriodo>("EXISTENTE");
  const [periodoId, setPeriodoId] = useState(0);
  const [periodoForm, setPeriodoForm] = useState<PeriodoCreate>(() => periodoSugerido("AGUINALDO", new Date().getFullYear()));
  const [emitError, setEmitError] = useState<string | null>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [periodoEmitidoId, setPeriodoEmitidoId] = useState<number | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [emps, pers] = await Promise.all([
          api<Empleado[]>("/empleados?tipo=PLANILLA&soloActivos=true"),
          api<Periodo[]>("/periodospago?tipo=EXTRA"),
        ]);
        setEmpleados(emps);
        const abiertos = pers.filter((p) => p.tipo === "EXTRA" && p.estado !== "CERRADO");
        setPeriodosExtra(abiertos);
        setPeriodoId(abiertos[0]?.periodoPagoId ?? 0);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "No se pudieron cargar los datos.");
      }
    }
    cargar();
  }, []);

  useEffect(() => {
    setPeriodoForm(periodoSugerido(tipo, anio));
  }, [tipo, anio]);

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

  function abrirEmitir() {
    setEmitError(null);
    setPeriodoForm(periodoSugerido(tipo, anio));
    setModoPeriodo(periodosExtra.length > 0 ? "EXISTENTE" : "NUEVO");
    setPeriodoId((actual) => actual || periodosExtra[0]?.periodoPagoId || 0);
    setModalEmitir(true);
  }

  async function recargarPeriodosExtra() {
    const pers = await api<Periodo[]>("/periodospago?tipo=EXTRA");
    const abiertos = pers.filter((p) => p.tipo === "EXTRA" && p.estado !== "CERRADO");
    setPeriodosExtra(abiertos);
    return abiertos;
  }

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    setEmitError(null);
    setEmitiendo(true);
    try {
      let destinoId = periodoId;
      if (modoPeriodo === "NUEVO") {
        const nuevo = await api<Periodo>("/periodospago", { method: "POST", body: periodoForm });
        destinoId = nuevo.periodoPagoId;
      }
      if (!destinoId) {
        setEmitError("Selecciona o crea un pago especial.");
        return;
      }

      const r = await api<EmitirAguinaldoResultado>("/aguinaldo/emitir", {
        method: "POST",
        body: { tipo, anio, periodoPagoId: destinoId },
      });
      const abiertos = await recargarPeriodosExtra();
      setPeriodoId(abiertos.find((p) => p.periodoPagoId === destinoId)?.periodoPagoId ?? abiertos[0]?.periodoPagoId ?? 0);
      setPeriodoEmitidoId(destinoId);
      setModalEmitir(false);
      toast.success(`${nombreTipo} ${anio} emitido: ${r.boletas} boletas, ${money(r.totalEmitido)}.`);
    } catch (err) {
      setEmitError(err instanceof ApiError ? err.message : "No se pudo emitir el pago.");
    } finally {
      setEmitiendo(false);
    }
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
        <span className="text-sm text-slate-500">Ciclo: {fmt(inicio)} - {fmt(fin)}</span>
        {filas.length > 0 && (
          <>
            <button onClick={abrirEmitir} className="btn-primary btn-sm">
              <IconCash className="h-4 w-4" /> Emitir pago
            </button>
            <button onClick={exportar} className="btn-ghost btn-sm">Exportar Excel</button>
          </>
        )}
        {periodoEmitidoId && (
          <Link href={`/periodos/${periodoEmitidoId}`} className="btn-ghost btn-sm">Ver período</Link>
        )}
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
        Aguinaldo y Bono 14 se emiten por el total calculado en un pago especial (EXTRA).
      </p>

      {modalEmitir && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card w-full max-w-lg p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Emitir {nombreTipo} {anio}</h2>
                <p className="text-sm text-slate-500">{filas.length} boletas · {money(total)}</p>
              </div>
              <button onClick={() => setModalEmitir(false)} className="text-slate-400 hover:text-slate-700">×</button>
            </div>

            <form onSubmit={emitir} className="space-y-4">
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button type="button"
                  onClick={() => setModoPeriodo("EXISTENTE")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${modoPeriodo === "EXISTENTE" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                  Usar existente
                </button>
                <button type="button"
                  onClick={() => setModoPeriodo("NUEVO")}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${modoPeriodo === "NUEVO" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                  <IconPlus className="h-4 w-4" /> Crear nuevo
                </button>
              </div>

              {modoPeriodo === "EXISTENTE" ? (
                <label className="block">
                  <span className="label">Pago especial *</span>
                  <select className="input" value={periodoId} onChange={(e) => setPeriodoId(Number(e.target.value))}>
                    {periodosExtra.length === 0 && <option value={0}>Sin pagos especiales abiertos</option>}
                    {periodosExtra.map((p) => (
                      <option key={p.periodoPagoId} value={p.periodoPagoId}>
                        {mesNombre(p.mes)} {p.anio} · {p.estado}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label">Año *</span>
                    <input type="number" className="input" required value={periodoForm.anio}
                      onChange={(e) => {
                        const nuevoAnio = Number(e.target.value);
                        setPeriodoForm({
                          ...periodoForm,
                          anio: nuevoAnio,
                          fechaInicio: fechaIso(nuevoAnio, periodoForm.mes, 1),
                          fechaFin: fechaIso(nuevoAnio, periodoForm.mes, new Date(nuevoAnio, periodoForm.mes, 0).getDate()),
                        });
                      }} />
                  </label>
                  <label className="block">
                    <span className="label">Mes *</span>
                    <select className="input" value={periodoForm.mes}
                      onChange={(e) => {
                        const mes = Number(e.target.value);
                        setPeriodoForm({
                          ...periodoForm,
                          mes,
                          fechaInicio: fechaIso(periodoForm.anio, mes, 1),
                          fechaFin: fechaIso(periodoForm.anio, mes, new Date(periodoForm.anio, mes, 0).getDate()),
                        });
                      }}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{mesNombre(m)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Desde *</span>
                    <input type="date" className="input" required value={periodoForm.fechaInicio}
                      onChange={(e) => setPeriodoForm({ ...periodoForm, fechaInicio: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">Hasta *</span>
                    <input type="date" className="input" required value={periodoForm.fechaFin}
                      onChange={(e) => setPeriodoForm({ ...periodoForm, fechaFin: e.target.value })} />
                  </label>
                </div>
              )}

              {emitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{emitError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModalEmitir(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={emitiendo || (modoPeriodo === "EXISTENTE" && periodoId === 0)} className="btn-primary">
                  {emitiendo ? "Emitiendo..." : "Confirmar emisión"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
