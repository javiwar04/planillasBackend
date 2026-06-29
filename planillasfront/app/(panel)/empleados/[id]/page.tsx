"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, apiUpload, apiBlobUrl } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { money, mesNombre, tipoPeriodoLabel } from "@/lib/format";
import { exportarKardexExcel, type HojaSimple } from "@/lib/kardexExcel";
import type {
  Empleado, BoletaLista, Periodo, Prestamo, Vacacion, Ausencia, EmpleadoMovimiento, Puesto,
  Formacion, FormacionCreate, TipoFormacion, EventoDesempeno, EventoDesempenoCreate, TipoDesempeno,
  Documento, TipoDocumento,
} from "@/lib/types";

type Tab = "boletas" | "prestamos" | "vacaciones" | "ausencias" | "traslados" | "perfil" | "desempeno" | "documentos";

const TIPOS_DOC: { value: TipoDocumento; label: string }[] = [
  { value: "FOTO", label: "Foto" }, { value: "DPI", label: "DPI" }, { value: "CONTRATO", label: "Contrato" },
  { value: "TITULO", label: "Título" }, { value: "CERTIFICADO", label: "Certificado" }, { value: "OTRO", label: "Otro" },
];
const labelTipoDoc = (t: string) => TIPOS_DOC.find((x) => x.value === t)?.label ?? t;
const CONTRATOS: Record<string, string> = {
  INDEFINIDO: "Indefinido", TEMPORAL: "Temporal", POR_TEMPORADA: "Por temporada", POR_OBRA: "Por obra",
};
const etiquetaContrato = (t?: string | null) => (t ? CONTRATOS[t] ?? t : "—");
const formatoBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const DIA = 86400000;
const HOY_ISO = new Date().toISOString().slice(0, 10);

const TIPOS_DESEMPENO: { value: TipoDesempeno; label: string; cls: string }[] = [
  { value: "FELICITACION", label: "Felicitación", cls: "bg-emerald-100 text-emerald-700" },
  { value: "EVALUACION", label: "Evaluación", cls: "bg-brand-100 text-brand-800" },
  { value: "PROMOCION", label: "Promoción", cls: "bg-indigo-100 text-indigo-700" },
  { value: "CAPACITACION", label: "Capacitación", cls: "bg-sky-100 text-sky-700" },
  { value: "AMONESTACION", label: "Amonestación", cls: "bg-red-100 text-red-700" },
];
const tipoDesempeno = (t: string) => TIPOS_DESEMPENO.find((x) => x.value === t) ?? { label: t, cls: "bg-slate-100 text-slate-600" };

const TIPOS_FORMACION: { value: TipoFormacion; label: string }[] = [
  { value: "IDIOMA", label: "Idioma" },
  { value: "TITULO", label: "Título" },
  { value: "CURSO", label: "Curso" },
  { value: "CERTIFICACION", label: "Certificación" },
  { value: "HABILIDAD", label: "Habilidad" },
];
const labelTipoFormacion = (t: string) => TIPOS_FORMACION.find((x) => x.value === t)?.label ?? t;

// Estado de un documento con vencimiento: vencido / por vencer (≤30 días) / vigente.
function vencEstado(fecha?: string | null): { txt: string; cls: string } | null {
  if (!fecha) return null;
  const dias = Math.floor((new Date(fecha).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { txt: "Vencido", cls: "bg-red-100 text-red-700" };
  if (dias <= 30) return { txt: `Vence en ${dias} d`, cls: "bg-amber-100 text-amber-700" };
  return { txt: "Vigente", cls: "bg-emerald-100 text-emerald-700" };
}

export default function ExpedientePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [emp, setEmp] = useState<Empleado | null>(null);
  const [puesto, setPuesto] = useState<string>("");
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);
  const [periodos, setPeriodos] = useState<Record<number, Periodo>>({});
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [movs, setMovs] = useState<EmpleadoMovimiento[]>([]);
  const [formaciones, setFormaciones] = useState<Formacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("boletas");
  const toast = useToast();
  const { usuario } = useAuth();
  const esRRHH = usuario?.rol === "ADMIN" || usuario?.rol === "RRHH";

  const [nuevaForm, setNuevaForm] = useState<FormacionCreate>({ empleadoId: id, tipo: "IDIOMA", descripcion: "", detalle: "", anio: null });
  const [agregando, setAgregando] = useState(false);

  // Documentos adjuntos + foto.
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>("DPI");
  const [subiendo, setSubiendo] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const cargarDocs = useCallback(async () => {
    try { setDocumentos(await api<Documento[]>(`/documentos?empleadoId=${id}`)); }
    catch { /* sin documentos */ }
  }, [id]);

  // Carga la foto más reciente (si hay) como object URL para el encabezado.
  useEffect(() => {
    const foto = documentos.filter((d) => d.tipo === "FOTO")[0];
    if (!foto) { setFotoUrl(null); return; }
    let url: string | null = null;
    apiBlobUrl(`/documentos/${foto.empleadoDocumentoId}/contenido`).then((u) => { url = u; setFotoUrl(u); }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [documentos]);

  async function subirDocumento(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("El archivo supera 10 MB."); return; }
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("empleadoId", String(id));
      fd.append("tipo", tipoDoc);
      fd.append("archivo", file);
      await apiUpload("/documentos", fd);
      await cargarDocs();
      toast.success("Documento subido.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo subir.");
    } finally {
      setSubiendo(false);
    }
  }

  async function verDocumento(doc: Documento) {
    try {
      const url = await apiBlobUrl(`/documentos/${doc.empleadoDocumentoId}/contenido`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo abrir.");
    }
  }

  async function borrarDocumento(docId: number) {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      await api(`/documentos/${docId}`, { method: "DELETE" });
      setDocumentos((ds) => ds.filter((d) => d.empleadoDocumentoId !== docId));
      toast.success("Documento eliminado.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar.");
    }
  }

  // Desempeño: dato sensible, solo se carga para RRHH/ADMIN.
  const [eventos, setEventos] = useState<EventoDesempeno[]>([]);
  const [nuevoEvento, setNuevoEvento] = useState<EventoDesempenoCreate>({ empleadoId: id, fecha: HOY_ISO, tipo: "FELICITACION", titulo: "", detalle: "" });
  const [agregandoEv, setAgregandoEv] = useState(false);

  useEffect(() => {
    if (!esRRHH) { setEventos([]); return; }
    api<EventoDesempeno[]>(`/desempeno?empleadoId=${id}`).then(setEventos).catch(() => setEventos([]));
  }, [esRRHH, id]);

  async function agregarEvento(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nuevoEvento.titulo.trim()) return;
    setAgregandoEv(true);
    try {
      await api("/desempeno", { method: "POST", body: { ...nuevoEvento, titulo: nuevoEvento.titulo.trim(), detalle: nuevoEvento.detalle?.trim() || null } });
      setNuevoEvento({ empleadoId: id, fecha: HOY_ISO, tipo: nuevoEvento.tipo, titulo: "", detalle: "" });
      setEventos(await api<EventoDesempeno[]>(`/desempeno?empleadoId=${id}`));
      toast.success("Evento registrado.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo registrar.");
    } finally {
      setAgregandoEv(false);
    }
  }

  async function borrarEvento(eid: number) {
    if (!confirm("¿Eliminar este registro de desempeño?")) return;
    try {
      await api(`/desempeno/${eid}`, { method: "DELETE" });
      setEventos((es) => es.filter((x) => x.eventoDesempenoId !== eid));
      toast.success("Eliminado.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar.");
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [e, bol, pers, pres, vac, aus, mv, pue, forms, docs] = await Promise.all([
        api<Empleado>(`/empleados/${id}`),
        api<BoletaLista[]>(`/boletas?empleadoId=${id}`),
        api<Periodo[]>("/periodospago"),
        api<Prestamo[]>(`/prestamos?empleadoId=${id}`),
        api<Vacacion[]>(`/vacaciones?empleadoId=${id}`),
        api<Ausencia[]>(`/ausencias?empleadoId=${id}`),
        api<EmpleadoMovimiento[]>(`/empleados/${id}/movimientos`),
        api<Puesto[]>("/puestos"),
        api<Formacion[]>(`/formaciones?empleadoId=${id}`),
        api<Documento[]>(`/documentos?empleadoId=${id}`),
      ]);
      setEmp(e);
      setBoletas(bol);
      setPeriodos(Object.fromEntries(pers.map((p) => [p.periodoPagoId, p])));
      setPrestamos(pres);
      setVacaciones(vac);
      setAusencias(aus);
      setMovs(mv);
      setFormaciones(forms);
      setDocumentos(docs);
      setPuesto(pue.find((p) => p.puestoId === e.puestoId)?.nombre ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el expediente.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregarFormacion(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nuevaForm.descripcion.trim()) return;
    setAgregando(true);
    try {
      await api("/formaciones", { method: "POST", body: { ...nuevaForm, descripcion: nuevaForm.descripcion.trim(), detalle: nuevaForm.detalle?.trim() || null, anio: nuevaForm.anio || null } });
      setNuevaForm({ empleadoId: id, tipo: nuevaForm.tipo, descripcion: "", detalle: "", anio: null });
      setFormaciones(await api<Formacion[]>(`/formaciones?empleadoId=${id}`));
      toast.success("Agregado al perfil.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo agregar.");
    } finally {
      setAgregando(false);
    }
  }

  async function borrarFormacion(fid: number) {
    try {
      await api(`/formaciones/${fid}`, { method: "DELETE" });
      setFormaciones((fs) => fs.filter((f) => f.empleadoFormacionId !== fid));
      toast.success("Eliminado del perfil.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar.");
    }
  }

  const totalLiquido = useMemo(() => boletas.reduce((s, b) => s + b.liquido, 0), [boletas]);
  const saldoPrestamos = useMemo(
    () => prestamos.filter((p) => p.estado === "ACTIVO").reduce((s, p) => s + p.saldo, 0), [prestamos]);
  const vacDisponibles = useMemo(() => {
    if (!emp?.fechaIngreso) return null;
    const anios = Math.max(0, (Date.now() - new Date(emp.fechaIngreso).getTime()) / DIA / 365);
    return Math.round((15 * anios - vacaciones.reduce((s, v) => s + v.dias, 0)) * 100) / 100;
  }, [emp, vacaciones]);

  async function exportarKardex() {
    if (!emp) return;
    const extras: HojaSimple[] = [
      { nombre: "Perfil", filas: formaciones.map((f) => ({ Tipo: labelTipoFormacion(f.tipo), Descripción: f.descripcion, Detalle: f.detalle ?? "", Año: f.anio ?? "" })) },
      { nombre: "Documentos", filas: documentos.map((d) => ({ Tipo: labelTipoDoc(d.tipo), Nombre: d.nombreOriginal, Tamaño: formatoBytes(d.tamanoBytes), Fecha: d.creadoEn.slice(0, 10) })) },
      { nombre: "Vacaciones", filas: vacaciones.map((v) => ({ Desde: v.fechaInicio, Hasta: v.fechaFin, Días: v.dias, Observación: v.observacion ?? "" })) },
      { nombre: "Ausencias", filas: ausencias.map((a) => ({ Tipo: a.tipo, Desde: a.fechaInicio, Hasta: a.fechaFin, Días: a.dias, Descontable: a.descontable ? "Sí" : "No" })) },
      { nombre: "Traslados", filas: movs.map((m) => ({
        Fecha: m.fecha,
        Cambio: [m.establecimientoNuevo && `Estab: ${m.establecimientoAnterior ?? "—"} → ${m.establecimientoNuevo}`,
          m.departamentoNuevo && `Depto: ${m.departamentoAnterior ?? "—"} → ${m.departamentoNuevo}`,
          m.puestoNuevo && `Puesto: ${m.puestoAnterior ?? "—"} → ${m.puestoNuevo}`,
          m.sueldoNuevo != null && `Sueldo: ${money(m.sueldoAnterior ?? 0)} → ${money(m.sueldoNuevo)}`].filter(Boolean).join(" · "),
        Motivo: m.motivo ?? "",
      })) },
    ];
    // El desempeño (sensible) solo se incluye si el usuario es RRHH/ADMIN.
    if (esRRHH) {
      extras.push({ nombre: "Desempeño", filas: eventos.map((ev) => ({ Tipo: tipoDesempeno(ev.tipo).label, Fecha: ev.fecha, Título: ev.titulo, Detalle: ev.detalle ?? "" })) });
    }
    try { await exportarKardexExcel(emp, puesto, extras); }
    catch { toast.error("No se pudo generar el Excel del kardex."); }
  }

  if (cargando) return <div className="card p-10 text-center text-slate-400">Cargando…</div>;
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!emp) return null;

  return (
    <div className="space-y-6">
      <Link href="/empleados" className="text-sm text-brand-700 hover:underline">← Colaboradores</Link>

      {/* Encabezado */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <Avatar url={fotoUrl} nombres={emp.nombres} apellidos={emp.apellidos} />
            <div>
            <h1 className="text-2xl font-bold text-slate-900">{emp.nombres} {emp.apellidos}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className={`badge ${emp.tipo === "PLANILLA" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-700"}`}>{emp.tipo}</span>
              <span className={`badge ${emp.activo ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>{emp.activo ? "Activo" : "Baja"}</span>
              <span>{emp.establecimientoNombre}</span>
              {puesto && <span>· {puesto}</span>}
            </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportarKardex} className="btn-ghost btn-sm">Kardex (Excel)</button>
            <a href={`/empleados/${emp.empleadoId}/kardex`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
              Kardex (PDF)
            </a>
            <a href={`/empleados/${emp.empleadoId}/constancia`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
              Constancia laboral
            </a>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <Dato k="NIT" v={emp.nit ?? "—"} />
          <Dato k="DPI" v={emp.dpi ?? "—"} />
          <Dato k="Departamento" v={emp.departamentoNombre ?? "—"} />
          <Dato k="Supervisor" v={emp.supervisorEfectivo ?? "—"} />
          <Dato k="Tipo de contrato" v={etiquetaContrato(emp.tipoContrato)} />
          <Dato k="Jornada" v={emp.jornada === "PARCIAL" ? "Parcial" : emp.jornada === "COMPLETA" ? "Completa" : "—"} />
          {emp.convenioColectivo && <Dato k="Convenio" v={emp.convenioColectivo} />}
          <Dato k="Sueldo base" v={money(emp.sueldoBase)} />
          {emp.tipo === "PLANILLA" && <Dato k="Quincena" v={money(emp.montoQuincena)} />}
          <Dato k="Ingreso" v={emp.fechaIngreso ?? "—"} />
          {emp.fechaBaja && <Dato k="Baja" v={emp.fechaBaja} />}
          {emp.banco && <Dato k="Banco" v={`${emp.banco}${emp.cuentaBanco ? ` · ${emp.cuentaBanco}` : ""}`} />}
        </div>
      </div>

      {/* Datos personales y de RRHH */}
      <div className="card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Datos personales y de RRHH</div>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <Dato k="Teléfono" v={emp.telefono ?? "—"} />
          <Dato k="Correo" v={emp.email ?? "—"} />
          <Dato k="Dirección" v={emp.direccion ?? "—"} />
          <Dato k="No. afiliación IGSS" v={emp.noAfiliacionIgss ?? "—"} />
          <Dato k="No. póliza seguro" v={emp.noPolizaSeguro ?? "—"} />
          <Dato k="Tipo de sangre" v={emp.tipoSangre ?? "—"} />
          <Dato
            k="Contacto emergencia"
            v={emp.contactoEmergenciaNombre
              ? `${emp.contactoEmergenciaNombre}${emp.contactoEmergenciaParentesco ? ` (${emp.contactoEmergenciaParentesco})` : ""}${emp.contactoEmergenciaTelefono ? ` · ${emp.contactoEmergenciaTelefono}` : ""}`
              : "—"}
          />
          <DatoVence k="Aptitud médica" fecha={emp.aptitudMedicaVence} />
          <DatoVence k="Carnet manipulador" fecha={emp.carnetManipuladorVence} />
          <Dato k="Alergias" v={emp.alergias ?? "—"} />
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tarjeta titulo="Líquido histórico" valor={money(totalLiquido)} sub={`${boletas.length} boletas`} />
        <Tarjeta titulo="Saldo de préstamos" valor={money(saldoPrestamos)} sub={`${prestamos.filter((p) => p.estado === "ACTIVO").length} activos`} />
        <Tarjeta titulo="Vacaciones disponibles" valor={vacDisponibles === null ? "—" : `${vacDisponibles} días`} destacado />
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        <TabBtn a={tab === "boletas"} on={() => setTab("boletas")}>Boletas</TabBtn>
        <TabBtn a={tab === "prestamos"} on={() => setTab("prestamos")}>Préstamos</TabBtn>
        <TabBtn a={tab === "vacaciones"} on={() => setTab("vacaciones")}>Vacaciones</TabBtn>
        <TabBtn a={tab === "ausencias"} on={() => setTab("ausencias")}>Ausencias</TabBtn>
        <TabBtn a={tab === "traslados"} on={() => setTab("traslados")}>Traslados</TabBtn>
        <TabBtn a={tab === "perfil"} on={() => setTab("perfil")}>Perfil</TabBtn>
        <TabBtn a={tab === "documentos"} on={() => setTab("documentos")}>Documentos</TabBtn>
        {esRRHH && <TabBtn a={tab === "desempeno"} on={() => setTab("desempeno")}>Desempeño 🔒</TabBtn>}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "boletas" && (
            <Tabla cols={["Período", "Tipo", "Ingresos", "Egresos", "Líquido", "Estado"]} vacio={boletas.length === 0}>
              {boletas.map((b) => {
                const p = periodos[b.periodoPagoId];
                return (
                  <tr key={b.boletaId} className="hover:bg-slate-50">
                    <td className="td">{p ? `${mesNombre(p.mes)} ${p.anio}` : "—"}</td>
                    <td className="td">{p ? tipoPeriodoLabel(p.tipo) : "—"}</td>
                    <td className="td text-right">{money(b.totalIngresos)}</td>
                    <td className="td text-right">{money(b.totalEgresos)}</td>
                    <td className="td text-right font-semibold">{money(b.liquido)}</td>
                    <td className="td"><span className="badge bg-slate-100 text-slate-600">{b.estado}</span></td>
                  </tr>
                );
              })}
            </Tabla>
          )}

          {tab === "prestamos" && (
            <Tabla cols={["Tipo", "Monto", "Saldo", "Estado", ""]} vacio={prestamos.length === 0}>
              {prestamos.map((p) => (
                <tr key={p.prestamoId} className="hover:bg-slate-50">
                  <td className="td">{p.tipo}</td>
                  <td className="td text-right">{money(p.montoOriginal)}</td>
                  <td className="td text-right font-semibold">{money(p.saldo)}</td>
                  <td className="td"><span className={`badge ${p.estado === "ACTIVO" ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>{p.estado}</span></td>
                  <td className="td text-right"><Link href={`/prestamos/${p.prestamoId}`} className="font-medium text-brand-700 hover:underline">Movimientos</Link></td>
                </tr>
              ))}
            </Tabla>
          )}

          {tab === "vacaciones" && (
            <Tabla cols={["Desde", "Hasta", "Días", "Observación"]} vacio={vacaciones.length === 0}>
              {vacaciones.map((v) => (
                <tr key={v.vacacionId} className="hover:bg-slate-50">
                  <td className="td">{v.fechaInicio}</td>
                  <td className="td">{v.fechaFin}</td>
                  <td className="td text-right font-semibold">{v.dias}</td>
                  <td className="td text-slate-600">{v.observacion ?? "—"}</td>
                </tr>
              ))}
            </Tabla>
          )}

          {tab === "ausencias" && (
            <Tabla cols={["Tipo", "Desde", "Hasta", "Días", "Descontable"]} vacio={ausencias.length === 0}>
              {ausencias.map((a) => (
                <tr key={a.ausenciaId} className="hover:bg-slate-50">
                  <td className="td">{a.tipo}</td>
                  <td className="td">{a.fechaInicio}</td>
                  <td className="td">{a.fechaFin}</td>
                  <td className="td text-right font-semibold">{a.dias}</td>
                  <td className="td">{a.descontable ? "Sí" : "No"}</td>
                </tr>
              ))}
            </Tabla>
          )}

          {tab === "traslados" && (
            <Tabla cols={["Fecha", "Cambio", "Motivo"]} vacio={movs.length === 0}>
              {movs.map((m) => (
                <tr key={m.empleadoMovimientoId} className="hover:bg-slate-50 align-top">
                  <td className="td">{m.fecha}</td>
                  <td className="td text-xs text-slate-600">
                    {m.establecimientoNuevo && <div>Establecimiento: {m.establecimientoAnterior ?? "—"} → <b>{m.establecimientoNuevo}</b></div>}
                    {m.departamentoNuevo && <div>Departamento: {m.departamentoAnterior ?? "—"} → <b>{m.departamentoNuevo}</b></div>}
                    {m.puestoNuevo && <div>Puesto: {m.puestoAnterior ?? "—"} → <b>{m.puestoNuevo}</b></div>}
                    {m.sueldoNuevo != null && <div>Sueldo: {money(m.sueldoAnterior ?? 0)} → <b>{money(m.sueldoNuevo)}</b></div>}
                  </td>
                  <td className="td text-slate-600">{m.motivo ?? "—"}</td>
                </tr>
              ))}
            </Tabla>
          )}

          {tab === "perfil" && (
            <div className="p-5">
              <form onSubmit={agregarFormacion} className="mb-5 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="label">Tipo</span>
                  <select className="input w-40" value={nuevaForm.tipo}
                    onChange={(e) => setNuevaForm({ ...nuevaForm, tipo: e.target.value as TipoFormacion })}>
                    {TIPOS_FORMACION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="block flex-1 min-w-48">
                  <span className="label">Descripción</span>
                  <input className="input" placeholder="ej. Inglés / Lic. Administración"
                    value={nuevaForm.descripcion} onChange={(e) => setNuevaForm({ ...nuevaForm, descripcion: e.target.value })} />
                </label>
                <label className="block flex-1 min-w-40">
                  <span className="label">Detalle</span>
                  <input className="input" placeholder="ej. Avanzado / institución"
                    value={nuevaForm.detalle ?? ""} onChange={(e) => setNuevaForm({ ...nuevaForm, detalle: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">Año</span>
                  <input type="number" className="input w-24" value={nuevaForm.anio ?? ""}
                    onChange={(e) => setNuevaForm({ ...nuevaForm, anio: Number(e.target.value) || null })} />
                </label>
                <button type="submit" disabled={agregando} className="btn-primary">{agregando ? "…" : "Agregar"}</button>
              </form>

              {formaciones.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin idiomas, títulos ni certificaciones registrados.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {formaciones.map((f) => (
                    <li key={f.empleadoFormacionId} className="flex items-center gap-3 py-2.5">
                      <span className="badge bg-brand-50 text-brand-700">{labelTipoFormacion(f.tipo)}</span>
                      <span className="flex-1 text-sm">
                        <span className="font-medium text-slate-800">{f.descripcion}</span>
                        {f.detalle && <span className="text-slate-500"> · {f.detalle}</span>}
                        {f.anio && <span className="text-slate-400"> · {f.anio}</span>}
                      </span>
                      <button onClick={() => borrarFormacion(f.empleadoFormacionId)}
                        className="text-sm font-medium text-red-600 hover:underline">Quitar</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "documentos" && (
            <div className="p-5">
              <div className="mb-5 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="label">Tipo</span>
                  <select className="input w-44" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as TipoDocumento)}>
                    {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="btn-primary cursor-pointer">
                  {subiendo ? "Subiendo…" : "Subir archivo"}
                  <input type="file" className="hidden" disabled={subiendo}
                    accept="image/*,application/pdf,.doc,.docx" onChange={subirDocumento} />
                </label>
                <span className="text-xs text-slate-400">Imagen, PDF o Word · máx 10 MB</span>
              </div>

              {documentos.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin documentos adjuntos.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {documentos.map((d) => (
                    <li key={d.empleadoDocumentoId} className="flex items-center gap-3 py-2.5">
                      <span className="badge bg-slate-100 text-slate-600">{labelTipoDoc(d.tipo)}</span>
                      <span className="flex-1 text-sm">
                        <span className="font-medium text-slate-800">{d.nombreOriginal}</span>
                        <span className="text-slate-400"> · {formatoBytes(d.tamanoBytes)} · {d.creadoEn.slice(0, 10)}</span>
                      </span>
                      <button onClick={() => verDocumento(d)} className="text-sm font-medium text-brand-700 hover:underline">Ver</button>
                      <button onClick={() => borrarDocumento(d.empleadoDocumentoId)} className="text-sm font-medium text-red-600 hover:underline">Quitar</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "desempeno" && esRRHH && (
            <div className="p-5">
              <p className="mb-4 text-xs text-amber-600">
                🔒 Información confidencial de RRHH. Visible solo para Recursos Humanos y administradores.
              </p>
              <form onSubmit={agregarEvento} className="mb-5 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="label">Tipo</span>
                  <select className="input w-40" value={nuevoEvento.tipo}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, tipo: e.target.value as TipoDesempeno })}>
                    {TIPOS_DESEMPENO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Fecha</span>
                  <input type="date" className="input" value={nuevoEvento.fecha}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, fecha: e.target.value })} />
                </label>
                <label className="block flex-1 min-w-48">
                  <span className="label">Título</span>
                  <input className="input" placeholder="ej. Reconocimiento al servicio"
                    value={nuevoEvento.titulo} onChange={(e) => setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })} />
                </label>
                <label className="block flex-1 min-w-48">
                  <span className="label">Detalle</span>
                  <input className="input" placeholder="Descripción / motivo"
                    value={nuevoEvento.detalle ?? ""} onChange={(e) => setNuevoEvento({ ...nuevoEvento, detalle: e.target.value })} />
                </label>
                <button type="submit" disabled={agregandoEv} className="btn-primary">{agregandoEv ? "…" : "Registrar"}</button>
              </form>

              {eventos.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin registros de desempeño.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {eventos.map((ev) => {
                    const t = tipoDesempeno(ev.tipo);
                    return (
                      <li key={ev.eventoDesempenoId} className="flex items-start gap-3 py-2.5">
                        <span className={`badge ${t.cls} mt-0.5`}>{t.label}</span>
                        <span className="flex-1 text-sm">
                          <span className="font-medium text-slate-800">{ev.titulo}</span>
                          <span className="text-slate-400"> · {ev.fecha}</span>
                          {ev.detalle && <span className="block text-slate-500">{ev.detalle}</span>}
                        </span>
                        <button onClick={() => borrarEvento(ev.eventoDesempenoId)}
                          className="text-sm font-medium text-red-600 hover:underline">Quitar</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ url, nombres, apellidos }: { url: string | null; nombres: string; apellidos: string }) {
  const iniciales = `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`${nombres} ${apellidos}`} className="h-16 w-16 flex-none rounded-full object-cover ring-2 ring-slate-100" />;
  }
  return (
    <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 ring-2 ring-slate-100">
      {iniciales}
    </div>
  );
}
function Dato({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><span className="font-semibold text-slate-500">{k}:</span><span className="text-slate-800">{v}</span></div>;
}
function DatoVence({ k, fecha }: { k: string; fecha?: string | null }) {
  const est = vencEstado(fecha);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-slate-500">{k}:</span>
      <span className="text-slate-800">{fecha ?? "—"}</span>
      {est && <span className={`badge ${est.cls}`}>{est.txt}</span>}
    </div>
  );
}
function Tarjeta({ titulo, valor, sub, destacado }: { titulo: string; valor: string; sub?: string; destacado?: boolean }) {
  return (
    <div className={`card p-5 ${destacado ? "border-brand-200 bg-brand-50" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className={`mt-1 text-2xl font-bold ${destacado ? "text-brand-800" : "text-slate-900"}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
function TabBtn({ a, on, children }: { a: boolean; on: () => void; children: React.ReactNode }) {
  return (
    <button onClick={on} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${a ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}
function Tabla({ cols, vacio, children }: { cols: string[]; vacio: boolean; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead className="border-b border-slate-200 bg-slate-50">
        <tr>{cols.map((c, i) => <th key={i} className={`th ${c === "Ingresos" || c === "Egresos" || c === "Líquido" || c === "Monto" || c === "Saldo" || c === "Días" ? "text-right" : ""}`}>{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {vacio ? <tr><td colSpan={cols.length} className="td py-8 text-center text-slate-400">Sin registros.</td></tr> : children}
      </tbody>
    </table>
  );
}
