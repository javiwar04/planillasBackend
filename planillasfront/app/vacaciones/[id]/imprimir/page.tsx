"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Logo } from "@/components/Logo";
import type { Vacacion, Empleado } from "@/lib/types";

const EMPRESA = "Corporación Petenera de Turismo, S.A.";

export default function VacacionImprimirPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [vac, setVac] = useState<Vacacion | null>(null);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const v = await api<Vacacion>(`/vacaciones/${id}`);
      setVac(v);
      setEmpleado(await api<Empleado>(`/empleados/${v.empleadoId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la constancia.");
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="p-10 text-center text-red-700">{error}</div>;
  if (!vac || !empleado) return <div className="p-10 text-center text-slate-400">Cargando…</div>;

  const fmt = (s: string) => new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <button onClick={() => window.history.back()} className="btn-ghost btn-sm">← Volver</button>
        <button onClick={() => window.print()} className="btn-primary btn-sm">Imprimir / PDF</button>
      </div>

      <div className="mx-auto max-w-3xl bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-4">
          <Logo className="h-12 w-12 text-brand-700" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">{EMPRESA}</h1>
            <p className="text-sm text-slate-600">{empleado.establecimientoNombre}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold uppercase tracking-wide text-slate-900">Constancia de vacaciones</div>
            <div className="text-sm text-slate-600">No. {vac.vacacionId}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 text-sm">
          <Dato k="Colaborador" v={`${empleado.nombres} ${empleado.apellidos}`} />
          <Dato k="NIT" v={empleado.nit ?? "—"} />
          <Dato k="Establecimiento" v={empleado.establecimientoNombre ?? "—"} />
          <Dato k="Departamento" v={empleado.departamentoNombre ?? "—"} />
        </div>

        <p className="py-4 text-sm leading-relaxed text-slate-700">
          Por este medio se hace constar que el(la) colaborador(a) <b>{empleado.nombres} {empleado.apellidos}</b> gozará
          de su período de vacaciones del <b>{fmt(vac.fechaInicio)}</b> al <b>{fmt(vac.fechaFin)}</b>,
          correspondiente a <b>{vac.dias} día(s)</b>.
          {vac.observacion ? <> Observaciones: {vac.observacion}.</> : null}
        </p>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-5 py-3 text-white print:bg-slate-900">
          <span className="text-sm font-semibold uppercase tracking-wide">Días de vacaciones</span>
          <span className="text-xl font-bold">{vac.dias}</span>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-12">
          <Firma t="Colaborador" />
          <Firma t="Autorizado por (RR.HH. / Jefe)" />
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
function Firma({ t }: { t: string }) {
  return <div className="text-center"><div className="mb-1 border-t border-slate-400 pt-1" /><span className="text-xs text-slate-500">{t}</span></div>;
}
