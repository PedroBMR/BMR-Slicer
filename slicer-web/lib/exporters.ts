import { jsPDF } from 'jspdf';
import { utils, writeFileXLSX } from 'xlsx';

export interface ExportRow {
  section?: string;
  metric: string;
  value: string | number | boolean | null | undefined;
}

export interface ExportXLSXOptions {
  fileName?: string;
  sheetName?: string;
  headers?: {
    section?: string;
    metric?: string;
    value?: string;
  };
}

export function exportXLSX(rows: ExportRow[], options: ExportXLSXOptions = {}) {
  const sectionHeader = options.headers?.section ?? 'Seção';
  const metricHeader = options.headers?.metric ?? 'Métrica';
  const valueHeader = options.headers?.value ?? 'Valor';

  const worksheetData = rows.map((row) => ({
    [sectionHeader]: row.section ?? '',
    [metricHeader]: row.metric,
    [valueHeader]: row.value ?? '',
  }));

  const workbook = utils.book_new();
  const worksheet = utils.json_to_sheet(worksheetData, {
    header: [sectionHeader, metricHeader, valueHeader],
    skipHeader: false,
  });

  worksheet['!cols'] = [{ wch: 24 }, { wch: 32 }, { wch: 28 }];

  utils.book_append_sheet(workbook, worksheet, options.sheetName ?? 'Resumo');
  writeFileXLSX(workbook, options.fileName ?? 'estimativa.xlsx');
}

export interface ExportPDFEntry {
  label: string;
  value: string | number | boolean | null | undefined;
}

export interface ExportPDFSection {
  title: string;
  entries: ExportPDFEntry[];
}

export interface ExportPDFOptions {
  fileName?: string;
  documentTitle?: string;
}

export function exportPDF(sections: ExportPDFSection[], options: ExportPDFOptions = {}) {
  const doc = new jsPDF({ compress: true });
  const marginX = 18;
  const initialY = 24;
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2;

  doc.setFontSize(16);
  doc.text(options.documentTitle ?? 'Resumo da Estimativa', marginX, initialY);

  let cursorY = initialY + 10;

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      cursorY += 4;
    }

    doc.setFontSize(14);
    if (cursorY + 8 > pageHeight) {
      doc.addPage();
      cursorY = 20;
    }
    doc.text(section.title, marginX, cursorY);
    cursorY += 8;

    doc.setFontSize(12);
    section.entries.forEach((entry) => {
      if (entry.value === undefined || entry.value === null || entry.value === '') {
        return;
      }

      const renderedValue =
        typeof entry.value === 'boolean' ? (entry.value ? 'Sim' : 'Não') : entry.value;

      const line = `${entry.label}: ${renderedValue}`;
      const wrapped = doc.splitTextToSize(line, contentWidth);
      const requiredHeight = wrapped.length * 6 + 2;

      if (cursorY + requiredHeight > pageHeight - 20) {
        doc.addPage();
        cursorY = 20;
      }

      doc.text(wrapped, marginX, cursorY, { baseline: 'top' });
      cursorY += requiredHeight;
    });
  });

  doc.save(options.fileName ?? 'estimativa.pdf');
}
