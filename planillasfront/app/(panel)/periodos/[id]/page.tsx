"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre } from "@/lib/format";
import { IconCash } from "@/components/icons";
import type {
  Periodo, BoletaLista, Boleta, Concepto, Establecimiento, Empleado, RepartoResultado,
} from "@/lib/types";

export default function PeriodoDetallePage() {
  const params = useParams<{ id: string }>();
  const periodoId = Number(params.id);

  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [boletaSel, setBoletaSel] = useState<Boleta | null>(null);
  const [repartoOpen, setRepartoOpen] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [per, bol, est, con] = await Promise.all([
        api<Periodo>(`/periodospago/${periodoId}`),
        api<BoletaLista[]>(`/boletas?periodoId=${periodoId}`),
        api<Establecimiento[]>("/establecimientos"),
        api<Concepto[]>("/conceptos"),
      ]);
      setPeriodo(per);
      setBoletas(bol);
      setEstablecimientos(est);
      setConceptos(con);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el período.");
    } finally {
      setCargando(false);
    }
  }, [periodoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const cerrado = periodo?.estado === "CERRADO";
  const totalLiquido = boletas.reduce((s, b) => s + b.liquido, 0);
  const totalIngresos = boletas.reduce((s, b) => s + b.totalIngresos, 0);
  const totalEgresos = boletas.reduce((s, b) => s + b.totalEgresos, 0);

  async function abrirBoleta(id: number) {
    try {
      setBoletaSel(await api<Boleta>(`/boletas/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir la boleta.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/periodos" className="text-sm text-brand-700 hover:underline">← Períodos</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {periodo ? `${periodo.tipo === "QUINCENA" ? "Quincena" : "Fin de mes"} · ${mesNombre(periodo.mes)} ${periodo.anio}` : "Período"}
            </h1>
            {periodo && (
              <p className="text-sm text-slate-500">
                {periodo.fechaInicio} → {periodo.fechaFin} ·{" "}
                <span className="font-medium">{periodo.estado}</span>
              </p>
            )}
          </div>
          {!cerrado && (
            <button onClick={() => setRepartoOpen(true)} className="btn-primary">
              <IconCash className="h-4 w-4" /> Repartir comisión
            </button>
          )}
        </div>
      </div>

      {aviso && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Resumen titulo="Total ingresos" valor={money(totalIngresos)} />
        <Resumen titulo="Total egresos" valor={money(totalEgresos)} />
        <Resumen titulo="Líquido a pagar" valor={money(totalLiquido)} destacado />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Empleado</th>
                <th className="th text-right">Ingresos</th>
                <th className="th text-right">Egresos</th>
                <th className="th text-right">Líquido</th>
                <th className="th">Estado</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={6} className="td py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : boletas.length === 0 ? (
                <tr><td colSpan={6} className="td py-10 text-center text-slate-400">
                  Sin boletas. Usa “Generar” en la lista de períodos.
                </td></tr>
              ) : (
                boletas.map((b) => (
                  <tr key={b.boletaId} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900">{b.empleadoNombre}</td>
                    <td className="td text-right">{money(b.totalIngresos)}</td>
                    <td className="td text-right">{money(b.totalEgresos)}</td>
                    <td className="td text-right font-semibold">{money(b.liquido)}</td>
                    <td className="td"><span className="badge bg-slate-100 text-slate-600">{b.estado}</span></td>
                    <td className="td text-right">
                      <button onClick={() => abrirBoleta(b.boletaId)} className="font-medium text-brand-700 hover:underline">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {boletaSel && (
        <BoletaModal
          boleta={boletaSel}
          conceptos={conceptos}
          cerrado={cerrado}
          onClose={() => setBoletaSel(null)}
          onChange={async () => { await abrirBoleta(boletaSel.boletaId); await cargar(); }}
        />
      )}

      {repartoOpen && (
        <RepartoModal
          periodoId={periodoId}
          establecimientos={establecimientos}
          conceptos={conceptos}
          onClose={() => setRepartoOpen(false)}
          onDone={async (msg) => { setRepartoOpen(false); setAviso(msg); await cargar(); }}
        />
      )}
    </div>
  );
}

function Resumen({ titulo, valor, destacado }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`card p-5 ${destacado ? "border-brand-200 bg-brand-50" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className={`mt-1 text-2xl font-bold ${destacado ? "text-brand-800" : "text-slate-900"}`}>{valor}</div>
    </div>
  );
}

/* ---------------- Modal de boleta (ver/editar líneas) ---------------- */
function BoletaModal({
  boleta, conceptos, cerrado, onClose, onChange,
}: {
  boleta: Boleta;
  conceptos: Concepto[];
  cerrado: boolean;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const editable = !cerrado && boleta.estado !== "PAGADA";
  const [conceptoId, setConceptoId] = useState(0);
  const [monto, setMonto] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!conceptoId || !monto) { setError("Elige concepto y monto."); return; }
    setGuardando(true);
    try {
      await api(`/boletas/${boleta.boletaId}/lineas`, {
        method: "POST",
        body: { conceptoId, monto: Number(monto), descripcion: desc.trim() || null },
      });
      setConceptoId(0); setMonto(""); setDesc("");
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo agregar la línea.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(detalleId: number) {
    if (!confirm("¿Eliminar esta línea?")) return;
    try {
      await api(`/boletas/${boleta.boletaId}/lineas/${detalleId}`, { method: "DELETE" });
      await onChange();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{boleta.empleadoNombre}</h2>
            <span className="badge bg-slate-100 text-slate-600">{boleta.estado}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Concepto</th>
              <th className="th text-right">Ingreso</th>
              <th className="th text-right">Egreso</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {boleta.detalles.map((d) => (
              <tr key={d.boletaDetalleId}>
                <td className="td">
                  <div className="font-medium text-slate-800">{d.conceptoNombre}</div>
                  {d.descripcion && <div className="text-xs text-slate-400">{d.descripcion}</div>}
                </td>
                <td className="td text-right text-brand-700">{d.naturaleza === "INGRESO" ? money(d.monto) : ""}</td>
                <td className="td text-right text-red-600">{d.naturaleza === "EGRESO" ? money(d.monto) : ""}</td>
                <td className="td text-right">
                  {editable && !d.esCalculado && (
                    <button onClick={() => borrar(d.boletaDetalleId)} className="text-xs font-medium text-red-600 hover:underline">
                      Quitar
                    </button>
                  )}
                  {d.esCalculado && <span className="text-xs text-slate-400">auto</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200">
            <tr>
              <td className="td font-semibold">Líquido</td>
              <td className="td text-right text-xs text-slate-400">{money(boleta.totalIngresos)}</td>
              <td className="td text-right text-xs text-slate-400">{money(boleta.totalEgresos)}</td>
              <td className="td text-right text-lg font-bold text-slate-900">{money(boleta.liquido)}</td>
            </tr>
          </tfoot>
        </table>

        {editable ? (
          <form onSubmit={agregar} className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="mb-1 text-sm font-semibold text-slate-700">Agregar línea manual</div>
            <p className="mb-3 text-xs text-slate-500">Comisión, ISR, bonificación, préstamos, descuentos…</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
              <select className="input sm:col-span-5" value={conceptoId}
                onChange={(e) => setConceptoId(Number(e.target.value))}>
                <option value={0}>Concepto…</option>
                <optgroup label="Ingresos">
                  {conceptos.filter((c) => c.naturaleza === "INGRESO").map((c) => (
                    <option key={c.conceptoId} value={c.conceptoId}>{c.nombre}</option>
                  ))}
                </optgroup>
                <optgroup label="Egresos">
                  {conceptos.filter((c) => c.naturaleza === "EGRESO").map((c) => (
                    <option key={c.conceptoId} value={c.conceptoId}>{c.nombre}</option>
                  ))}
                </optgroup>
              </select>
              <input type="number" step="0.01" min="0" placeholder="Monto" className="input sm:col-span-3"
                value={monto} onChange={(e) => setMonto(e.target.value)} />
              <input placeholder="Descripción (opcional)" className="input sm:col-span-4"
                value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
            <div className="mt-3 flex justify-end">
              <button type="submit" disabled={guardando} className="btn-primary btn-sm">
                {guardando ? "Agregando…" : "Agregar línea"}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Boleta en estado {boleta.estado}: no editable.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Modal de reparto de comisión ---------------- */
function RepartoModal({
  periodoId, establecimientos, conceptos, onClose, onDone,
}: {
  periodoId: number;
  establecimientos: Establecimiento[];
  conceptos: Concepto[];
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}) {
  const conceptoComision = conceptos.find((c) => c.codigo === "COMISION");
  const [establecimientoId, setEstablecimientoId] = useState(0);
  const [montoTotal, setMontoTotal] = useState("");
  const [modo, setModo] = useState<"IGUAL" | "PESO">("IGUAL");
  const [descripcion, setDescripcion] = useState("");
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [pesos, setPesos] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Carga empleados del establecimiento cuando se necesita modo PESO.
  useEffect(() => {
    if (!establecimientoId) { setEmpleados([]); return; }
    api<Empleado[]>(`/empleados?establecimientoId=${establecimientoId}&tipo=PLANILLA&soloActivos=true`)
      .then((emps) => {
        setEmpleados(emps);
        setPesos(Object.fromEntries(emps.map((e) => [e.empleadoId, "1"])));
      })
      .catch(() => setEmpleados([]));
  }, [establecimientoId]);

  async function repartir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!establecimientoId || !montoTotal) { setError("Elige establecimiento y monto."); return; }
    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        periodoPagoId: periodoId,
        establecimientoId,
        montoTotal: Number(montoTotal),
        modo,
        conceptoId: conceptoComision?.conceptoId ?? null,
        descripcion: descripcion.trim() || null,
      };
      if (modo === "PESO") {
        body.empleados = empleados.map((emp) => ({
          empleadoId: emp.empleadoId,
          peso: Number(pesos[emp.empleadoId] ?? "0"),
        }));
      }
      const r = await api<RepartoResultado>("/comisiones/repartir", { method: "POST", body });
      await onDone(`Comisión repartida: ${money(r.montoRepartido)} entre ${r.empleados} empleados.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo repartir.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Repartir comisión</h2>
            <p className="text-sm text-slate-500">La bolsa se reparte entre el personal del establecimiento.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <form onSubmit={repartir} className="space-y-3">
          <label className="block">
            <span className="label">Establecimiento *</span>
            <select className="input" value={establecimientoId}
              onChange={(e) => setEstablecimientoId(Number(e.target.value))}>
              <option value={0}>Seleccione…</option>
              {establecimientos.map((es) => (
                <option key={es.establecimientoId} value={es.establecimientoId}>{es.nombre}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Monto total (bolsa) *</span>
              <input type="number" step="0.01" min="0" className="input" value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)} placeholder="25000" />
            </label>
            <label className="block">
              <span className="label">Modo *</span>
              <select className="input" value={modo} onChange={(e) => setModo(e.target.value as "IGUAL" | "PESO")}>
                <option value="IGUAL">Partes iguales</option>
                <option value="PESO">Por peso</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="label">Descripción</span>
            <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="(opcional)" />
          </label>

          {modo === "IGUAL" && establecimientoId > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Se reparte en partes iguales entre los <b>{empleados.length}</b> empleados de planilla activos del establecimiento.
            </p>
          )}

          {modo === "PESO" && (
            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                Pesos por empleado
              </div>
              <div className="max-h-52 overflow-y-auto">
                {empleados.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400">Elige un establecimiento.</p>
                ) : empleados.map((emp) => (
                  <div key={emp.empleadoId} className="flex items-center justify-between gap-3 border-b border-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{emp.nombres} {emp.apellidos}</span>
                    <input type="number" step="0.01" min="0" className="input w-24 py-1"
                      value={pesos[emp.empleadoId] ?? ""}
                      onChange={(e) => setPesos({ ...pesos, [emp.empleadoId]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={enviando} className="btn-primary">
              {enviando ? "Repartiendo…" : "Repartir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
