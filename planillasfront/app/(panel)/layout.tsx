"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { IconHome, IconUsers, IconCalendar, IconChart, IconLogout, IconShield } from "@/components/icons";

const NAV = [
  { href: "/", label: "Inicio", icon: IconHome },
  { href: "/empleados", label: "Empleados", icon: IconUsers },
  { href: "/periodos", label: "Períodos y boletas", icon: IconCalendar },
  { href: "/reportes", label: "Reportes", icon: IconChart },
  { href: "/usuarios", label: "Usuarios", icon: IconShield, soloAdmin: true },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { usuario, cargando, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!cargando && !usuario) router.replace("/login");
  }, [cargando, usuario, router]);

  if (cargando || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Cargando…
      </div>
    );
  }

  const activo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-slate-300 md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            C
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-white">Corporación Petenera de Turismo</div>
            <div className="text-xs text-slate-400">Petén, Guatemala</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.filter((n) => !n.soloAdmin || usuario.rol === "ADMIN").map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activo(href)
                  ? "bg-brand-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mx-3 mb-3 rounded-xl bg-slate-800 p-3">
          <div className="text-sm font-semibold text-white">¿Necesitas ayuda?</div>
          <p className="mt-1 text-xs text-slate-400">Escríbele al equipo de Recursos Humanos.</p>
        </div>

        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 px-3 py-1 text-xs text-slate-400">
            <div className="font-medium text-slate-200">{usuario.nombre}</div>
            <div>{usuario.rol}</div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <IconLogout className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar móvil */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-bold text-slate-900">CORPETUR · Nómina</span>
          <button onClick={logout} className="text-sm font-medium text-slate-600">Salir</button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
