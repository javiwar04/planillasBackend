"use client";

import { Catalogo } from "@/components/Catalogo";
import type { Departamento } from "@/lib/types";

export default function DepartamentosPage() {
  return (
    <Catalogo<Departamento & Record<string, unknown>>
      titulo="Departamentos"
      descripcion="Áreas funcionales (Administración, Recepción, Cocina…)."
      endpoint="/departamentos"
      idKey="departamentoId"
      textoNuevo="Nuevo departamento"
      vacio={{ nombre: "" }}
      campos={[{ name: "nombre", label: "Nombre", required: true, span: 2 }]}
      columnas={[{ label: "Nombre", render: (d) => <span className="font-medium text-slate-900">{d.nombre}</span> }]}
    />
  );
}
