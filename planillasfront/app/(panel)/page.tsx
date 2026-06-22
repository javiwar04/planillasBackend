"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function InicioPage() {
  const { usuario } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hola, {usuario?.nombre} 👋</h1>
        <p className="text-slate-500">Panel de nómina de Corporación Petenera de Turismo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/empleados"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400"
        >
          <h2 className="font-semibold text-slate-900">Empleados</h2>
          <p className="text-sm text-slate-500">Alta, edición y baja del personal de planilla y extras.</p>
        </Link>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-5">
          <h2 className="font-semibold text-slate-400">Períodos y boletas</h2>
          <p className="text-sm text-slate-400">Próximamente.</p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-5">
          <h2 className="font-semibold text-slate-400">Reportes</h2>
          <p className="text-sm text-slate-400">Próximamente.</p>
        </div>
      </div>
    </div>
  );
}
