"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const { login, usuario, cargando } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!cargando && usuario) router.replace("/");
  }, [cargando, usuario, router]);

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
      <div className="relative hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-2">
            <Logo className="h-full w-full text-brand-700" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold">Hoteles de Petén</div>
            <div className="text-xs text-slate-400">Corporación Petenera de Turismo</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Sistema de Nómina
          </h2>
          <p className="mt-3 max-w-sm text-slate-400">
            Planillas, boletas y pasivo laboral de la Corporación Petenera de Turismo,
            en un solo lugar.
          </p>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} CORPETUR, S.A.</p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
              <Logo className="h-full w-full text-brand-700" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Hoteles de Petén</h1>
          </div>

          <h1 className="mb-1 text-2xl font-bold text-slate-900">Bienvenido</h1>
          <p className="mb-6 text-sm text-slate-500">Ingresa con tu cuenta para continuar.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Correo</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@corpetur.local"
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button type="submit" disabled={enviando} className="btn-primary w-full">
              {enviando ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
