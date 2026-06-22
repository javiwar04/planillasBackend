"use client";

import { Catalogo } from "@/components/Catalogo";

interface Parametro extends Record<string, unknown> {
  clave: string;
  valor: number;
  descripcion?: string | null;
  vigenteDesde?: string | null;
}

export default function ParametrosPage() {
  return (
    <Catalogo<Parametro>
      titulo="Parámetros de nómina"
      descripcion="Tasas configurables (IGSS, INTECAP, provisiones…) en puntos porcentuales."
      endpoint="/parametrosnomina"
      idKey="clave"
      textoNuevo="Nuevo parámetro"
      vacio={{ clave: "", valor: 0, descripcion: "", vigenteDesde: "" }}
      campos={[
        { name: "clave", label: "Clave", required: true, soloNuevo: true, hint: "Identificador (no se edita después)." },
        { name: "valor", label: "Valor", type: "number", step: "0.0001", required: true, hint: "En puntos porcentuales (ej. 4.83)." },
        { name: "descripcion", label: "Descripción", span: 2 },
        { name: "vigenteDesde", label: "Vigente desde", type: "date" },
      ]}
      columnas={[
        { label: "Clave", render: (p) => <span className="font-mono text-xs font-semibold text-slate-700">{p.clave}</span> },
        { label: "Valor", align: "right", render: (p) => <span className="font-semibold">{p.valor}</span> },
        { label: "Descripción", render: (p) => <span className="text-slate-600">{p.descripcion ?? "—"}</span> },
        { label: "Vigente desde", render: (p) => p.vigenteDesde ?? "—" },
      ]}
    />
  );
}
