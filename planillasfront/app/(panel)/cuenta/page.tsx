"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export default function CuentaPage() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (nueva !== confirma) { setError("La confirmación no coincide."); return; }
    setGuardando(true);
    try {
      await api("/auth/cambiar-password", { method: "POST", body: { passwordActual: actual, passwordNueva: nueva } });
      toast.success("Contraseña actualizada.");
      setActual(""); setNueva(""); setConfirma("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi cuenta</h1>
        <p className="text-sm text-slate-500">Datos de tu sesión y contraseña.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Perfil</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Nombre</dt><dd className="font-medium text-slate-800">{usuario?.nombre}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Correo</dt><dd className="font-medium text-slate-800">{usuario?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Rol</dt><dd><span className="badge bg-slate-100 text-slate-700">{usuario?.rol}</span></dd></div>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Cambiar contraseña</h2>
          <form onSubmit={cambiar} className="space-y-3">
            <label className="block">
              <span className="label">Contraseña actual</span>
              <input type="password" className="input" required value={actual} onChange={(e) => setActual(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Nueva contraseña</span>
              <input type="password" className="input" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="mínimo 8 caracteres" />
            </label>
            <label className="block">
              <span className="label">Confirmar nueva contraseña</span>
              <input type="password" className="input" required value={confirma} onChange={(e) => setConfirma(e.target.value)} />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={guardando} className="btn-primary">{guardando ? "Guardando…" : "Cambiar contraseña"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
