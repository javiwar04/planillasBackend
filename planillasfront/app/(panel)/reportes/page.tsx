"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre } from "@/lib/format";
import type { Empleado, BoletaLista, Periodo, ProvisionLaboral } from "@/lib/types";

type Tab = "historico" | "pasivo";

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>("historico");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500">Histórico por persona y pasivo laboral (cuadro Kurt).</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        <TabBtn activo={tab === "historico"} onClick={() => setTab("historico")}>Histórico por empleado</TabBtn>
        <TabBtn activo={tab === "pasivo"} onClick={() => setTab("pasivo")}>Pasivo laboral</TabBtn>
      </div>

      {tab === "historico" ? <Historico /> : <Pasivo />}
    </div>
  );
}

function TabBtn({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
        activo ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- Histórico por empleado ---------------- */
function Historico() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [periodos, setPeriodos] = useState<Record<number, Periodo>>({});
  const [empleadoId, setEmpleadoId] = useState(0);
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Empleado[]>("/empleados?soloActivos=false"),
      api<Periodo[]>("/periodospago"),
    ])
      .then(([emps, pers]) => {
        setEmpleados(emps);
        setPeriodos(Object.fromEntries(pers.map((p) => [p.periodoPagoId, p])));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Error al cargar."));
  }, []);

  const cargarBoletas = useCallback(async (id: number) => {
    setEmpleadoId(id);
    setBoletas([]);
    if (!id) return;
    setCargando(true);
    setError(null);
    try {
      setBoletas(await api<BoletaLista[]>(`/boletas?empleadoId=${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar el histórico.");
    } finally {
      setCargando(false);
    }
  }, []);

  const filas = useMemo(() => {
    return boletas
      .map((b) => ({ b, p: periodos[b.periodoPagoId] }))
      .sort((a, z) => {
        const pa = a.p, pz = z.p;
        if (!pa || !pz) return 0;
        return pa.anio - pz.anio || pa.mes - pz.mes || pa.tipo.localeCompare(pz.tipo);
      });
  }, [boletas, periodos]);

  const totalLiquido = boletas.reduce((s, b) => s + b.liquido, 0);

  return (
    <div className="space-y-4">
      <select className="input max-w-sm" value={empleadoId} onChange={(e) => cargarBoletas(Number(e.target.value))}>
        <option value={0}>Seleccione un empleado…</option>
        {empleados.map((e) => (
          <option key={e.empleadoId} value={e.empleadoId}>
            {e.apellidos}, {e.nombres}{!e.activo ? " (baja)" : ""}
          </option>
        ))}
      </select>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {empleadoId > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Período</th>
                  <th className="th">Tipo</th>
                  <th className="th">Estado</th>
                  <th className="th text-right">Ingresos</th>
                  <th className="th text-right">Egresos</th>
                  <th className="th text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Cargando…</td></tr>
                ) : filas.length === 0 ? (
                  <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Sin boletas para este empleado.</td></tr>
                ) : (
                  filas.map(({ b, p }) => (
                    <tr key={b.boletaId} className="hover:bg-slate-50">
                      <td className="td font-medium text-slate-900">{p ? `${mesNombre(p.mes)} ${p.anio}` : "—"}</td>
                      <td className="td">{p ? (p.tipo === "QUINCENA" ? "Quincena" : "Fin de mes") : "—"}</td>
                      <td className="td"><span className="badge bg-slate-100 text-slate-600">{b.estado}</span></td>
                      <td className="td text-right">{money(b.totalIngresos)}</td>
                      <td className="td text-right">{money(b.totalEgresos)}</td>
                      <td className="td text-right font-semibold">{money(b.liquido)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {filas.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="td font-bold" colSpan={5}>Total líquido del histórico</td>
                    <td className="td text-right text-lg font-bold text-slate-900">{money(totalLiquido)}</td>
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

/* ---------------- Pasivo laboral (cuadro Kurt) ---------------- */
function Pasivo() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(0); // 0 = todos
  const [filas, setFilas] = useState<ProvisionLaboral[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const q = mes > 0 ? `?anio=${anio}&mes=${mes}` : `?anio=${anio}`;
      setFilas(await api<ProvisionLaboral[]>(`/provisioneslaborales${q}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar el pasivo laboral.");
    } finally {
      setCargando(false);
    }
  }, [anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalFila = (p: ProvisionLaboral) =>
    p.indemnizacion + p.bono14 + p.aguinaldo + p.vacaciones + p.igssPatronal + p.intecap;

  const tot = filas.reduce(
    (a, p) => ({
      indem: a.indem + p.indemnizacion, bono: a.bono + p.bono14, agui: a.agui + p.aguinaldo,
      vac: a.vac + p.vacaciones, igss: a.igss + p.igssPatronal, inte: a.inte + p.intecap,
      total: a.total + totalFila(p),
    }),
    { indem: 0, bono: 0, agui: 0, vac: 0, igss: 0, inte: 0, total: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Año</span>
          <input type="number" className="input w-28" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="label">Mes</span>
          <select className="input w-40" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            <option value={0}>Todos</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{mesNombre(m)}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Empleado</th>
                {mes === 0 && <th className="th">Mes</th>}
                <th className="th text-right">Base</th>
                <th className="th text-right">Indem.</th>
                <th className="th text-right">Bono 14</th>
                <th className="th text-right">Aguinaldo</th>
                <th className="th text-right">Vacac.</th>
                <th className="th text-right">IGSS patr.</th>
                <th className="th text-right">INTECAP</th>
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={10} className="td py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={10} className="td py-8 text-center text-slate-400">
                  Sin provisiones. Genera el “Provisiones” en un período de fin de mes.
                </td></tr>
              ) : (
                filas.map((p) => (
                  <tr key={p.provisionLaboralId} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900">{p.empleadoNombre}</td>
                    {mes === 0 && <td className="td">{mesNombre(p.mes)}</td>}
                    <td className="td text-right text-slate-500">{money(p.baseCalculo)}</td>
                    <td className="td text-right">{money(p.indemnizacion)}</td>
                    <td className="td text-right">{money(p.bono14)}</td>
                    <td className="td text-right">{money(p.aguinaldo)}</td>
                    <td className="td text-right">{money(p.vacaciones)}</td>
                    <td className="td text-right">{money(p.igssPatronal)}</td>
                    <td className="td text-right">{money(p.intecap)}</td>
                    <td className="td text-right font-semibold">{money(totalFila(p))}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="td font-bold" colSpan={mes === 0 ? 3 : 2}>Totales</td>
                  <td className="td text-right font-semibold">{money(tot.indem)}</td>
                  <td className="td text-right font-semibold">{money(tot.bono)}</td>
                  <td className="td text-right font-semibold">{money(tot.agui)}</td>
                  <td className="td text-right font-semibold">{money(tot.vac)}</td>
                  <td className="td text-right font-semibold">{money(tot.igss)}</td>
                  <td className="td text-right font-semibold">{money(tot.inte)}</td>
                  <td className="td text-right text-base font-bold text-slate-900">{money(tot.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {filas.length > 0 && (
        <p className="text-sm text-slate-500">
          Costo total del pasivo laboral {mes > 0 ? `de ${mesNombre(mes)} ` : ""}
          {anio}: <span className="font-semibold text-slate-800">{money(tot.total)}</span>
        </p>
      )}
    </div>
  );
}
