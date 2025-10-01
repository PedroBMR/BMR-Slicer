import { jsPDF } from 'jspdf';
import { utils, writeFileXLSX } from 'xlsx';

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

export interface ExportXLSXOptions {
  fileName?: string;
  sheetName?: string;
}

export function exportXLSX(rows: ExportRow[], options: ExportXLSXOptions = {}) {
  const workbook = utils.book_new();
  const worksheet = utils.json_to_sheet(rows);
  utils.book_append_sheet(workbook, worksheet, options.sheetName ?? 'Resumo');

  const fileName = options.fileName ?? 'estimativa.xlsx';
  writeFileXLSX(workbook, fileName);
}

export interface ExportPDFOptions {
  fileName?: string;
  title?: string;
  order?: string[];
}

export function exportPDF(summary: Record<string, string | number | undefined>, options: ExportPDFOptions = {}) {
  const doc = new jsPDF({ compress: true });
  const marginX = 18;
  let cursorY = 24;

  doc.setFontSize(16);
  doc.text(options.title ?? 'Resumo da Estimativa', marginX, cursorY);
  cursorY += 12;

  doc.setFontSize(12);
  const entries = options.order
    ? options.order
        .map((key) => ({ key, value: summary[key] }))
        .filter((entry) => entry.value !== undefined)
    : Object.entries(summary).map(([key, value]) => ({ key, value }));

  entries.forEach((entry) => {
    const value = entry.value;
    const textValue = typeof value === 'number' ? value.toString() : value ?? '';
    doc.text(`${entry.key}: ${textValue}`, marginX, cursorY);
    cursorY += 8;
    if (cursorY > 280) {
      doc.addPage();
      cursorY = 20;
    }
  });

  doc.save(options.fileName ?? 'estimativa.pdf');
}
