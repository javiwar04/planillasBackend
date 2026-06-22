"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { Establecimiento, Departamento, EmpleadoCreate } from "@/lib/types";

// Normaliza texto: minúsculas, sin acentos ni espacios extra.
const norm = (v: unknown) =>
  String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Sinónimos de encabezados → campo interno.
const ALIAS: Record<string, string> = {
  nombres: "nombres", nombre: "nombres",
  apellidos: "apellidos", apellido: "apellidos",
  nit: "nit", dpi: "dpi", codigo: "codigo",
  establecimiento: "establecimiento", hotel: "establecimiento", unidad: "establecimiento",
  departamento: "departamento", depto: "departamento", area: "departamento",
  puesto: "puesto", cargo: "puesto",
  tipo: "tipo",
  sueldobase: "sueldoBase", sueldo: "sueldoBase", "sueldo base": "sueldoBase", salario: "sueldoBase",
  montoquincena: "montoQuincena", "monto quincena": "montoQuincena", quincena: "montoQuincena", anticipo: "montoQuincena",
  banco: "banco",
  cuenta: "cuentaBanco", cuentabanco: "cuentaBanco", "cuenta banco": "cuentaBanco",
  fechaingreso: "fechaIngreso", "fecha ingreso": "fechaIngreso", "fecha de ingreso": "fechaIngreso", ingreso: "fechaIngreso",
};

const COLS_PLANTILLA = ["Nombres", "Apellidos", "NIT", "DPI", "Establecimiento", "Departamento", "Puesto", "Tipo", "SueldoBase", "MontoQuincena", "Banco", "Cuenta", "FechaIngreso"];

type Fila = {
  n: number;
  datos: Record<string, string>;
  payload?: EmpleadoCreate;
  error?: string;
  estado: "ok" | "error" | "creado" | "fallo";
  msg?: string;
};

export default function ImportarEmpleadosPage() {
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [puestos, setPuestos] = useState<{ puestoId: number; nombre: string }[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resumen, setResumen] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api<Establecimiento[]>("/establecimientos"),
      api<Departamento[]>("/departamentos"),
      api<{ puestoId: number; nombre: string }[]>("/puestos"),
    ]).then(([e, d, p]) => { setEstablecimientos(e); setDepartamentos(d); setPuestos(p); }).catch(() => {});
  }, []);

  function descargarPlantilla() {
    const ejemplo = ["Ana Lucía", "Pérez García", "1234567-8", "", "Hotel Petén", "Recepción", "Recepcionista", "PLANILLA", "4500", "1200", "Bantrab", "001-2345", "2025-01-15"];
    const csv = [COLS_PLANTILLA.join(","), ejemplo.join(",")].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla_colaboradores.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function procesarArchivo(file: File) {
    setError(null); setResumen(null); setFilas([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
        if (raw.length === 0) { setError("El archivo no tiene filas."); return; }
        validar(raw);
      } catch {
        setError("No se pudo leer el archivo. Usa .xlsx o .csv con la plantilla.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function resolverFecha(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  function validar(raw: Record<string, unknown>[]) {
    const estMap = new Map(establecimientos.map((e) => [norm(e.nombre), e.establecimientoId]));
    establecimientos.forEach((e) => estMap.set(norm(e.codigo), e.establecimientoId));

    const out: Fila[] = raw.map((r, i) => {
      // Mapear encabezados por alias.
      const datos: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        const campo = ALIAS[norm(k)];
        if (campo) datos[campo] = String(v ?? "").trim();
      }

      const fila: Fila = { n: i + 2, datos, estado: "ok" };
      if (!datos.nombres || !datos.apellidos) { fila.estado = "error"; fila.error = "Faltan nombres/apellidos."; return fila; }

      const estId = estMap.get(norm(datos.establecimiento));
      if (!estId) { fila.estado = "error"; fila.error = `Establecimiento no encontrado: "${datos.establecimiento}".`; return fila; }

      const tipo = (norm(datos.tipo) === "extra" ? "EXTRA" : "PLANILLA") as "PLANILLA" | "EXTRA";
      if (tipo === "PLANILLA" && !datos.nit) { fila.estado = "error"; fila.error = "El NIT es obligatorio para planilla."; return fila; }

      const sueldo = Number(datos.sueldoBase || 0);
      if (isNaN(sueldo)) { fila.estado = "error"; fila.error = "Sueldo base inválido."; return fila; }

      fila.payload = {
        nombres: datos.nombres, apellidos: datos.apellidos,
        nit: datos.nit || null, dpi: datos.dpi || null, codigo: datos.codigo || null,
        establecimientoId: estId, departamentoId: null, puestoId: null,
        tipo, sueldoBase: sueldo,
        montoQuincena: datos.montoQuincena ? Number(datos.montoQuincena) : 1200,
        banco: datos.banco || null, cuentaBanco: datos.cuentaBanco || null,
        fechaIngreso: resolverFecha(datos.fechaIngreso),
      };
      return fila;
    });
    setFilas(out);
  }

  // Resuelve (o crea) un catálogo simple por nombre y devuelve su id.
  async function resolverCatalogo(
    nombre: string,
    lista: { id: number; nombre: string }[],
    endpoint: string,
    setLista: (v: { id: number; nombre: string }[]) => void
  ): Promise<number | null> {
    if (!nombre) return null;
    const found = lista.find((x) => norm(x.nombre) === norm(nombre));
    if (found) return found.id;
    const creado = await api<Record<string, number>>(endpoint, { method: "POST", body: { nombre } });
    const id = (creado.departamentoId ?? creado.puestoId)!;
    setLista([...lista, { id, nombre }]);
    return id;
  }

  async function importar() {
    setImportando(true);
    setResumen(null);
    let depList = departamentos.map((d) => ({ id: d.departamentoId, nombre: d.nombre }));
    let puList = puestos.map((p) => ({ id: p.puestoId, nombre: p.nombre }));
    const actualizadas = [...filas];
    let ok = 0, fail = 0;

    for (let i = 0; i < actualizadas.length; i++) {
      const f = actualizadas[i];
      if (f.estado === "error" || f.estado === "creado" || !f.payload) continue;
      try {
        // Departamento / puesto: se crean si no existen.
        if (f.datos.departamento) {
          const id = await resolverCatalogo(f.datos.departamento, depList, "/departamentos",
            (v) => { depList = v; });
          f.payload.departamentoId = id;
        }
        if (f.datos.puesto) {
          const id = await resolverCatalogo(f.datos.puesto, puList, "/puestos",
            (v) => { puList = v; });
          f.payload.puestoId = id;
        }
        await api("/empleados", { method: "POST", body: f.payload });
        f.estado = "creado"; f.msg = "Creado";
        ok++;
      } catch (err) {
        f.estado = "fallo"; f.msg = err instanceof ApiError ? err.message : "Error";
        fail++;
      }
    }
    setDepartamentos(depList.map((d) => ({ departamentoId: d.id, nombre: d.nombre })));
    setPuestos(puList.map((p) => ({ puestoId: p.id, nombre: p.nombre })));
    setFilas(actualizadas);
    setResumen(`Importación terminada: ${ok} creados, ${fail} con error.`);
    setImportando(false);
  }

  const validas = filas.filter((f) => f.estado === "ok").length;
  const conError = filas.filter((f) => f.estado === "error").length;

  const badge = (f: Fila) => {
    if (f.estado === "creado") return <span className="badge bg-brand-100 text-brand-800">Creado</span>;
    if (f.estado === "fallo") return <span className="badge bg-red-100 text-red-700">Falló</span>;
    if (f.estado === "error") return <span className="badge bg-amber-100 text-amber-700">Revisar</span>;
    return <span className="badge bg-slate-100 text-slate-600">Listo</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/empleados" className="text-sm text-brand-700 hover:underline">← Colaboradores</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar colaboradores</h1>
        <p className="text-sm text-slate-500">Carga masiva desde Excel/CSV con vista previa antes de guardar.</p>
      </div>

      <div className="card space-y-4 p-5">
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>Descarga la plantilla y pega tus datos (un colaborador por fila).</li>
          <li>El <b>Establecimiento</b> debe existir (por nombre o código). Departamento y Puesto se crean solos si no existen.</li>
          <li>Sube el archivo, revisa la vista previa y confirma.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <button onClick={descargarPlantilla} className="btn-ghost">Descargar plantilla (CSV)</button>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">Subir archivo</button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && procesarArchivo(e.target.files[0])} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {resumen && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{resumen}</p>}
      </div>

      {filas.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {filas.length} filas · <span className="text-brand-700">{validas} listas</span>
              {conError > 0 && <span className="text-amber-700"> · {conError} a revisar</span>}
            </p>
            <button onClick={importar} disabled={importando || validas === 0} className="btn-primary">
              {importando ? "Importando…" : `Importar ${validas} colaboradores`}
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Nombre</th>
                    <th className="th">Establecimiento</th>
                    <th className="th">Tipo</th>
                    <th className="th text-right">Sueldo</th>
                    <th className="th">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((f) => (
                    <tr key={f.n} className={f.estado === "error" || f.estado === "fallo" ? "bg-amber-50/40" : ""}>
                      <td className="td text-slate-400">{f.n}</td>
                      <td className="td font-medium text-slate-900">{f.datos.nombres} {f.datos.apellidos}</td>
                      <td className="td text-slate-600">{f.datos.establecimiento}</td>
                      <td className="td">{f.payload?.tipo ?? (norm(f.datos.tipo) === "extra" ? "EXTRA" : "PLANILLA")}</td>
                      <td className="td text-right">{f.payload ? money(f.payload.sueldoBase) : "—"}</td>
                      <td className="td">
                        {badge(f)}
                        {(f.error || f.msg) && <div className="text-xs text-slate-400">{f.error ?? f.msg}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
