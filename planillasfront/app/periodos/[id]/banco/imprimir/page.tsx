"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { money, tipoPeriodoLabel } from "@/lib/format";
import type { Periodo, BoletaLista, Empleado } from "@/lib/types";

// Carta de acreditamiento al banco (formato CORPETUR). Una carta por
// establecimiento: lista nombre, monto líquido y número de cuenta del colaborador,
// y debita el total de la cuenta del establecimiento. Los datos de cabecera
// (cuenta de la empresa, agencia, firmante, etc.) se editan y se recuerdan por
// establecimiento en el navegador, para no quemarlos en código ni en la BD.

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

interface DatosCarta {
  ciudad: string;
  banco: string;
  ubicacionAgencia: string;
  cuentaEmpresa: string;
  titular: string;
  firmante: string;
  cargo: string;
  fecha: string; // yyyy-mm-dd
}

function datosDefault(estabNombre: string, fechaPago?: string | null): DatosCarta {
  return {
    ciudad: "Flores, Petén",
    banco: "Banrural",
    ubicacionAgencia: "San Benito, Petén",
    cuentaEmpresa: "",
    titular: `${estabNombre} Y/O CORPETURSA`.toUpperCase(),
    firmante: "",
    cargo: estabNombre.toUpperCase(),
    fecha: fechaPago ?? new Date().toISOString().slice(0, 10),
  };
}

function fechaEnTexto(yyyymmdd: string): string {
  const [a, m, d] = yyyymmdd.split("-").map(Number);
  if (!a || !m || !d) return yyyymmdd;
  return `${MESES[m - 1]} ${d}, ${a}`;
}

interface Fila { nombre: string; monto: number; cuenta: string }

export default function CartaBancoPage() {
  const params = useParams<{ id: string }>();
  const periodoId = Number(params.id);

  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [estabId, setEstabId] = useState(0);
  const [estabNombre, setEstabNombre] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [datos, setDatos] = useState<DatosCarta | null>(null);
  const [editar, setEditar] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const est = typeof window !== "undefined"
        ? Number(new URLSearchParams(window.location.search).get("est") || 0) : 0;
      const [per, lista, emps] = await Promise.all([
        api<Periodo>(`/periodospago/${periodoId}`),
        api<BoletaLista[]>(`/boletas?periodoId=${periodoId}`),
        api<Empleado[]>("/empleados?soloActivos=false"),
      ]);
      const map = new Map(emps.map((e) => [e.empleadoId, e]));
      setPeriodo(per);
      setEstabId(est);

      const filtradas = lista
        .filter((b) => b.liquido > 0)
        .filter((b) => !est || map.get(b.empleadoId)?.establecimientoId === est);
      const nombreEstab = est
        ? (emps.find((e) => e.establecimientoId === est)?.establecimientoNombre ?? "")
        : "Todos los establecimientos";
      setEstabNombre(nombreEstab);

      const fs: Fila[] = filtradas
        .map((b) => {
          const e = map.get(b.empleadoId);
          return { nombre: b.empleadoNombre.toUpperCase(), monto: b.liquido, cuenta: e?.cuentaBanco ?? "" };
        })
        .sort((a, z) => a.nombre.localeCompare(z.nombre));
      setFilas(fs);

      // Datos de cabecera recordados por establecimiento.
      const key = `cartaBanco:${est}`;
      let d = datosDefault(nombreEstab, per.fechaPago);
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
        if (raw) d = { ...d, ...JSON.parse(raw), fecha: per.fechaPago ?? d.fecha };
      } catch { /* ignora json inválido */ }
      setDatos(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la carta.");
    } finally {
      setCargando(false);
    }
  }, [periodoId]);

  useEffect(() => { cargar(); }, [cargar]);

  function guardarDatos(d: DatosCarta) {
    setDatos(d);
    try { localStorage.setItem(`cartaBanco:${estabId}`, JSON.stringify(d)); } catch { /* sin persistencia */ }
  }

  if (error) return <div className="p-10 text-center text-red-700">{error}</div>;
  if (cargando || !periodo || !datos) return <div className="p-10 text-center text-slate-400">Cargando…</div>;

  const total = filas.reduce((s, f) => s + f.monto, 0);

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <button onClick={() => window.history.back()} className="btn-ghost btn-sm">← Volver</button>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditar((v) => !v)} className="btn-ghost btn-sm">
            {editar ? "Ocultar datos" : "Editar datos"}
          </button>
          <button onClick={() => window.print()} className="btn-primary btn-sm" disabled={filas.length === 0}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Editor de cabecera */}
      {editar && (
        <div className="mx-auto mb-4 max-w-3xl rounded-xl bg-white p-4 shadow-sm print:hidden">
          <p className="mb-3 text-sm font-semibold text-slate-700">
            Datos de la carta {estabNombre ? `· ${estabNombre}` : ""} (se recuerdan en este navegador)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Ciudad / fecha (lugar)" value={datos.ciudad} onChange={(v) => guardarDatos({ ...datos, ciudad: v })} />
            <label className="block">
              <span className="label">Fecha</span>
              <input type="date" className="input" value={datos.fecha} onChange={(e) => guardarDatos({ ...datos, fecha: e.target.value })} />
            </label>
            <Campo label="Banco" value={datos.banco} onChange={(v) => guardarDatos({ ...datos, banco: v })} />
            <Campo label="Ubicación de la agencia" value={datos.ubicacionAgencia} onChange={(v) => guardarDatos({ ...datos, ubicacionAgencia: v })} />
            <Campo label="Cuenta de la empresa" value={datos.cuentaEmpresa} onChange={(v) => guardarDatos({ ...datos, cuentaEmpresa: v })} />
            <Campo label="Titular de la cuenta" value={datos.titular} onChange={(v) => guardarDatos({ ...datos, titular: v })} />
            <Campo label="Firmante" value={datos.firmante} onChange={(v) => guardarDatos({ ...datos, firmante: v })} />
            <Campo label="Cargo / establecimiento" value={datos.cargo} onChange={(v) => guardarDatos({ ...datos, cargo: v })} />
          </div>
        </div>
      )}

      {/* La carta */}
      <div className="mx-auto max-w-3xl bg-white p-12 text-[13px] leading-relaxed text-slate-900 shadow-sm print:max-w-none print:p-10 print:shadow-none">
        <p className="text-right">Ciudad {datos.ciudad}, {fechaEnTexto(datos.fecha)}.</p>

        <div className="mt-10">
          <p>Señor</p>
          <p>Jefe de Agencia {datos.banco}</p>
          <p>{datos.ubicacionAgencia}.</p>
        </div>

        <p className="mt-10 text-justify">
          Sírvase encontrar el listado de personas y el monto a acreditar a cada cuenta-habiente.
          El monto total será debitado de la cta. <span className="font-semibold">{datos.cuentaEmpresa || "________"}</span> a
          nombre de {datos.titular} ({tipoPeriodoLabel(periodo.tipo)})
        </p>

        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between font-semibold">
            <span>Cantidad a debitar:</span>
            <span className="border border-slate-800 px-6 py-0.5">Q. {money(total).replace("Q", "").trim()}</span>
          </div>

          <table className="w-full border-collapse">
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td className="border border-slate-800 px-2 py-0.5 text-center">{i + 1}</td>
                  <td className="border border-slate-800 px-2 py-0.5">{f.nombre}</td>
                  <td className="border border-slate-800 px-2 py-0.5 text-right tabular-nums">
                    {money(f.monto).replace("Q", "").trim()}
                  </td>
                  <td className="border border-slate-800 px-2 py-0.5 text-center">{f.cuenta || "—"}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-slate-800 px-2 py-0.5"></td>
                <td className="border border-slate-800 px-2 py-0.5">TOTAL</td>
                <td className="border border-slate-800 px-2 py-0.5 text-right tabular-nums">
                  Q {money(total).replace("Q", "").trim()}
                </td>
                <td className="border border-slate-800 px-2 py-0.5"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-10">Agradeceremos se sirva tomar nota de lo anterior.</p>
        <p className="mt-1">Atentamente,</p>

        <div className="mt-20 text-center">
          <p className="italic">{datos.firmante || "________________________"}</p>
          <p className="font-semibold">{datos.cargo}</p>
        </div>

        {filas.length === 0 && (
          <p className="mt-6 text-center text-slate-400">
            No hay colaboradores con líquido positivo para este establecimiento.
          </p>
        )}
      </div>
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
