"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre, tipoPeriodoLabel } from "@/lib/format";
import { exportarExcel } from "@/lib/excel";
import { useToast } from "@/lib/toast";
import { IconCash } from "@/components/icons";
import { SkeletonRows } from "@/components/Skeleton";
import type {
  Periodo, BoletaLista, Boleta, Concepto, Establecimiento, Empleado, RepartoResultado,
} from "@/lib/types";

export default function PeriodoDetallePage() {
  const params = useParams<{ id: string }>();
  const periodoId = Number(params.id);
  const toast = useToast();

  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargando, setCargando] = useState(true);

  const [boletaSel, setBoletaSel] = useState<Boleta | null>(null);
  const [repartoOpen, setRepartoOpen] = useState(false);

  // Filtros y agrupación
  const [filtroEstab, setFiltroEstab] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [per, bol, est, con, emp] = await Promise.all([
        api<Periodo>(`/periodospago/${periodoId}`),
        api<BoletaLista[]>(`/boletas?periodoId=${periodoId}`),
        api<Establecimiento[]>("/establecimientos"),
        api<Concepto[]>("/conceptos"),
        api<Empleado[]>("/empleados?soloActivos=false"),
      ]);
      setPeriodo(per);
      setBoletas(bol);
      setEstablecimientos(est);
      setConceptos(con);
      setEmpleados(emp);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo cargar el período.");
    } finally {
      setCargando(false);
    }
  }, [periodoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const cerrado = periodo?.estado === "CERRADO";
  const totalLiquido = boletas.reduce((s, b) => s + b.liquido, 0);
  const totalIngresos = boletas.reduce((s, b) => s + b.totalIngresos, 0);
  const totalEgresos = boletas.reduce((s, b) => s + b.totalEgresos, 0);

  // Mapa empleadoId -> establecimiento (la boleta no lo trae).
  const empMap = useMemo(
    () => new Map(empleados.map((e) => [e.empleadoId, e])),
    [empleados]
  );

  const boletasFiltradas = useMemo(() => {
    return boletas.filter((b) => {
      const emp = empMap.get(b.empleadoId);
      if (filtroEstab && emp?.establecimientoId !== filtroEstab) return false;
      if (busqueda && !b.empleadoNombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }, [boletas, empMap, filtroEstab, busqueda]);

  // Agrupa por establecimiento y, dentro, por departamento (como en los Excel).
  const grupos = useMemo(() => {
    const m = new Map<string, {
      nombre: string; boletas: { b: BoletaLista; depto: string }[]; ing: number; egr: number; liq: number;
    }>();
    for (const b of boletasFiltradas) {
      const e = empMap.get(b.empleadoId);
      const key = e?.establecimientoNombre ?? "—";
      if (!m.has(key)) m.set(key, { nombre: key, boletas: [], ing: 0, egr: 0, liq: 0 });
      const g = m.get(key)!;
      g.boletas.push({ b, depto: e?.departamentoNombre ?? "Sin departamento" });
      g.ing += b.totalIngresos; g.egr += b.totalEgresos; g.liq += b.liquido;
    }
    const arr = [...m.values()].sort((a, z) => a.nombre.localeCompare(z.nombre));
    for (const g of arr)
      g.boletas.sort((a, z) => a.depto.localeCompare(z.depto) || a.b.empleadoNombre.localeCompare(z.b.empleadoNombre));
    return arr;
  }, [boletasFiltradas, empMap]);

  const toggle = (n: string) =>
    setColapsados((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

  const etiqueta = () => (periodo ? `${periodo.tipo}_${periodo.mes}_${periodo.anio}` : String(periodoId));

  function exportar() {
    const filas = boletasFiltradas.map((b) => ({
      Colaborador: b.empleadoNombre,
      Establecimiento: empMap.get(b.empleadoId)?.establecimientoNombre ?? "",
      Ingresos: b.totalIngresos,
      Egresos: b.totalEgresos,
      Líquido: b.liquido,
      Estado: b.estado,
    }));
    exportarExcel(`planilla_${etiqueta()}`, filas, "Planilla");
  }

  // Lote de pago para el banco: solo líquido > 0; marca los que no tienen cuenta.
  function exportarBanco() {
    const filas = boletasFiltradas
      .filter((b) => b.liquido > 0)
      .map((b) => {
        const e = empMap.get(b.empleadoId);
        return {
          Colaborador: b.empleadoNombre,
          NIT: e?.nit ?? "",
          Banco: e?.banco ?? "",
          Cuenta: e?.cuentaBanco ?? "(SIN CUENTA)",
          Monto: b.liquido,
        };
      });
    if (filas.length === 0) { toast.error("No hay pagos con líquido positivo para exportar."); return; }
    exportarExcel(`pago_banco_${etiqueta()}`, filas, "Pago banco");
  }

  async function abrirBoleta(id: number) {
    try {
      setBoletaSel(await api<Boleta>(`/boletas/${id}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo abrir la boleta.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/periodos" className="text-sm text-brand-700 hover:underline">← Períodos</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {periodo ? `${tipoPeriodoLabel(periodo.tipo)} · ${mesNombre(periodo.mes)} ${periodo.anio}` : "Período"}
            </h1>
            {periodo && (
              <p className="text-sm text-slate-500">
                {periodo.fechaInicio} → {periodo.fechaFin} ·{" "}
                <span className="font-medium">{periodo.estado}</span>
              </p>
            )}
          </div>
          {!cerrado && periodo?.tipo === "EXTRA" && (
            <button onClick={() => setRepartoOpen(true)} className="btn-primary">
              <IconCash className="h-4 w-4" /> Repartir comisión / propina
            </button>
          )}
        </div>
      </div>


      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Resumen titulo="Total ingresos" valor={money(totalIngresos)} />
        <Resumen titulo="Total egresos" valor={money(totalEgresos)} />
        <Resumen titulo="Líquido a pagar" valor={money(totalLiquido)} destacado />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Buscar colaborador…"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select className="input max-w-xs" value={filtroEstab} onChange={(e) => setFiltroEstab(Number(e.target.value))}>
          <option value={0}>Todos los establecimientos</option>
          {establecimientos.map((es) => (
            <option key={es.establecimientoId} value={es.establecimientoId}>{es.nombre}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{boletasFiltradas.length} boletas</span>
        <button onClick={exportar} disabled={boletasFiltradas.length === 0} className="btn-ghost btn-sm ml-auto">
          Exportar Excel
        </button>
        <button onClick={exportarBanco} disabled={boletasFiltradas.length === 0} className="btn-ghost btn-sm">
          Archivo de pago al banco
        </button>
        <a href={`/periodos/${periodoId}/boletas/imprimir${filtroEstab ? `?est=${filtroEstab}` : ""}`}
          target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
          Imprimir boletas
        </a>
      </div>

      {/* Planilla agrupada por establecimiento (y departamento dentro) */}
      {cargando ? (
        <div className="card overflow-hidden">
          <table className="w-full"><tbody className="divide-y divide-slate-100"><SkeletonRows cols={6} /></tbody></table>
        </div>
      ) : boletas.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">Sin boletas. Usa “Generar” en la lista de períodos.</div>
      ) : grupos.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">Sin coincidencias.</div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const cerradoGrupo = colapsados.has(g.nombre);
            return (
              <div key={g.nombre} className="card overflow-hidden">
                <button onClick={() => toggle(g.nombre)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-left hover:bg-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`text-slate-400 transition ${cerradoGrupo ? "-rotate-90" : ""}`}>▾</span>
                    <span className="font-semibold text-slate-900">{g.nombre}</span>
                    <span className="badge bg-slate-200 text-slate-600">{g.boletas.length}</span>
                  </div>
                  <span className="text-sm text-slate-600">Líquido: <b className="text-slate-900">{money(g.liq)}</b></span>
                </button>

                {!cerradoGrupo && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-slate-200 text-xs">
                        <tr>
                          <th className="th">Colaborador</th>
                          <th className="th text-right">Ingresos</th>
                          <th className="th text-right">Egresos</th>
                          <th className="th text-right">Líquido</th>
                          <th className="th">Estado</th>
                          <th className="th"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {g.boletas.map(({ b, depto }, i) => {
                          const nuevoDepto = i === 0 || g.boletas[i - 1].depto !== depto;
                          return (
                            <Fragment key={b.boletaId}>
                              {nuevoDepto && (
                                <tr className="bg-slate-50/60">
                                  <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {depto}
                                  </td>
                                </tr>
                              )}
                              <tr className="hover:bg-slate-50">
                                <td className="td font-medium text-slate-900">{b.empleadoNombre}</td>
                                <td className="td text-right">{money(b.totalIngresos)}</td>
                                <td className="td text-right">{money(b.totalEgresos)}</td>
                                <td className="td text-right font-semibold">{money(b.liquido)}</td>
                                <td className="td"><span className="badge bg-slate-100 text-slate-600">{b.estado}</span></td>
                                <td className="td text-right">
                                  <button onClick={() => abrirBoleta(b.boletaId)} className="font-medium text-brand-700 hover:underline">Ver</button>
                                </td>
                              </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                        <tr>
                          <td className="td font-semibold">Subtotal {g.nombre}</td>
                          <td className="td text-right font-semibold">{money(g.ing)}</td>
                          <td className="td text-right font-semibold">{money(g.egr)}</td>
                          <td className="td text-right font-bold text-slate-900">{money(g.liq)}</td>
                          <td className="td" colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
          onDone={async (msg) => { setRepartoOpen(false); toast.success(msg); await cargar(); }}
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
  const toast = useToast();
  const editable = !cerrado && boleta.estado !== "PAGADA";
  // Líneas que genera/regenera el motor: no se editan a mano (se recalculan).
  const BLOQUEADAS = ["SUELDO", "IGSS", "ANTICIPO", "ANT_QUINCENA"];
  const [conceptoId, setConceptoId] = useState(0);
  const [monto, setMonto] = useState("");
  const [desc, setDesc] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function editar(d: Boleta["detalles"][number]) {
    setEditId(d.boletaDetalleId);
    setConceptoId(d.conceptoId);
    setMonto(String(d.monto));
    setDesc(d.descripcion ?? "");
    setError(null);
  }
  function cancelarEdicion() {
    setEditId(null); setConceptoId(0); setMonto(""); setDesc("");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!conceptoId || !monto) { setError("Elige concepto y monto."); return; }
    setGuardando(true);
    try {
      const body = { conceptoId, monto: Number(monto), descripcion: desc.trim() || null };
      if (editId) await api(`/boletas/${boleta.boletaId}/lineas/${editId}`, { method: "PUT", body });
      else await api(`/boletas/${boleta.boletaId}/lineas`, { method: "POST", body });
      setEditId(null); setConceptoId(0); setMonto(""); setDesc("");
      toast.success(editId ? "Línea actualizada." : "Línea agregada.");
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la línea.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(detalleId: number) {
    if (!confirm("¿Eliminar esta línea?")) return;
    try {
      await api(`/boletas/${boleta.boletaId}/lineas/${detalleId}`, { method: "DELETE" });
      toast.success("Línea eliminada.");
      await onChange();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar.");
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
          <div className="flex items-center gap-3">
            <a href={`/boletas/${boleta.boletaId}/imprimir`} target="_blank" rel="noopener noreferrer"
              className="btn-ghost btn-sm">
              Imprimir
            </a>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
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
                <td className="td text-right whitespace-nowrap">
                  {BLOQUEADAS.includes(d.conceptoCodigo) ? (
                    <span className="text-xs text-slate-400">auto</span>
                  ) : editable ? (
                    <>
                      <button onClick={() => editar(d)} className="mr-2 text-xs font-medium text-brand-700 hover:underline">Editar</button>
                      <button onClick={() => borrar(d.boletaDetalleId)} className="text-xs font-medium text-red-600 hover:underline">Quitar</button>
                    </>
                  ) : null}
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
          <form onSubmit={guardar} className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              {editId ? "Editar línea" : "Agregar línea manual"}
            </div>
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
            <div className="mt-3 flex justify-end gap-2">
              {editId && (
                <button type="button" onClick={cancelarEdicion} className="btn-ghost btn-sm">Cancelar</button>
              )}
              <button type="submit" disabled={guardando} className="btn-primary btn-sm">
                {guardando ? "Guardando…" : editId ? "Guardar cambios" : "Agregar línea"}
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
  const conceptosIngreso = conceptos.filter((c) => c.naturaleza === "INGRESO");
  const conceptoComision = conceptosIngreso.find((c) => c.codigo === "COMISION");
  const [conceptoId, setConceptoId] = useState(0);
  const [montoTotal, setMontoTotal] = useState("");
  const [modo, setModo] = useState<"IGUAL" | "PESO">("IGUAL");
  const [descripcion, setDescripcion] = useState("");
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());          // empleados elegidos
  const [pesos, setPesos] = useState<Record<number, string>>({});
  const [filtroEstab, setFiltroEstab] = useState(0);               // filtro para encontrar gente
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Carga TODO el personal de planilla activo (de cualquier establecimiento).
  useEffect(() => {
    api<Empleado[]>("/empleados?tipo=PLANILLA&soloActivos=true")
      .then((emps) => setEmpleados(emps.sort((a, b) =>
        (a.establecimientoNombre ?? "").localeCompare(b.establecimientoNombre ?? "") ||
        a.apellidos.localeCompare(b.apellidos))))
      .catch(() => setEmpleados([]));
  }, []);

  const visibles = empleados.filter((e) => {
    if (filtroEstab && e.establecimientoId !== filtroEstab) return false;
    if (busqueda && !`${e.nombres} ${e.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  function toggle(id: number) {
    setSel((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });
    setPesos((p) => ({ ...p, [id]: p[id] ?? "1" }));
  }
  const seleccionarVisibles = () => {
    setSel((s) => { const x = new Set(s); visibles.forEach((e) => x.add(e.empleadoId)); return x; });
    setPesos((p) => { const x = { ...p }; visibles.forEach((e) => { x[e.empleadoId] = x[e.empleadoId] ?? "1"; }); return x; });
  };
  const limpiar = () => setSel(new Set());

  async function repartir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!montoTotal) { setError("Indica el monto de la bolsa."); return; }
    if (sel.size === 0) { setError("Selecciona al menos un colaborador."); return; }
    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        periodoPagoId: periodoId,
        establecimientoId: filtroEstab || null,
        montoTotal: Number(montoTotal),
        modo,
        conceptoId: conceptoId || conceptoComision?.conceptoId || null,
        descripcion: descripcion.trim() || null,
        empleados: [...sel].map((id) => ({ empleadoId: id, peso: modo === "PESO" ? Number(pesos[id] ?? "0") : 1 })),
      };
      const r = await api<RepartoResultado>("/comisiones/repartir", { method: "POST", body });
      await onDone(`Comisión repartida: ${money(r.montoRepartido)} entre ${r.empleados} colaboradores.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo repartir.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card flex max-h-[92vh] w-full max-w-xl flex-col p-6">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Repartir comisión / propina</h2>
            <p className="text-sm text-slate-500">Elige a quiénes y cómo se reparte la bolsa.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <form onSubmit={repartir} className="flex min-h-0 flex-1 flex-col gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Concepto</span>
              <select className="input" value={conceptoId} onChange={(e) => setConceptoId(Number(e.target.value))}>
                <option value={0}>{conceptoComision ? `${conceptoComision.nombre} (predeterminado)` : "Comisión"}</option>
                {conceptosIngreso.map((c) => (
                  <option key={c.conceptoId} value={c.conceptoId}>{c.nombre}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Descripción</span>
              <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                placeholder="ej. Propina / Bono ocupación" />
            </label>
          </div>

          {/* Selección de colaboradores */}
          <div className="flex flex-wrap items-center gap-2">
            <select className="input max-w-[14rem]" value={filtroEstab} onChange={(e) => setFiltroEstab(Number(e.target.value))}>
              <option value={0}>Todos los establecimientos</option>
              {establecimientos.map((es) => (
                <option key={es.establecimientoId} value={es.establecimientoId}>{es.nombre}</option>
              ))}
            </select>
            <input className="input max-w-[12rem]" placeholder="Buscar…" value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)} />
            <button type="button" onClick={seleccionarVisibles} className="btn-ghost btn-sm">Seleccionar visibles</button>
            <button type="button" onClick={limpiar} className="btn-ghost btn-sm">Limpiar</button>
            <span className="ml-auto text-sm font-medium text-brand-700">{sel.size} elegidos</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200">
            {visibles.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-400">Sin colaboradores.</p>
            ) : visibles.map((emp) => {
              const elegido = sel.has(emp.empleadoId);
              return (
                <div key={emp.empleadoId} className="flex items-center gap-3 border-b border-slate-50 px-3 py-2">
                  <input type="checkbox" checked={elegido} onChange={() => toggle(emp.empleadoId)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-800">{emp.nombres} {emp.apellidos}</div>
                    <div className="text-xs text-slate-400">{emp.establecimientoNombre}</div>
                  </div>
                  {modo === "PESO" && elegido && (
                    <input type="number" step="0.01" min="0" className="input w-20 py-1" value={pesos[emp.empleadoId] ?? "1"}
                      onChange={(e) => setPesos({ ...pesos, [emp.empleadoId]: e.target.value })} title="Peso" />
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
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
