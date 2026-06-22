"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type Tipo = "success" | "error" | "info";
interface Toast { id: number; tipo: Tipo; msg: string }

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const estilos: Record<Tipo, string> = {
  success: "border-brand-200 bg-brand-50 text-brand-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-slate-200 bg-white text-slate-700",
};
const iconos: Record<Tipo, string> = { success: "✓", error: "✕", info: "i" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tipo: Tipo, msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-md ${estilos[t.tipo]}`}>
            <span className="mt-0.5 font-bold">{iconos[t.tipo]}</span>
            <span className="flex-1">{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return c;
}
