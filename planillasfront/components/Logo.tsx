// Logo oficial de Hoteles de Petén (archivo en /public).
import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/hotelesdepetenlogo.png"
      alt="Hoteles de Petén"
      width={200}
      height={200}
      priority
      className={`object-contain ${className ?? ""}`}
    />
  );
}
