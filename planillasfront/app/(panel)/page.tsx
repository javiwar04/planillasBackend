"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, mesNombre } from "@/lib/format";
import {
  IconBuilding, IconUsers, IconWallet, IconPercent, IconCash,
  IconCalendar, IconChart, IconReceipt,
} from "@/components/icons";
import type { Establecimiento, Empleado, Periodo, BoletaLista } from "@/lib/types";

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSel, setPeriodoSel] = useState<number>(0);
  const [boletas, setBoletas] = useState<BoletaLista[]>([]);

  useEffect(() => {
    Promise.all([
      api<Establecimiento[]>("/establecimientos"),
      api<Empleado[]>("/empleados?soloActivos=true"),
      api<Periodo[]>("/periodospago"),
    ]).then(([est, emp, per]) => {
      setEstablecimientos(est);
      setEmpleados(emp);
      setPeriodos(per);
      if (per.length) setPeriodoSel(per[0].periodoPagoId); // el más reciente (API ordena desc)
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!periodoSel) { setBoletas([]); return; }
    api<BoletaLista[]>(`/boletas?periodoId=${periodoSel}`).then(setBoletas).catch(() => setBoletas([]));
  }, [periodoSel]);

  const totales = useMemo(() => ({
    bruta: boletas.reduce((s, b) => s + b.totalIngresos, 0),
    descuentos: boletas.reduce((s, b) => s + b.totalEgresos, 0),
    neto: boletas.reduce((s, b) => s + b.liquido, 0),
  }), [boletas]);

  // Colaboradores por unidad corporativa.
  const porUnidad = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of empleados) {
      const k = e.establecimientoNombre ?? "—";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [empleados]);

  const periodoActual = periodos.find((p) => p.periodoPagoId === periodoSel);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hola, {usuario?.nombre} 👋</h1>
          <p className="text-sm text-slate-500">Panel de nómina · Corporación Petenera de Turismo</p>
        </div>
        <label className="block">
          <span className="label">Período</span>
          <select className="input min-w-52" value={periodoSel} onChange={(e) => setPeriodoSel(Number(e.target.value))}>
            {periodos.length === 0 && <option value={0}>Sin períodos</option>}
            {periodos.map((p) => (
              <option key={p.periodoPagoId} value={p.periodoPagoId}>
                {mesNombre(p.mes)} {p.anio} · {p.tipo === "QUINCENA" ? "Quincena" : "Fin de mes"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={<IconBuilding />} tono="azul" valor={String(establecimientos.length)} titulo="Establecimientos" sub="Unidades corporativas" />
        <Stat icon={<IconUsers />} tono="verde" valor={String(empleados.length)} titulo="Colaboradores" sub="Activos en planilla" />
        <Stat icon={<IconWallet />} tono="azul" valor={money(totales.bruta)} titulo="Planilla bruta" sub="Total ingresos del período" />
        <Stat icon={<IconPercent />} tono="ambar" valor={money(totales.descuentos)} titulo="Descuentos" sub="Total egresos del período" />
        <Stat icon={<IconCash />} tono="verde" valor={money(totales.neto)} titulo="Neto a pagar" sub="Líquido del período" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Unidades corporativas */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Colaboradores por unidad</h2>
            <Link href="/empleados" className="text-sm font-medium text-brand-700 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {porUnidad.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Aún no hay colaboradores.</p>
            ) : porUnidad.map(([nombre, n]) => (
              <div key={nombre} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <IconBuilding className="h-5 w-5" />
                </span>
                <span className="flex-1 text-sm font-medium text-slate-700">{nombre}</span>
                <span className="badge bg-slate-100 text-slate-700">{n}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <span className="text-sm font-semibold text-slate-700">Total colaboradores</span>
            <span className="text-sm font-bold text-slate-900">{empleados.length}</span>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Acciones rápidas</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <Accion href="/periodos" icon={<IconCalendar />} titulo="Generar planilla"
              desc={periodoActual ? `${mesNombre(periodoActual.mes)} ${periodoActual.anio}` : "Crear un período"} />
            <Accion href={periodoSel ? `/periodos/${periodoSel}` : "/periodos"} icon={<IconReceipt />}
              titulo="Ver boletas del período" desc={`${boletas.length} boletas`} />
            <Accion href="/empleados" icon={<IconUsers />} titulo="Colaboradores" desc="Alta y edición" />
            <Accion href="/reportes" icon={<IconChart />} titulo="Reportes" desc="Histórico y pasivo laboral" />
          </div>
        </div>
      </div>
    </div>
  );
}

const tonos: Record<string, string> = {
  azul: "bg-blue-50 text-blue-600",
  verde: "bg-brand-50 text-brand-600",
  ambar: "bg-amber-50 text-amber-600",
};

function Stat({ icon, valor, titulo, sub, tono }: {
  icon: React.ReactNode; valor: string; titulo: string; sub: string; tono: string;
}) {
  return (
    <div className="card p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tonos[tono]}`}>{icon}</div>
      <div className="text-xl font-bold text-slate-900">{valor}</div>
      <div className="text-sm font-medium text-slate-700">{titulo}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function Accion({ href, icon, titulo, desc }: {
  href: string; icon: React.ReactNode; titulo: string; desc: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-800">{titulo}</span>
        <span className="block text-xs text-slate-400">{desc}</span>
      </span>
      <span className="text-slate-300">→</span>
    </Link>
  );
}
