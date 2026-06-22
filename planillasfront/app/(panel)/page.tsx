"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { IconUsers, IconCalendar, IconChart } from "@/components/icons";

const ACCESOS = [
  { href: "/empleados", titulo: "Empleados", desc: "Alta, edición y baja del personal de planilla y extras.", icon: IconUsers, activo: true },
  { href: "/periodos", titulo: "Períodos y boletas", desc: "Genera quincenas, fin de mes, reparto de comisión y cierre.", icon: IconCalendar, activo: true },
  { href: "/reportes", titulo: "Reportes", desc: "Histórico por persona, consolidado y pasivo laboral.", icon: IconChart, activo: false },
];

export default function InicioPage() {
  const { usuario } = useAuth();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hola, {usuario?.nombre} 👋</h1>
        <p className="mt-1 text-slate-500">Panel de nómina · Corporación Petenera de Turismo</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCESOS.map(({ href, titulo, desc, icon: Icon, activo }) =>
          activo ? (
            <Link key={href} href={href} className="card group p-5 transition hover:border-brand-400 hover:shadow-md">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="font-semibold text-slate-900">{titulo}</h2>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </Link>
          ) : (
            <div key={href} className="card border-dashed p-5 opacity-60">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="font-semibold text-slate-500">{titulo}</h2>
              <p className="mt-1 text-sm text-slate-400">{desc}</p>
              <span className="mt-2 inline-block text-xs font-medium text-slate-400">Próximamente</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
