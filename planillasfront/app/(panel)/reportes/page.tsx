"use client";

import { IconChart } from "@/components/icons";

export default function ReportesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500">Histórico por persona, consolidado y pasivo laboral.</p>
      </div>
      <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <IconChart className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-700">Próximamente</h2>
        <p className="max-w-sm text-sm text-slate-500">
          Aquí irán la boleta imprimible, el histórico por empleado y establecimiento,
          el consolidado y el cuadro de pasivo laboral.
        </p>
      </div>
    </div>
  );
}
