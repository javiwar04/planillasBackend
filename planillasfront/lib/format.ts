export const money = (n: number) =>
  (n ?? 0).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });

export const MESES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const mesNombre = (m: number) => MESES[m] ?? String(m);

export const tipoPeriodoLabel = (t: string) =>
  t === "QUINCENA" ? "Quincena" : t === "FIN_MES" ? "Fin de mes" : t === "EXTRA" ? "Pago especial" : t;
