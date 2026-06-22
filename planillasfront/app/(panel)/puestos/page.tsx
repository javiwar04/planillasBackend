"use client";

import { Catalogo } from "@/components/Catalogo";

interface Puesto extends Record<string, unknown> { puestoId: number; nombre: string }

export default function PuestosPage() {
  return (
    <Catalogo<Puesto>
      titulo="Puestos"
      descripcion="Cargos del personal (Recepcionista, Camarera, Cocinero…)."
      endpoint="/puestos"
      idKey="puestoId"
      textoNuevo="Nuevo puesto"
      vacio={{ nombre: "" }}
      campos={[{ name: "nombre", label: "Nombre", required: true, span: 2 }]}
      columnas={[{ label: "Nombre", render: (p) => <span className="font-medium text-slate-900">{p.nombre}</span> }]}
    />
  );
}
