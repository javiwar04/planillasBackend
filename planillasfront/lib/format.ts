export const money = (n: number) =>
  (n ?? 0).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });

export const MESES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const mesNombre = (m: number) => MESES[m] ?? String(m);
