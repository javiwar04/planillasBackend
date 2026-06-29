"use client";

import { Catalogo } from "@/components/Catalogo";
import type { Establecimiento } from "@/lib/types";

export default function EstablecimientosPage() {
  return (
    <Catalogo<Establecimiento & Record<string, unknown>>
      titulo="Establecimientos"
      descripcion="Hoteles, agencias y áreas administrativas."
      endpoint="/establecimientos"
      query="?soloActivos=false"
      idKey="establecimientoId"
      textoNuevo="Nuevo establecimiento"
      deleteLabel="Desactivar"
      vacio={{ codigo: "", nombre: "", esEntidadContable: false, encargado: "" }}
      campos={[
        { name: "codigo", label: "Código", required: true },
        { name: "nombre", label: "Nombre", required: true, span: 2 },
        { name: "encargado", label: "Encargado / supervisor", span: 2, hint: "Supervisor por defecto de quienes trabajan aquí." },
        { name: "esEntidadContable", label: "Es entidad contable (consolidación)", type: "checkbox" },
      ]}
      columnas={[
        { label: "Código", render: (e) => <span className="font-mono text-xs text-slate-500">{e.codigo}</span> },
        { label: "Nombre", render: (e) => <span className="font-medium text-slate-900">{e.nombre}</span> },
        { label: "Encargado", render: (e) => <span className="text-slate-600">{e.encargado ?? "—"}</span> },
        { label: "Tipo", render: (e) => e.esEntidadContable
          ? <span className="badge bg-amber-100 text-amber-700">Contable</span>
          : <span className="badge bg-slate-100 text-slate-600">Operativo</span> },
        { label: "Estado", render: (e) => e.activo
          ? <span className="badge bg-brand-100 text-brand-800">Activo</span>
          : <span className="badge bg-slate-100 text-slate-500">Inactivo</span> },
      ]}
    />
  );
}
