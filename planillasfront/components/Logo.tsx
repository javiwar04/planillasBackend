// Monograma "HP" de Hoteles de Petén, recreado como SVG (hereda el color con currentColor).
import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 120" fill="currentColor" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="Hoteles de Petén" {...props}>
      {/* H: dos cuadros y la barra central */}
      <rect x="20" y="20" width="32" height="32" />
      <rect x="20" y="68" width="32" height="32" />
      <rect x="20" y="52" width="46" height="16" />
      {/* P: tallo y bowl redondeado */}
      <rect x="66" y="20" width="16" height="80" />
      <path d="M82 20 a30 30 0 0 1 0 60 H66 V20 Z" />
    </svg>
  );
}
