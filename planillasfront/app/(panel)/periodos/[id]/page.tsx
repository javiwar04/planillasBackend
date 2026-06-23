"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { money, mesNombre } from "@/lib/format";
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

  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [boletaSel, setBoletaSel] = useState<Boleta | null>(null);
  const [repartoOpen, setRepartoOpen] = useState(false);

  // Filtros y paginación
  const [filtroEstab, setFiltroEstab] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 15;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
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

  const totalPaginas = Math.max(1, Math.ceil(boletasFiltradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = boletasFiltradas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  useEffect(() => { setPagina(1); }, [filtroEstab, busqueda]);

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
    if (filas.length === 0) { setError("No hay pagos con líquido positivo para exportar."); return; }
    exportarExcel(`pago_banco_${etiqueta()}`, filas, "Pago banco");
  }

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
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Colaborador</th>
                <th className="th">Establecimiento</th>
                <th className="th text-right">Ingresos</th>
                <th className="th text-right">Egresos</th>
                <th className="th text-right">Líquido</th>
                <th className="th">Estado</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <SkeletonRows cols={7} />
              ) : boletas.length === 0 ? (
                <tr><td colSpan={7} className="td py-10 text-center text-slate-400">
                  Sin boletas. Usa “Generar” en la lista de períodos.
                </td></tr>
              ) : visibles.length === 0 ? (
                <tr><td colSpan={7} className="td py-10 text-center text-slate-400">Sin coincidencias.</td></tr>
              ) : (
                visibles.map((b) => (
                  <tr key={b.boletaId} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900">{b.empleadoNombre}</td>
                    <td className="td text-slate-600">{empMap.get(b.empleadoId)?.establecimientoNombre ?? "—"}</td>
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

        {/* Paginación */}
        {boletasFiltradas.length > porPagina && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">
              {(paginaActual - 1) * porPagina + 1}–{Math.min(paginaActual * porPagina, boletasFiltradas.length)} de {boletasFiltradas.length}
            </span>
            <div className="flex items-center gap-1">
              <button className="btn-ghost btn-sm" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>
                Anterior
              </button>
              <span className="px-2 text-slate-600">{paginaActual} / {totalPaginas}</span>
              <button className="btn-ghost btn-sm" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
                Siguiente
              </button>
            </div>
          </div>
        )}
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
  const toast = useToast();
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
