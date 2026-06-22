"use client";

import { Catalogo } from "@/components/Catalogo";
import type { Concepto } from "@/lib/types";

export default function ConceptosPage() {
  return (
    <Catalogo<Concepto & Record<string, unknown>>
      titulo="Conceptos"
      descripcion="Catálogo de ingresos y egresos de las boletas."
      endpoint="/conceptos"
      idKey="conceptoId"
      textoNuevo="Nuevo concepto"
      deleteLabel="Desactivar"
      vacio={{ codigo: "", nombre: "", naturaleza: "", esCalculado: false, orden: 0 }}
      campos={[
        { name: "codigo", label: "Código", required: true },
        { name: "nombre", label: "Nombre", required: true },
        { name: "naturaleza", label: "Naturaleza", type: "select", required: true,
          options: [{ value: "INGRESO", label: "Ingreso" }, { value: "EGRESO", label: "Egreso" }] },
        { name: "orden", label: "Orden", type: "number" },
        { name: "esCalculado", label: "Es calculado automáticamente", type: "checkbox" },
      ]}
      columnas={[
        { label: "Código", render: (c) => <span className="font-mono text-xs text-slate-500">{c.codigo}</span> },
        { label: "Nombre", render: (c) => <span className="font-medium text-slate-900">{c.nombre}</span> },
        { label: "Naturaleza", render: (c) => c.naturaleza === "INGRESO"
          ? <span className="badge bg-brand-100 text-brand-800">Ingreso</span>
          : <span className="badge bg-red-100 text-red-700">Egreso</span> },
        { label: "Cálculo", render: (c) => c.esCalculado
          ? <span className="badge bg-slate-100 text-slate-600">Auto</span>
          : <span className="badge bg-slate-100 text-slate-500">Manual</span> },
        { label: "Orden", align: "right", render: (c) => c.orden },
      ]}
    />
  );
}
