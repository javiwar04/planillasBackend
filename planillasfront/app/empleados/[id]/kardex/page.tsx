"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError, apiBlobUrl } from "@/lib/api";
import { money } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { kardexSecciones, fechaGt, etiquetaContrato } from "@/lib/kardex";
import type { Empleado, Puesto, Documento } from "@/lib/types";

const EMPRESA = "Corporación Petenera de Turismo, S.A.";

export default function KardexImprimirPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [emp, setEmp] = useState<Empleado | null>(null);
  const [puesto, setPuesto] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const [e, pues, docs] = await Promise.all([
        api<Empleado>(`/empleados/${id}`),
        api<Puesto[]>("/puestos"),
        api<Documento[]>(`/documentos?empleadoId=${id}`).catch(() => [] as Documento[]),
      ]);
      setEmp(e);
      setPuesto(pues.find((p) => p.puestoId === e.puestoId)?.nombre ?? "");
      const foto = docs.filter((d) => d.tipo === "FOTO")[0];
      if (foto) apiBlobUrl(`/documentos/${foto.empleadoDocumentoId}/contenido`).then(setFotoUrl).catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el kardex.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="p-10 text-center text-red-700">{error}</div>;
  if (cargando || !emp) return <div className="p-10 text-center text-slate-400">Cargando…</div>;

  const hoy = new Date().toLocaleDateString("es-GT");
  const secciones = kardexSecciones(emp, puesto);

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between px-4 print:hidden">
        <button onClick={() => window.history.back()} className="btn-ghost btn-sm">← Volver</button>
        <button onClick={() => window.print()} className="btn-primary btn-sm">Imprimir / PDF</button>
      </div>

      <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:max-w-none print:p-6 print:shadow-none">
        {/* Encabezado */}
        <div className="overflow-hidden rounded-xl">
          <div className="h-1.5 bg-amber-400" />
          <div className="flex items-center justify-between gap-4 bg-slate-900 px-6 py-5 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/10 p-2 ring-1 ring-white/20">
                <Logo className="h-full w-full text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight">KARDEX DE PERSONAL</h1>
                <p className="text-sm text-slate-300">Reporte individual de colaborador · Recursos Humanos</p>
                <p className="text-xs text-slate-400">{EMPRESA}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Fecha de emisión</div>
              <div className="mb-2 text-sm font-bold">{hoy}</div>
              <span className={`rounded-md px-4 py-1.5 text-sm font-bold ${emp.activo ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"}`}>
                {emp.activo ? "ACTIVO" : "BAJA"}
              </span>
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="mt-6 flex flex-wrap items-stretch gap-4">
          <div className="flex flex-1 items-center gap-4 rounded-xl border border-slate-200 p-4">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="Foto" className="h-24 w-24 flex-none rounded-lg object-cover ring-1 ring-slate-200" />
            ) : (
              <div className="flex h-24 w-24 flex-none items-center justify-center rounded-lg bg-slate-100 text-center text-xs font-semibold text-slate-400">
                FOTO<br />COLABORADOR
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900">{emp.nombres} {emp.apellidos}</h2>
              <p className="text-sm text-slate-500">{puesto || "—"}{emp.departamentoNombre ? ` · ${emp.departamentoNombre}` : ""}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Chip k="Tipo" v={emp.tipo} />
                <Chip k="Ingreso" v={fechaGt(emp.fechaIngreso) ?? "—"} />
                <Chip k="Contrato" v={etiquetaContrato(emp.tipoContrato)} />
              </div>
            </div>
          </div>
          <div className="flex w-56 flex-col gap-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Sueldo base</div>
              <div className="text-2xl font-bold text-amber-800">{money(emp.sueldoBase)}</div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Quincena</div>
              <div className="text-2xl font-bold text-sky-800">{money(emp.montoQuincena)}</div>
            </div>
          </div>
        </div>

        {/* Secciones */}
        <div className="mt-6 space-y-4">
          {secciones.map((sec) => (
            <div key={sec.titulo} className="break-inside-avoid rounded-xl border border-slate-200">
              <div className="rounded-t-xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800">{sec.titulo}</div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 p-4">
                {sec.campos.map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</div>
                    <div className="text-sm font-medium text-slate-800">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Firmas */}
        <div className="mt-12 grid grid-cols-3 gap-8">
          <Firma t="Elaborado por" />
          <Firma t="Revisado por" />
          <Firma t="Autorizado por" />
        </div>

        <p className="mt-8 text-center text-[10px] text-slate-400">
          Documento de control interno · Recursos Humanos · {EMPRESA}
        </p>
      </div>
    </div>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-slate-200 px-2 py-1">
      <span className="text-slate-400">{k}: </span><span className="font-semibold text-slate-700">{v}</span>
    </span>
  );
}
function Firma({ t }: { t: string }) {
  return (
    <div className="text-center">
      <div className="mb-1 border-t border-slate-400 pt-1" />
      <span className="text-xs font-semibold text-slate-600">{t}</span>
      <div className="text-[10px] text-slate-400">Nombre · Firma · Fecha</div>
    </div>
  );
}
