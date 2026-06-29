import * as XLSX from "xlsx";

// Exporta un arreglo de objetos planos a un archivo .xlsx (encabezados = llaves).
export function exportarExcel(
  nombreArchivo: string,
  filas: Record<string, string | number>[],
  hoja = "Datos"
) {
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

// Exporta varias hojas en un solo archivo (p. ej. el kardex: Datos, Perfil,
// Documentos, Desempeño). Cada hoja recibe su nombre y sus filas.
export type HojaExcel = { nombre: string; filas: Record<string, string | number>[] };
export function exportarExcelHojas(nombreArchivo: string, hojas: HojaExcel[]) {
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const ws = XLSX.utils.json_to_sheet(h.filas.length ? h.filas : [{}]);
    // Nombre de hoja: Excel limita a 31 chars y prohíbe algunos símbolos.
    const nombre = h.nombre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}
