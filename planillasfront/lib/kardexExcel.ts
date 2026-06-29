import type { Empleado } from "@/lib/types";
import { kardexSecciones } from "@/lib/kardex";

// Exporta el kardex de un colaborador a un Excel CON ESTILO (banner, secciones,
// dos columnas etiqueta/valor, firmas), parecido a la ficha de RRHH. Usa ExcelJS
// (importado dinámicamente para no engordar el bundle principal).

const NAVY = "FF0E2236";
const TEAL = "FF177C6B";
const GRIS = "FFECEFF3";
const BORDE = "FFD7DDE3";
const TEXTO = "FF1F2937";

export type HojaSimple = { nombre: string; filas: Record<string, string | number>[] };

export async function exportarKardexExcel(e: Empleado, puestoNombre: string, extras: HojaSimple[] = []) {
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? (mod as unknown as typeof mod.default);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kardex", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 20 }, { width: 20 }, { width: 14 }, { width: 22 }, { width: 20 }, { width: 16 }];

  const thin = { style: "thin" as const, color: { argb: BORDE } };
  const todoBorde = { top: thin, left: thin, bottom: thin, right: thin };

  // --- Título ---
  ws.mergeCells("A1:F3");
  const t = ws.getCell("A1");
  t.value = "KARDEX DE PERSONAL";
  t.font = { name: "Calibri", size: 22, bold: true, color: { argb: "FFFFFFFF" } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  for (let r = 1; r <= 3; r++) ws.getRow(r).height = 22;

  // --- Subtítulo ---
  ws.mergeCells("A4:F4");
  const s = ws.getCell("A4");
  s.value = `Colaborador: ${e.nombres} ${e.apellidos}    |    Puesto: ${puestoNombre || "—"}    |    Estado: ${e.activo ? "Activo" : "Baja"}`;
  s.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  s.alignment = { horizontal: "center", vertical: "middle" };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  ws.getRow(4).height = 20;

  let r = 6;
  const seccionHeader = (titulo: string) => {
    ws.mergeCells(`A${r}:F${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = titulo.toUpperCase();
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    ws.getRow(r).height = 20;
    r++;
  };
  const celdaLabel = (addr: string, txt: string) => {
    const c = ws.getCell(addr);
    c.value = txt;
    c.font = { name: "Calibri", size: 9, bold: true, color: { argb: TEXTO } };
    c.alignment = { vertical: "middle", indent: 1, wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
    c.border = todoBorde;
  };
  const celdaValor = (addr: string, txt: string) => {
    const c = ws.getCell(addr);
    c.value = txt;
    c.font = { name: "Calibri", size: 10, color: { argb: TEXTO } };
    c.alignment = { vertical: "middle", indent: 1, wrapText: true };
    c.border = todoBorde;
  };

  for (const sec of kardexSecciones(e, puestoNombre)) {
    seccionHeader(sec.titulo);
    for (let i = 0; i < sec.campos.length; i += 2) {
      ws.getRow(r).height = 18;
      celdaLabel(`A${r}`, sec.campos[i][0]);
      ws.mergeCells(`B${r}:C${r}`);
      celdaValor(`B${r}`, sec.campos[i][1]);
      if (sec.campos[i + 1]) {
        celdaLabel(`D${r}`, sec.campos[i + 1][0]);
        ws.mergeCells(`E${r}:F${r}`);
        celdaValor(`E${r}`, sec.campos[i + 1][1]);
      } else {
        ws.getCell(`D${r}`).border = todoBorde;
        ws.mergeCells(`E${r}:F${r}`);
        ws.getCell(`E${r}`).border = todoBorde;
      }
      r++;
    }
    r++; // espacio entre secciones
  }

  // --- Observaciones ---
  seccionHeader("6. Observaciones / control interno");
  ws.getCell(`A${r}`).value = "Observaciones:";
  ws.getCell(`A${r}`).font = { name: "Calibri", size: 9, color: { argb: "FF64748B" } };
  ws.mergeCells(`A${r}:F${r + 4}`);
  ws.getCell(`A${r}`).alignment = { vertical: "top", indent: 1 };
  ws.getCell(`A${r}`).border = todoBorde;
  r += 6;

  // --- Firmas ---
  r += 1;
  const firma = (col1: string, col2: string, txt: string) => {
    ws.mergeCells(`${col1}${r}:${col2}${r}`);
    const linea = ws.getCell(`${col1}${r}`);
    linea.border = { top: { style: "thin", color: { argb: TEXTO } } };
    ws.mergeCells(`${col1}${r + 1}:${col2}${r + 1}`);
    const lbl = ws.getCell(`${col1}${r + 1}`);
    lbl.value = txt;
    lbl.font = { name: "Calibri", size: 9, bold: true, color: { argb: TEXTO } };
    lbl.alignment = { horizontal: "center" };
  };
  firma("A", "B", "Firma colaborador");
  firma("E", "F", "Recursos Humanos");

  // --- Hojas de detalle (perfil, documentos, vacaciones, etc.) ---
  for (const hoja of extras) {
    const wsx = wb.addWorksheet(hoja.nombre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31), { views: [{ showGridLines: false }] });
    if (hoja.filas.length === 0) {
      wsx.getCell("A1").value = "Sin registros.";
      wsx.getCell("A1").font = { name: "Calibri", italic: true, color: { argb: "FF94A3B8" } };
      continue;
    }
    const cols = Object.keys(hoja.filas[0]);
    wsx.columns = cols.map((c) => ({ width: Math.min(40, Math.max(14, c.length + 6)) }));
    const head = wsx.getRow(1);
    cols.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c;
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      cell.alignment = { vertical: "middle", indent: 1 };
    });
    head.height = 18;
    hoja.filas.forEach((fila, ri) => {
      const row = wsx.getRow(ri + 2);
      cols.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = fila[c];
        cell.font = { name: "Calibri", size: 10, color: { argb: TEXTO } };
        cell.alignment = { vertical: "middle", indent: 1, wrapText: true };
        cell.border = { bottom: { style: "thin", color: { argb: BORDE } } };
      });
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kardex_${e.apellidos}_${e.nombres}`.replace(/\s+/g, "_") + ".xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
