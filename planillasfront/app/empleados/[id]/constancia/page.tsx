"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { numeroEnLetras } from "@/lib/numeroEnLetras";
import { Logo } from "@/components/Logo";
import type { Empleado, Puesto } from "@/lib/types";

const EMPRESA = "Corporación Petenera de Turismo, S.A.";

export default function ConstanciaLaboralPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [puesto, setPuesto] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const e = await api<Empleado>(`/empleados/${id}`);
      setEmpleado(e);
      if (e.puestoId) {
        const ps = await api<Puesto[]>("/puestos");
        setPuesto(ps.find((p) => p.puestoId === e.puestoId)?.nombre ?? "");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la constancia.");
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="p-10 text-center text-red-700">{error}</div>;
  if (!empleado) return <div className="p-10 text-center text-slate-400">Cargando…</div>;

  const hoy = new Date().toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });
  const ingreso = empleado.fechaIngreso
    ? new Date(empleado.fechaIngreso).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <button onClick={() => window.history.back()} className="btn-ghost btn-sm">← Volver</button>
        <button onClick={() => window.print()} className="btn-primary btn-sm">Imprimir / PDF</button>
      </div>

      <div className="mx-auto max-w-3xl bg-white p-12 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-4">
          <Logo className="h-14 w-14 text-brand-700" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">{EMPRESA}</h1>
            <p className="text-sm text-slate-600">{empleado.establecimientoNombre}</p>
          </div>
        </div>

        <h2 className="mt-8 text-center text-lg font-bold uppercase tracking-wide text-slate-900">
          Constancia Laboral
        </h2>

        <p className="mt-8 text-justify leading-relaxed text-slate-800">
          Por este medio se hace constar que <b>{empleado.nombres} {empleado.apellidos}</b>
          {empleado.dpi ? <>, con DPI <b>{empleado.dpi}</b>,</> : empleado.nit ? <>, con NIT <b>{empleado.nit}</b>,</> : " "}
          labora para <b>{EMPRESA}</b>
          {ingreso ? <> desde el <b>{ingreso}</b></> : null}
          {puesto ? <>, desempeñando el cargo de <b>{puesto}</b></> : null}
          {empleado.establecimientoNombre ? <> en <b>{empleado.establecimientoNombre}</b></> : null}
          {empleado.tipo === "PLANILLA" ? (
            <>, devengando un salario mensual de <b>{money(empleado.sueldoBase)}</b> ({numeroEnLetras(empleado.sueldoBase)}).</>
          ) : <>.</>}
        </p>

        <p className="mt-6 text-justify leading-relaxed text-slate-800">
          Y para los usos que al interesado(a) convengan, se extiende la presente constancia en la
          ciudad de Petén, el {hoy}.
        </p>

        <div className="mt-20 flex justify-center">
          <div className="w-72 text-center">
            <div className="mb-1 border-t border-slate-400 pt-1" />
            <span className="text-sm text-slate-600">Representante / Recursos Humanos</span>
            <div className="text-xs text-slate-400">{EMPRESA}</div>
          </div>
        </div>

        <p className="mt-10 text-center text-[11px] text-slate-400">
          Documento generado por el sistema de nómina CORPETUR · {new Date().toLocaleDateString("es-GT")}
        </p>
      </div>
    </div>
  );
}
