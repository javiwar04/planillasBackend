"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Logo } from "@/components/Logo";
import {
  IconUsers, IconReceipt, IconChart, IconShield,
  IconMail, IconLock, IconEye, IconEyeOff, IconUserCircle, IconUserPlus,
} from "@/components/icons";

const FEATURES = [
  { icon: IconUsers, titulo: "Planillas", desc: "Cálculo preciso y automatizado." },
  { icon: IconReceipt, titulo: "Boletas", desc: "Emisión y consulta de boletas." },
  { icon: IconChart, titulo: "Reportes", desc: "Información clara para decisiones." },
  { icon: IconShield, titulo: "Seguridad", desc: "Datos protegidos con altos estándares." },
];

export default function LoginPage() {
  const { login, usuario, cargando } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!cargando && usuario) router.replace("/");
  }, [cargando, usuario, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("corpetur_sesion_expirada")) {
      setError("Tu sesión expiró. Ingresa de nuevo.");
      sessionStorage.removeItem("corpetur_sesion_expirada");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-2">
            <Logo className="h-full w-full text-brand-700" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold">Hoteles de Petén</div>
            <div className="text-sm text-slate-400">Corporación Petenera de Turismo</div>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-bold leading-tight">Sistema de Nómina</h2>
          <div className="mt-3 h-1 w-16 rounded bg-brand-500" />
          <p className="mt-5 max-w-md text-slate-300">
            Administra planillas, boletas, empleados y pasivo laboral de tu organización en un solo lugar.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, titulo, desc }) => (
              <div key={titulo} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <Icon className="mb-2 h-6 w-6 text-brand-400" />
                <div className="text-sm font-semibold text-white">{titulo}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <IconShield className="h-4 w-4" />
          <span>Plataforma segura y confiable para la gestión de tu capital humano. · © {new Date().getFullYear()} CORPETUR, S.A.</span>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 lg:hidden">
              <Logo className="h-9 w-9 text-brand-700" />
            </div>
            <div className="mb-3 hidden h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 lg:flex">
              <IconUserCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Bienvenido de nuevo</h1>
            <p className="text-sm text-slate-500">Ingresa con tu cuenta para continuar.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Correo</label>
              <div className="relative">
                <IconMail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10" placeholder="admin@corpetur.local" />
              </div>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <IconLock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input type={verPass ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input px-10" placeholder="••••••••" />
                <button type="button" onClick={() => setVerPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {verPass ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
                Recordarme
              </label>
              <button type="button" onClick={() => setError("Pídele a un administrador que restablezca tu contraseña.")}
                className="font-medium text-brand-700 hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={enviando} className="btn-primary w-full">
              {enviando ? "Ingresando…" : "Ingresar →"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />o<span className="h-px flex-1 bg-slate-200" />
          </div>

          <button type="button"
            onClick={() => setError("Para una cuenta nueva, contacta al administrador del sistema.")}
            className="btn-ghost w-full">
            <IconUserPlus className="h-4 w-4" /> Solicitar acceso
          </button>
        </div>
      </div>
    </main>
  );
}
