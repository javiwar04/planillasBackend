"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  IconHome, IconUsers, IconCalendar, IconChart, IconLogout, IconShield,
  IconBuilding, IconLayers, IconBriefcase, IconTag, IconSliders, IconCash, IconMetric, IconChevron, IconReceipt, IconSun,
} from "@/components/icons";
import { Logo } from "@/components/Logo";

type Item = { href: string; label: string; icon: (p: { className?: string }) => React.ReactNode; soloAdmin?: boolean };
type Grupo = { titulo?: string; items: Item[] };

const GRUPOS: Grupo[] = [
  { items: [{ href: "/", label: "Inicio", icon: IconHome }] },
  {
    titulo: "Nómina",
    items: [
      { href: "/empleados", label: "Colaboradores", icon: IconUsers },
      { href: "/periodos", label: "Períodos y boletas", icon: IconCalendar },
      { href: "/prestamos", label: "Préstamos", icon: IconCash },
      { href: "/vacaciones", label: "Vacaciones", icon: IconSun },
      { href: "/liquidacion", label: "Liquidación", icon: IconReceipt },
      { href: "/reportes", label: "Reportes", icon: IconChart },
    ],
  },
  {
    titulo: "Catálogos",
    items: [
      { href: "/establecimientos", label: "Establecimientos", icon: IconBuilding },
      { href: "/departamentos", label: "Departamentos", icon: IconLayers },
      { href: "/puestos", label: "Puestos", icon: IconBriefcase },
      { href: "/conceptos", label: "Conceptos", icon: IconTag },
    ],
  },
  {
    titulo: "Configuración",
    items: [
      { href: "/parametros", label: "Parámetros de nómina", icon: IconSliders },
      { href: "/reglas", label: "Reglas de bonificación", icon: IconSliders },
      { href: "/metricas", label: "Métricas diarias", icon: IconMetric },
      { href: "/usuarios", label: "Usuarios", icon: IconShield, soloAdmin: true },
    ],
  },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { usuario, cargando, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [colapsados, setColapsados] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!cargando && !usuario) router.replace("/login");
  }, [cargando, usuario, router]);

  if (cargando || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Cargando…</div>
    );
  }

  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const toggle = (t: string) => setColapsados((c) => ({ ...c, [t]: !c[t] }));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-slate-300 md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
            <Logo className="h-full w-full text-brand-700" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-white">Corporación Petenera de Turismo</div>
            <div className="text-xs text-slate-400">Petén, Guatemala</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {GRUPOS.map((grupo, gi) => {
            const items = grupo.items.filter((n) => !n.soloAdmin || usuario.rol === "ADMIN");
            if (items.length === 0) return null;
            const cerrado = grupo.titulo ? colapsados[grupo.titulo] : false;
            return (
              <div key={gi} className="mb-2">
                {grupo.titulo && (
                  <button onClick={() => toggle(grupo.titulo!)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300">
                    {grupo.titulo}
                    <IconChevron className={`h-4 w-4 transition ${cerrado ? "-rotate-90" : ""}`} />
                  </button>
                )}
                {!cerrado && (
                  <div className="space-y-1">
                    {items.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          activo(href) ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}>
                        <Icon className="h-5 w-5" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white">
            <IconLogout className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-bold text-slate-900">Hoteles de Petén · Nómina</span>
          <button onClick={logout} className="text-sm font-medium text-slate-600">Salir</button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
