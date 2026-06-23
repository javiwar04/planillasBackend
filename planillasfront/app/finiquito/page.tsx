"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import { Logo } from "@/components/Logo";

const EMPRESA = "Corporación Petenera de Turismo, S.A.";

interface Finiquito {
  empleado: string; nit: string; establecimiento: string;
  ingreso: string; baja: string; salarioBase: number; salarioProm: number;
  diasServicio: number; aniosServicio: number;
  indemnizacion: number; aguinaldo: number; bono14: number;
  diasVacFinal: number; vacaciones: number; otros: number; descuentos: number; total: number;
}

export default function FiniquitoPage() {
  const [d, setD] = useState<Finiquito | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("finiquito");
    if (raw) setD(JSON.parse(raw));
  }, []);

  if (!d) return <div className="p-10 text-center text-slate-400">No hay datos de finiquito. Genéralo desde Liquidación.</div>;

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <button onClick={() => window.close()} className="btn-ghost btn-sm">Cerrar</button>
        <button onClick={() => window.print()} className="btn-primary btn-sm">Imprimir / PDF</button>
      </div>

      <div className="mx-auto max-w-3xl bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-4">
          <Logo className="h-12 w-12" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">{EMPRESA}</h1>
            <p className="text-sm text-slate-600">{d.establecimiento}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold uppercase tracking-wide text-slate-900">Finiquito laboral</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 text-sm">
          <Dato k="Colaborador" v={d.empleado} />
          <Dato k="NIT" v={d.nit || "—"} />
          <Dato k="Fecha de ingreso" v={d.ingreso} />
          <Dato k="Fecha de baja" v={d.baja} />
          <Dato k="Tiempo de servicio" v={`${d.aniosServicio.toFixed(2)} años (${d.diasServicio} días)`} />
          <Dato k="Salario base" v={money(d.salarioBase)} />
        </div>

        <table className="w-full text-sm">
          <tbody>
            <Fila k="Indemnización" v={d.indemnizacion} />
            <Fila k="Aguinaldo proporcional" v={d.aguinaldo} />
            <Fila k="Bono 14 proporcional" v={d.bono14} />
            <Fila k={`Vacaciones (${d.diasVacFinal} días)`} v={d.vacaciones} />
            {d.otros > 0 && <Fila k="Otros pendientes" v={d.otros} />}
            {d.descuentos > 0 && <Fila k="(−) Descuentos" v={-d.descuentos} />}
          </tbody>
        </table>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-5 py-3 text-white">
          <span className="text-sm font-semibold uppercase tracking-wide">Total a pagar</span>
          <span className="text-xl font-bold">{money(d.total)}</span>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-12">
          <Firma t="Entregado por" />
          <Firma t="Recibí conforme (colaborador)" />
        </div>
        <p className="mt-8 text-center text-[11px] text-slate-400">
          Documento generado por el sistema de nómina CORPETUR · {new Date().toLocaleDateString("es-GT")}
        </p>
      </div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><span className="font-semibold text-slate-500">{k}:</span><span className="text-slate-800">{v}</span></div>;
}
function Fila({ k, v }: { k: string; v: number }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 text-slate-700">{k}</td>
      <td className="py-2 text-right font-medium tabular-nums text-slate-800">{money(v)}</td>
    </tr>
  );
}
function Firma({ t }: { t: string }) {
  return <div className="text-center"><div className="mb-1 border-t border-slate-400 pt-1" /><span className="text-xs text-slate-500">{t}</span></div>;
}
