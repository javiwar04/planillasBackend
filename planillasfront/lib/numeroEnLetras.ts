// Convierte un monto en quetzales a letras (para boletas y finiquitos).
// Ej: 3082.65 -> "TRES MIL OCHENTA Y DOS QUETZALES CON 65/100".

const UNI = [
  "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIUN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];
const DEC = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function seccion(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  let t = "";
  const c = Math.floor(n / 100), r = n % 100;
  if (c) t += CEN[c] + " ";
  if (r < 30) t += UNI[r];
  else {
    const d = Math.floor(r / 10), u = r % 10;
    t += DEC[d];
    if (u) t += " Y " + UNI[u];
  }
  return t.trim();
}

function miles(n: number): string {
  const m = Math.floor(n / 1000), r = n % 1000;
  let t = m === 1 ? "MIL" : m > 1 ? seccion(m) + " MIL" : "";
  if (r) t += (t ? " " : "") + seccion(r);
  return t;
}

function entero(n: number): string {
  if (n === 0) return "CERO";
  const mill = Math.floor(n / 1_000_000), r = n % 1_000_000;
  let t = mill === 1 ? "UN MILLÓN" : mill > 1 ? miles(mill) + " MILLONES" : "";
  if (r) t += (t ? " " : "") + miles(r);
  return t;
}

export function numeroEnLetras(valor: number): string {
  const ent = Math.floor(valor);
  const cent = Math.round((valor - ent) * 100);
  const moneda = ent === 1 ? "QUETZAL" : "QUETZALES";
  return `${entero(ent)} ${moneda} CON ${String(cent).padStart(2, "0")}/100`;
}
