"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Catalogo } from "@/components/Catalogo";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Empleado } from "@/lib/types";

interface Prestamo extends Record<string, unknown> {
  prestamoId: number;
  empleadoId: number;
  empleadoNombre?: string | null;
  tipo: string;
  montoOriginal: number;
  cuotaSugerida?: number | null;
  saldo: number;
  fechaInicio: string;
  estado: string;
}

export default function PrestamosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  useEffect(() => { api<Empleado[]>("/empleados?soloActivos=true").then(setEmpleados).catch(() => {}); }, []);

  return (
    <Catalogo<Prestamo>
      titulo="Préstamos"
      descripcion="Préstamos y anticipos con saldo (Corpetur, Bantrab…)."
      endpoint="/prestamos"
      idKey="prestamoId"
      textoNuevo="Nuevo préstamo"
      deleteLabel="Cancelar"
      vacio={{ empleadoId: "", tipo: "CORPETUR", montoOriginal: 0, cuotaSugerida: "", saldo: "", fechaInicio: "" }}
      campos={[
        { name: "empleadoId", label: "Empleado", type: "select", required: true, span: 2,
          options: empleados.map((e) => ({ value: e.empleadoId, label: `${e.apellidos}, ${e.nombres}` })) },
        { name: "tipo", label: "Tipo", type: "select", required: true,
          options: [{ value: "CORPETUR", label: "Corpetur" }, { value: "BANTRAB", label: "Bantrab" }, { value: "OTRO", label: "Otro" }] },
        { name: "fechaInicio", label: "Fecha de inicio", type: "date", required: true },
        { name: "montoOriginal", label: "Monto original", type: "number", step: "0.01", required: true },
        { name: "cuotaSugerida", label: "Cuota sugerida", type: "number", step: "0.01" },
        { name: "saldo", label: "Saldo inicial", type: "number", step: "0.01", hint: "Si se deja vacío, arranca igual al monto original." },
      ]}
      columnas={[
        { label: "Empleado", render: (p) => <span className="font-medium text-slate-900">{p.empleadoNombre}</span> },
        { label: "Tipo", render: (p) => <span className="badge bg-slate-100 text-slate-700">{p.tipo}</span> },
        { label: "Monto", align: "right", render: (p) => money(p.montoOriginal) },
        { label: "Saldo", align: "right", render: (p) => <span className="font-semibold">{money(p.saldo)}</span> },
        { label: "Estado", render: (p) => <span className={`badge ${p.estado === "ACTIVO" ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>{p.estado}</span> },
        { label: "", render: (p) => <Link href={`/prestamos/${p.prestamoId}`} className="font-medium text-brand-700 hover:underline">Movimientos</Link> },
      ]}
    />
  );
}
