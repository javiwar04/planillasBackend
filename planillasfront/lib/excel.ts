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
