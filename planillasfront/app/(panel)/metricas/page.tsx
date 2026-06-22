"use client";

import { useEffect, useState } from "react";
import { Catalogo } from "@/components/Catalogo";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Establecimiento } from "@/lib/types";

interface Metrica extends Record<string, unknown> {
  metricaDiariaId: number;
  establecimientoId: number;
  establecimientoNombre?: string | null;
  fecha: string;
  tipoMetrica: string;
  categoria?: string | null;
  valor: number;
}

export default function MetricasPage() {
  const [estabs, setEstabs] = useState<Establecimiento[]>([]);
  useEffect(() => { api<Establecimiento[]>("/establecimientos").then(setEstabs).catch(() => {}); }, []);

  return (
    <Catalogo<Metrica>
      titulo="Métricas diarias"
      descripcion="Ventas y ocupación que sirven de referencia para comisiones."
      endpoint="/metricasdiarias"
      idKey="metricaDiariaId"
      textoNuevo="Nueva métrica"
      vacio={{ establecimientoId: "", fecha: "", tipoMetrica: "VENTA", categoria: "", valor: 0 }}
      campos={[
        { name: "establecimientoId", label: "Establecimiento", type: "select", required: true, span: 2,
          options: estabs.map((e) => ({ value: e.establecimientoId, label: e.nombre })) },
        { name: "fecha", label: "Fecha", type: "date", required: true },
        { name: "tipoMetrica", label: "Tipo", type: "select", required: true,
          options: [{ value: "VENTA", label: "Venta" }, { value: "OCUPACION", label: "Ocupación" }] },
        { name: "categoria", label: "Categoría", hint: "ej. alimentos, cervezas, general" },
        { name: "valor", label: "Valor", type: "number", step: "0.01", required: true },
      ]}
      columnas={[
        { label: "Fecha", render: (m) => m.fecha },
        { label: "Establecimiento", render: (m) => <span className="font-medium text-slate-900">{m.establecimientoNombre}</span> },
        { label: "Tipo", render: (m) => <span className="badge bg-slate-100 text-slate-700">{m.tipoMetrica}</span> },
        { label: "Categoría", render: (m) => m.categoria ?? "—" },
        { label: "Valor", align: "right", render: (m) => <span className="font-semibold">{money(m.valor)}</span> },
      ]}
    />
  );
}
