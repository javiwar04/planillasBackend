"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre } from "@/lib/format";
import { Logo } from "@/components/Logo";
import type { Boleta, Empleado, Periodo } from "@/lib/types";

const EMPRESA = "Corporación Petenera de Turismo, S.A.";

export default function BoletaImprimirPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [boleta, setBoleta] = useState<Boleta | null>(null);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const b = await api<Boleta>(`/boletas/${id}`);
      setBoleta(b);
      const [emp, per] = await Promise.all([
        api<Empleado>(`/empleados/${b.empleadoId}`),
        api<Periodo>(`/periodospago/${b.periodoPagoId}`),
      ]);
      setEmpleado(emp);
      setPeriodo(per);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la boleta.");
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="p-10 text-center text-red-700">{error}</div>;
  if (!boleta || !empleado || !periodo)
    return <div className="p-10 text-center text-slate-400">Cargando…</div>;

  const ingresos = boleta.detalles.filter((d) => d.naturaleza === "INGRESO");
  const egresos = boleta.detalles.filter((d) => d.naturaleza === "EGRESO");
  const tituloPeriodo = periodo.tipo === "QUINCENA" ? "Anticipo de quincena" : "Liquidación de fin de mes";

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <button onClick={() => window.history.back()} className="btn-ghost btn-sm">← Volver</button>
        <button onClick={() => window.print()} className="btn-primary btn-sm">Imprimir / PDF</button>
      </div>

      {/* Hoja */}
      <div className="mx-auto max-w-3xl bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Logo className="h-12 w-12 shrink-0 text-brand-700" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">{EMPRESA}</h1>
              <p className="text-sm text-slate-600">{empleado.establecimientoNombre}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold uppercase tracking-wide text-slate-900">Boleta de pago</div>
            <div className="text-sm text-slate-600">{tituloPeriodo}</div>
            <div className="text-sm text-slate-600">{mesNombre(periodo.mes)} {periodo.anio}</div>
          </div>
        </div>

        {/* Datos del empleado */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 text-sm">
          <Dato etiqueta="Empleado" valor={`${empleado.nombres} ${empleado.apellidos}`} />
          <Dato etiqueta="NIT" valor={empleado.nit ?? "—"} />
          <Dato etiqueta="Establecimiento" valor={empleado.establecimientoNombre ?? "—"} />
          <Dato etiqueta="Departamento" valor={empleado.departamentoNombre ?? "—"} />
          <Dato etiqueta="Tipo" valor={empleado.tipo} />
          <Dato etiqueta="Período" valor={`${periodo.fechaInicio} a ${periodo.fechaFin}`} />
          {empleado.banco && <Dato etiqueta="Banco" valor={`${empleado.banco}${empleado.cuentaBanco ? ` · ${empleado.cuentaBanco}` : ""}`} />}
        </div>

        {/* Detalle ingresos / egresos */}
        <div className="grid grid-cols-2 gap-6 py-2">
          <Columna titulo="Ingresos" lineas={ingresos} total={boleta.totalIngresos} color="text-slate-900" />
          <Columna titulo="Egresos / Descuentos" lineas={egresos} total={boleta.totalEgresos} color="text-slate-900" />
        </div>

        {/* Líquido */}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-5 py-3 text-white print:bg-slate-900">
          <span className="text-sm font-semibold uppercase tracking-wide">Líquido a recibir</span>
          <span className="text-xl font-bold">{money(boleta.liquido)}</span>
        </div>

        {boleta.observaciones && (
          <p className="mt-3 text-xs text-slate-500">Observaciones: {boleta.observaciones}</p>
        )}

        {/* Firmas */}
        <div className="mt-14 grid grid-cols-2 gap-12">
          <Firma etiqueta="Entregado por" />
          <Firma etiqueta="Recibí conforme (empleado)" />
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-400">
          Documento generado por el sistema de nómina CORPETUR · {new Date().toLocaleDateString("es-GT")}
        </p>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-slate-500">{etiqueta}:</span>
      <span className="text-slate-800">{valor}</span>
    </div>
  );
}

function Columna({
  titulo, lineas, total, color,
}: {
  titulo: string;
  lineas: Boleta["detalles"];
  total: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        {titulo}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {lineas.length === 0 ? (
            <tr><td className="py-1 text-slate-400">—</td></tr>
          ) : lineas.map((d) => (
            <tr key={d.boletaDetalleId}>
              <td className="py-1 pr-2 text-slate-700">
                {d.conceptoNombre}
                {d.descripcion && <span className="block text-[11px] text-slate-400">{d.descripcion}</span>}
              </td>
              <td className="py-1 text-right tabular-nums text-slate-800">{money(d.monto)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-300">
            <td className={`py-1 font-semibold ${color}`}>Total</td>
            <td className={`py-1 text-right font-semibold tabular-nums ${color}`}>{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Firma({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="text-center">
      <div className="mb-1 border-t border-slate-400 pt-1" />
      <span className="text-xs text-slate-500">{etiqueta}</span>
    </div>
  );
}
