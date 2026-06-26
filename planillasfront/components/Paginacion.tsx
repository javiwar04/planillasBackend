"use client";

import { useEffect, useState } from "react";

// Hook de paginación en memoria. Resetea a la página 1 cuando cambia el total
// (p. ej. al filtrar/buscar). Por defecto 15 por página.
export function usePaginado<T>(items: T[], size = 15) {
  const [pagina, setPagina] = useState(1);
  useEffect(() => { setPagina(1); }, [items.length]);
  const totalPaginas = Math.max(1, Math.ceil(items.length / size));
  const actual = Math.min(pagina, totalPaginas);
  const visibles = items.slice((actual - 1) * size, actual * size);
  return { pagina: actual, setPagina, totalPaginas, visibles, total: items.length, size };
}

export function Paginacion({ pagina, setPagina, totalPaginas, total, size }: {
  pagina: number; setPagina: (n: number) => void; totalPaginas: number; total: number; size: number;
}) {
  if (total <= size) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
      <span className="text-slate-500">
        {(pagina - 1) * size + 1}–{Math.min(pagina * size, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost btn-sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span className="px-2 text-slate-600">{pagina} / {totalPaginas}</span>
        <button className="btn-ghost btn-sm" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </div>
    </div>
  );
}
