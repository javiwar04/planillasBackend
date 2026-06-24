"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { money, mesNombre } from "@/lib/format";
import type { Prestamo, PrestamoMovimiento, Periodo } from "@/lib/types";

const hoy = new Date().toISOString().slice(0, 10);

export default function PrestamoDetallePage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [movs, setMovs] = useState<PrestamoMovimiento[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario de nuevo movimiento
  const [tipo, setTipo] = useState<"DESEMBOLSO" | "ABONO" | "AJUSTE">("ABONO");
  const [fecha, setFecha] = useState(hoy);
  const [monto, setMonto] = useState("");
  const [periodoId, setPeriodoId] = useState(0);
  const [saldoResultante, setSaldoResultante] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [p, m, per] = await Promise.all([
        api<Prestamo>(`/prestamos/${id}`),
        api<PrestamoMovimiento[]>(`/prestamomovimientos?prestamoId=${id}`),
        api<Periodo[]>("/periodospago"),
      ]);
      setPrestamo(p);
      setMovs(m);
      setPeriodos(per);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el préstamo.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Sugerencia de saldo resultante según el saldo actual y el tipo.
  useEffect(() => {
    if (!prestamo || monto === "") { setSaldoResultante(""); return; }
    const m = Number(monto);
    const nuevo = tipo === "DESEMBOLSO" ? prestamo.saldo + m : prestamo.saldo - m;
    setSaldoResultante(String(Math.max(0, Math.round(nuevo * 100) / 100)));
  }, [monto, tipo, prestamo]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!prestamo) return;
    setGuardando(true);
    setError(null);
    try {
      const saldo = Number(saldoResultante);
      await api("/prestamomovimientos", {
        method: "POST",
        body: {
          prestamoId: id,
          periodoPagoId: periodoId || null,
          fecha,
          tipo,
          monto: Number(monto),
          saldoResultante: saldo,
        },
      });
      // Reconciliar el saldo del préstamo con el resultante del movimiento.
      await api(`/prestamos/${id}`, {
        method: "PUT",
        body: {
          empleadoId: prestamo.empleadoId,
          tipo: prestamo.tipo,
          montoOriginal: prestamo.montoOriginal,
          cuotaSugerida: prestamo.cuotaSugerida ?? null,
          saldo,
          fechaInicio: prestamo.fechaInicio,
        },
      });
      setMonto(""); setSaldoResultante(""); setPeriodoId(0);
      toast.success("Movimiento registrado.");
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  }

  const tipoBadge = (t: string) => {
    if (t === "DESEMBOLSO") return "bg-amber-100 text-amber-700";
    if (t === "ABONO") return "bg-brand-100 text-brand-800";
    return "bg-slate-100 text-slate-600";
  };
  const periodoLabel = (pid?: number | null) => {
    if (!pid) return "—";
    const p = periodos.find((x) => x.periodoPagoId === pid);
    return p ? `${mesNombre(p.mes)} ${p.anio}` : `#${pid}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/prestamos" className="text-sm text-brand-700 hover:underline">← Préstamos</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {prestamo ? `Préstamo ${prestamo.tipo} · ${prestamo.empleadoNombre}` : "Préstamo"}
        </h1>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {prestamo && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Dato titulo="Monto original" valor={money(prestamo.montoOriginal)} />
          <Dato titulo="Saldo actual" valor={money(prestamo.saldo)} destacado />
          <Dato titulo="Cuota sugerida" valor={prestamo.cuotaSugerida ? money(prestamo.cuotaSugerida) : "—"} />
          <Dato titulo="Estado" valor={prestamo.estado} />
        </div>
      )}

      {/* Nuevo movimiento */}
      {prestamo && prestamo.estado === "ACTIVO" && (
        <form onSubmit={agregar} className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Registrar movimiento</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="block">
              <span className="label">Tipo</span>
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                <option value="ABONO">Abono</option>
                <option value="DESEMBOLSO">Desembolso</option>
                <option value="AJUSTE">Ajuste</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Fecha</span>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
            <label className="block">
              <span className="label">Monto</span>
              <input type="number" step="0.01" min="0" className="input" value={monto}
                onChange={(e) => setMonto(e.target.value)} required />
            </label>
            <label className="block">
              <span className="label">Período (opcional)</span>
              <select className="input" value={periodoId} onChange={(e) => setPeriodoId(Number(e.target.value))}>
                <option value={0}>—</option>
                {periodos.map((p) => (
                  <option key={p.periodoPagoId} value={p.periodoPagoId}>
                    {mesNombre(p.mes)} {p.anio} · {p.tipo === "QUINCENA" ? "Q" : "FM"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Saldo resultante</span>
              <input type="number" step="0.01" min="0" className="input" value={saldoResultante}
                onChange={(e) => setSaldoResultante(e.target.value)} required />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      )}

      {/* Historial */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">Historial de movimientos</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Tipo</th>
                <th className="th">Período</th>
                <th className="th text-right">Monto</th>
                <th className="th text-right">Saldo resultante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : movs.length === 0 ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Sin movimientos.</td></tr>
              ) : (
                movs.map((m) => (
                  <tr key={m.prestamoMovimientoId} className="hover:bg-slate-50">
                    <td className="td">{m.fecha}</td>
                    <td className="td"><span className={`badge ${tipoBadge(m.tipo)}`}>{m.tipo}</span></td>
                    <td className="td text-slate-500">{periodoLabel(m.periodoPagoId)}</td>
                    <td className="td text-right">{money(m.monto)}</td>
                    <td className="td text-right font-semibold">{money(m.saldoResultante)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, destacado }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`card p-4 ${destacado ? "border-brand-200 bg-brand-50" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className={`mt-1 text-lg font-bold ${destacado ? "text-brand-800" : "text-slate-900"}`}>{valor}</div>
    </div>
  );
}
