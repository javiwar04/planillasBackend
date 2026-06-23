"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { Empleado } from "@/lib/types";

const hoyISO = new Date().toISOString().slice(0, 10);
const DIA = 86400000;

// Inicio del ciclo (mes 1-12) inmediatamente anterior o igual a la fecha de baja.
function inicioCiclo(baja: Date, mesInicio: number): Date {
  const y = baja.getMonth() + 1 >= mesInicio ? baja.getFullYear() : baja.getFullYear() - 1;
  return new Date(y, mesInicio - 1, 1);
}
function ultimoAniversario(ingreso: Date, baja: Date): Date {
  const a = new Date(baja.getFullYear(), ingreso.getMonth(), ingreso.getDate());
  return a > baja ? new Date(baja.getFullYear() - 1, ingreso.getMonth(), ingreso.getDate()) : a;
}
const dias = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DIA));

export default function LiquidacionPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [ingreso, setIngreso] = useState("");
  const [baja, setBaja] = useState(hoyISO);
  const [salarioBase, setSalarioBase] = useState(0);
  const [salarioProm, setSalarioProm] = useState(0);
  const [diasVac, setDiasVac] = useState("");
  const [otros, setOtros] = useState("0");
  const [descuentos, setDescuentos] = useState("0");
  const [vacOverride, setVacOverride] = useState(false);

  useEffect(() => {
    api<Empleado[]>("/empleados?soloActivos=false").then(setEmpleados).catch(() => {});
  }, []);

  function elegir(id: number) {
    setEmpleadoId(id);
    const e = empleados.find((x) => x.empleadoId === id);
    if (!e) return;
    setIngreso(e.fechaIngreso ?? "");
    setBaja(e.fechaBaja ?? hoyISO);
    setSalarioBase(e.sueldoBase);
    setSalarioProm(e.sueldoBase);
    setVacOverride(false);
    setOtros("0");
    setDescuentos("0");
  }

  const calc = useMemo(() => {
    if (!ingreso || !baja) return null;
    const di = new Date(ingreso), db = new Date(baja);
    if (isNaN(di.getTime()) || isNaN(db.getTime()) || db <= di) return null;

    const diasServicio = dias(di, db);
    const aniosServicio = diasServicio / 365;

    const indemnizacion = salarioProm * aniosServicio;

    const iniAgui = Math.max(inicioCiclo(db, 12).getTime(), di.getTime());
    const aguinaldo = salarioBase * (dias(new Date(iniAgui), db) / 365);

    const iniBono = Math.max(inicioCiclo(db, 7).getTime(), di.getTime());
    const bono14 = salarioBase * (dias(new Date(iniBono), db) / 365);

    const iniVac = Math.max(ultimoAniversario(di, db).getTime(), di.getTime());
    const diasVacCalc = 15 * (dias(new Date(iniVac), db) / 365);
    const diasVacFinal = vacOverride && diasVac !== "" ? Number(diasVac) : diasVacCalc;
    const vacaciones = (salarioBase / 30) * diasVacFinal;

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const subtotal = indemnizacion + aguinaldo + bono14 + vacaciones + Number(otros || 0);
    const total = subtotal - Number(descuentos || 0);

    return {
      diasServicio, aniosServicio,
      indemnizacion: r2(indemnizacion), aguinaldo: r2(aguinaldo), bono14: r2(bono14),
      diasVacFinal: Math.round(diasVacFinal * 100) / 100, vacaciones: r2(vacaciones),
      otros: r2(Number(otros || 0)), descuentos: r2(Number(descuentos || 0)), total: r2(total),
    };
  }, [ingreso, baja, salarioBase, salarioProm, diasVac, vacOverride, otros, descuentos]);

  function imprimir() {
    const e = empleados.find((x) => x.empleadoId === empleadoId);
    if (!e || !calc) return;
    const data = {
      empleado: `${e.nombres} ${e.apellidos}`, nit: e.nit ?? "", establecimiento: e.establecimientoNombre ?? "",
      ingreso, baja, salarioBase, salarioProm, ...calc,
    };
    sessionStorage.setItem("finiquito", JSON.stringify(data));
    window.open("/finiquito", "_blank");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Liquidación / finiquito</h1>
        <p className="text-sm text-slate-500">Cálculo de prestaciones al finalizar la relación laboral.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card p-5">
        <label className="block max-w-md">
          <span className="label">Colaborador</span>
          <select className="input" value={empleadoId} onChange={(e) => elegir(Number(e.target.value))}>
            <option value={0}>Seleccione…</option>
            {empleados.map((e) => (
              <option key={e.empleadoId} value={e.empleadoId}>
                {e.apellidos}, {e.nombres}{!e.activo ? " (baja)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {empleadoId > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Datos */}
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold text-slate-900">Datos del cálculo</h2>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha de ingreso"><input type="date" className="input" value={ingreso} onChange={(e) => setIngreso(e.target.value)} /></Campo>
              <Campo label="Fecha de baja"><input type="date" className="input" value={baja} onChange={(e) => setBaja(e.target.value)} /></Campo>
              <Campo label="Salario base mensual"><input type="number" step="0.01" className="input" value={salarioBase} onChange={(e) => setSalarioBase(Number(e.target.value))} /></Campo>
              <Campo label="Salario promedio (indemniz.)"><input type="number" step="0.01" className="input" value={salarioProm} onChange={(e) => setSalarioProm(Number(e.target.value))} /></Campo>
              <Campo label="Otros pendientes (comisión…)"><input type="number" step="0.01" className="input" value={otros} onChange={(e) => setOtros(e.target.value)} /></Campo>
              <Campo label="Descuentos (préstamos…)"><input type="number" step="0.01" className="input" value={descuentos} onChange={(e) => setDescuentos(e.target.value)} /></Campo>
            </div>
            <label className="flex items-center gap-2 pt-1">
              <input type="checkbox" checked={vacOverride} onChange={(e) => setVacOverride(e.target.checked)} />
              <span className="text-sm text-slate-700">Ajustar días de vacaciones pendientes a mano</span>
            </label>
            {vacOverride && (
              <Campo label="Días de vacaciones pendientes">
                <input type="number" step="0.01" className="input max-w-[12rem]" value={diasVac} onChange={(e) => setDiasVac(e.target.value)} />
              </Campo>
            )}
            <p className="text-xs text-amber-600">
              Cálculo estándar (indemnización 1 mes/año, aguinaldo y bono 14 proporcionales,
              vacaciones 15 días/año). Validar con el contador antes de pagar.
            </p>
          </div>

          {/* Resultado */}
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Finiquito</h2>
            {!calc ? (
              <p className="text-sm text-slate-400">Revisa las fechas (la baja debe ser posterior al ingreso).</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-500">
                  Tiempo de servicio: <b>{(calc.aniosServicio).toFixed(2)} años</b> ({calc.diasServicio} días)
                </p>
                <Linea label="Indemnización" valor={calc.indemnizacion} />
                <Linea label="Aguinaldo proporcional" valor={calc.aguinaldo} />
                <Linea label="Bono 14 proporcional" valor={calc.bono14} />
                <Linea label={`Vacaciones (${calc.diasVacFinal} días)`} valor={calc.vacaciones} />
                {calc.otros > 0 && <Linea label="Otros pendientes" valor={calc.otros} />}
                {calc.descuentos > 0 && <Linea label="(−) Descuentos" valor={-calc.descuentos} />}
                <div className="mt-3 flex items-center justify-between border-t-2 border-slate-200 pt-3">
                  <span className="font-bold text-slate-900">Total a pagar</span>
                  <span className="text-xl font-bold text-brand-700">{money(calc.total)}</span>
                </div>
                <button onClick={imprimir} className="btn-primary mt-4 w-full">Imprimir finiquito</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function Linea({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-800">{money(valor)}</span>
    </div>
  );
}
