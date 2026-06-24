"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre, tipoPeriodoLabel } from "@/lib/format";
import { numeroEnLetras } from "@/lib/numeroEnLetras";
import { Logo } from "@/components/Logo";
import type { Periodo, BoletaLista, Boleta, Empleado } from "@/lib/types";

const EMPRESA = "Corporación Petenera de Turismo, S.A.";

export default function BoletasImprimirPage() {
  const params = useParams<{ id: string }>();
  const periodoId = Number(params.id);

  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [empMap, setEmpMap] = useState<Map<number, Empleado>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const est = typeof window !== "undefined"
        ? Number(new URLSearchParams(window.location.search).get("est") || 0) : 0;
      const [per, lista, emps] = await Promise.all([
        api<Periodo>(`/periodospago/${periodoId}`),
        api<BoletaLista[]>(`/boletas?periodoId=${periodoId}`),
        api<Empleado[]>("/empleados?soloActivos=false"),
      ]);
      const map = new Map(emps.map((e) => [e.empleadoId, e]));
      setPeriodo(per);
      setEmpMap(map);
      const filtradas = est ? lista.filter((b) => map.get(b.empleadoId)?.establecimientoId === est) : lista;
      const detalles = await Promise.all(filtradas.map((b) => api<Boleta>(`/boletas/${b.boletaId}`)));
      detalles.sort((a, z) => a.empleadoNombre.localeCompare(z.empleadoNombre));
      setBoletas(detalles);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las boletas.");
    } finally {
      setCargando(false);
    }
  }, [periodoId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="p-10 text-center text-red-700">{error}</div>;
  if (cargando || !periodo) return <div className="p-10 text-center text-slate-400">Cargando…</div>;

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <button onClick={() => window.history.back()} className="btn-ghost btn-sm">← Volver</button>
        <div className="text-sm text-slate-500">{boletas.length} boletas</div>
        <button onClick={() => window.print()} className="btn-primary btn-sm" disabled={boletas.length === 0}>
          Imprimir / PDF
        </button>
      </div>

      {boletas.length === 0 ? (
        <div className="p-10 text-center text-slate-400">No hay boletas para imprimir.</div>
      ) : (
        boletas.map((b) => {
          const e = empMap.get(b.empleadoId);
          const ingresos = b.detalles.filter((d) => d.naturaleza === "INGRESO");
          const egresos = b.detalles.filter((d) => d.naturaleza === "EGRESO");
          return (
            <div key={b.boletaId} className="mx-auto mb-6 max-w-3xl break-after-page bg-white p-10 shadow-sm print:mb-0 print:max-w-none print:p-8 print:shadow-none">
              <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-3">
                <Logo className="h-10 w-10 text-brand-700" />
                <div className="flex-1">
                  <h1 className="text-base font-bold text-slate-900">{EMPRESA}</h1>
                  <p className="text-xs text-slate-600">{e?.establecimientoNombre}</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div className="font-bold uppercase text-slate-900">Boleta de pago · No. {b.boletaId}</div>
                  <div>{tipoPeriodoLabel(periodo.tipo)} · {mesNombre(periodo.mes)} {periodo.anio}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 py-3 text-sm">
                <div><span className="font-semibold text-slate-500">Colaborador:</span> {b.empleadoNombre}</div>
                <div><span className="font-semibold text-slate-500">NIT:</span> {e?.nit ?? "—"}</div>
                <div><span className="font-semibold text-slate-500">Departamento:</span> {e?.departamentoNombre ?? "—"}</div>
                <div><span className="font-semibold text-slate-500">Período:</span> {periodo.fechaInicio} a {periodo.fechaFin}</div>
              </div>

              <div className="grid grid-cols-2 gap-6 py-1">
                <ColumnaImpresa titulo="Ingresos" lineas={ingresos} total={b.totalIngresos} />
                <ColumnaImpresa titulo="Egresos" lineas={egresos} total={b.totalEgresos} />
              </div>

              <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-2 text-white print:bg-slate-900">
                <span className="text-sm font-semibold uppercase">Líquido a recibir</span>
                <span className="text-lg font-bold">{money(b.liquido)}</span>
              </div>
              <p className="mt-1 text-xs italic text-slate-500">{numeroEnLetras(b.liquido)}</p>

              <div className="mt-12 grid grid-cols-2 gap-12">
                <Firma t="Entregado por" />
                <Firma t="Recibí conforme (colaborador)" />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ColumnaImpresa({ titulo, lineas, total }: { titulo: string; lineas: Boleta["detalles"]; total: number }) {
  return (
    <div>
      <div className="mb-1 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</div>
      <table className="w-full text-sm">
        <tbody>
          {lineas.length === 0 ? (
            <tr><td className="py-1 text-slate-400">—</td></tr>
          ) : lineas.map((d) => (
            <tr key={d.boletaDetalleId}>
              <td className="py-0.5 pr-2 text-slate-700">{d.conceptoNombre}</td>
              <td className="py-0.5 text-right tabular-nums text-slate-800">{money(d.monto)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-300">
            <td className="py-1 font-semibold text-slate-700">Total</td>
            <td className="py-1 text-right font-semibold tabular-nums text-slate-800">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Firma({ t }: { t: string }) {
  return <div className="text-center"><div className="mb-1 border-t border-slate-400 pt-1" /><span className="text-xs text-slate-500">{t}</span></div>;
}
