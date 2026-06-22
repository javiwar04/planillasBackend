"use client";

import { useEffect, useState } from "react";
import { Catalogo } from "@/components/Catalogo";
import { api } from "@/lib/api";
import type { Establecimiento, Departamento, Concepto } from "@/lib/types";

interface Regla extends Record<string, unknown> {
  reglaBonificacionId: number;
  nombre: string;
  establecimientoId?: number | null;
  departamentoId?: number | null;
  empleadoId?: number | null;
  baseMetrica: string;
  tipoCalculo: string;
  parametro: number;
  conceptoId: number;
  activo: boolean;
}

export default function ReglasPage() {
  const [estabs, setEstabs] = useState<Establecimiento[]>([]);
  const [deps, setDeps] = useState<Departamento[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  useEffect(() => {
    api<Establecimiento[]>("/establecimientos").then(setEstabs).catch(() => {});
    api<Departamento[]>("/departamentos").then(setDeps).catch(() => {});
    api<Concepto[]>("/conceptos?naturaleza=INGRESO").then(setConceptos).catch(() => {});
  }, []);

  const nombreConcepto = (id: number) => conceptos.find((c) => c.conceptoId === id)?.nombre ?? `#${id}`;

  return (
    <Catalogo<Regla>
      titulo="Reglas de bonificación"
      descripcion="Definición opcional de comisiones automáticas por venta u ocupación."
      endpoint="/reglasbonificacion"
      query="?soloActivas=false"
      idKey="reglaBonificacionId"
      textoNuevo="Nueva regla"
      deleteLabel="Desactivar"
      vacio={{ nombre: "", establecimientoId: "", departamentoId: "", empleadoId: "", baseMetrica: "VENTA", tipoCalculo: "PORCENTAJE", parametro: 0, conceptoId: "" }}
      campos={[
        { name: "nombre", label: "Nombre", required: true, span: 2 },
        { name: "establecimientoId", label: "Establecimiento (opcional)", type: "select",
          options: estabs.map((e) => ({ value: e.establecimientoId, label: e.nombre })) },
        { name: "departamentoId", label: "Departamento (opcional)", type: "select",
          options: deps.map((d) => ({ value: d.departamentoId, label: d.nombre })) },
        { name: "baseMetrica", label: "Base", type: "select", required: true,
          options: [{ value: "VENTA", label: "Venta" }, { value: "OCUPACION", label: "Ocupación" }] },
        { name: "tipoCalculo", label: "Cálculo", type: "select", required: true,
          options: [{ value: "PORCENTAJE", label: "Porcentaje" }, { value: "MONTO_POR_UNIDAD", label: "Monto por unidad" }, { value: "ESCALA", label: "Escala" }] },
        { name: "parametro", label: "Parámetro (% o monto)", type: "number", step: "0.0001", required: true },
        { name: "conceptoId", label: "Concepto destino", type: "select", required: true,
          options: conceptos.map((c) => ({ value: c.conceptoId, label: c.nombre })) },
      ]}
      columnas={[
        { label: "Nombre", render: (r) => <span className="font-medium text-slate-900">{r.nombre}</span> },
        { label: "Base", render: (r) => <span className="badge bg-slate-100 text-slate-700">{r.baseMetrica}</span> },
        { label: "Cálculo", render: (r) => r.tipoCalculo },
        { label: "Parámetro", align: "right", render: (r) => r.parametro },
        { label: "Concepto", render: (r) => nombreConcepto(r.conceptoId) },
        { label: "Estado", render: (r) => r.activo
          ? <span className="badge bg-brand-100 text-brand-800">Activa</span>
          : <span className="badge bg-slate-100 text-slate-500">Inactiva</span> },
      ]}
    />
  );
}
