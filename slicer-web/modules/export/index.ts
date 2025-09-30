import { jsPDF } from 'jspdf';
import { utils, write } from 'xlsx';

import type { EstimateSummary, LayerEstimate } from '../estimate';

export interface ExportRequest {
  fileName: string;
  summary: EstimateSummary;
}

export function toJsonBlob(summary: EstimateSummary): Blob {
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary: {
      volume: summary.volume,
      mass: summary.mass,
      resinCost: summary.resinCost,
      durationMinutes: summary.durationMinutes,
      layers: summary.layers.length
    },
    layers: summary.layers.map((layer) => ({
      elevation: layer.elevation,
      area: layer.area,
      centroid: layer.centroid.toArray(),
      circumference: layer.circumference
    }))
  };

  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export function toCsvBlob(layers: LayerEstimate[]): Blob {
  const header = 'layer,elevation,area,circumference,centroidX,centroidY,centroidZ';
  const rows = layers.map((layer, index) =>
    [
      index + 1,
      layer.elevation.toFixed(4),
      layer.area.toFixed(4),
      layer.circumference.toFixed(4),
      ...layer.centroid.toArray().map((value) => value.toFixed(4))
    ].join(',')
  );

  const content = [header, ...rows].join('\n');
  return new Blob([content], { type: 'text/csv' });
}

function toUint8Array(data: ArrayBuffer | Uint8Array | number[]): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer);
  }
  return Uint8Array.from(data);
}

function createWorkbook(summary: EstimateSummary) {
  const workbook = utils.book_new();

  const summarySheet = utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Layers', summary.layers.length],
    ['Volume (mm³)', summary.volume],
    ['Mass (g)', summary.mass],
    ['Resin cost', summary.resinCost],
    ['Estimated duration (minutes)', summary.durationMinutes]
  ]);
  utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const layerSheet = utils.json_to_sheet(
    summary.layers.map((layer, index) => ({
      Layer: index + 1,
      Elevation: layer.elevation,
      Area: layer.area,
      Circumference: layer.circumference,
      CentroidX: layer.centroid.x,
      CentroidY: layer.centroid.y,
      CentroidZ: layer.centroid.z
    }))
  );
  utils.book_append_sheet(workbook, layerSheet, 'Layers');

  return workbook;
}

export function toXlsxBlob(summary: EstimateSummary): Blob {
  const workbook = createWorkbook(summary);
  const arrayBuffer = write(workbook, { type: 'array', bookType: 'xlsx' });
  const buffer = toUint8Array(arrayBuffer as ArrayBuffer | Uint8Array | number[]);
  return new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

export function toPdfBlob(summary: EstimateSummary): Blob {
  const doc = new jsPDF({ compress: true });
  const marginLeft = 16;
  let cursor = 20;

  doc.setFontSize(18);
  doc.text('Print Estimate Summary', marginLeft, cursor);
  cursor += 10;

  doc.setFontSize(12);
  const metrics = [
    ['Layers', summary.layers.length.toString()],
    ['Volume (mm³)', summary.volume.toFixed(2)],
    ['Mass (g)', summary.mass.toFixed(2)],
    ['Resin cost', summary.resinCost.toFixed(2)],
    ['Estimated duration (minutes)', summary.durationMinutes.toFixed(1)]
  ];

  metrics.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, marginLeft, cursor);
    cursor += 7;
  });

  doc.text('Layer overview', marginLeft, cursor + 3);
  cursor += 12;

  doc.setFontSize(10);
  const header = ['#', 'Elevation', 'Area', 'Circ.', 'Centroid'];
  doc.text(header.join('  '), marginLeft, cursor);
  cursor += 6;

  summary.layers.slice(0, 20).forEach((layer, index) => {
    const centroid = `${layer.centroid.x.toFixed(2)}, ${layer.centroid.y.toFixed(2)}, ${layer.centroid.z.toFixed(2)}`;
    const row = [
      (index + 1).toString(),
      layer.elevation.toFixed(2),
      layer.area.toFixed(2),
      layer.circumference.toFixed(2),
      centroid
    ];
    doc.text(row.join('  '), marginLeft, cursor);
    cursor += 5;
    if (cursor > 270) {
      doc.addPage();
      cursor = 20;
    }
  });

  const arrayBuffer = doc.output('arraybuffer');
  const buffer = toUint8Array(arrayBuffer as ArrayBuffer | Uint8Array | number[]);
  return new Blob([buffer as BlobPart], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportSummary(request: ExportRequest) {
  const jsonBlob = toJsonBlob(request.summary);
  downloadBlob(jsonBlob, `${request.fileName}.json`);
  const csvBlob = toCsvBlob(request.summary.layers);
  downloadBlob(csvBlob, `${request.fileName}.csv`);
}

export function exportSummaryAsXlsx(request: ExportRequest) {
  const blob = toXlsxBlob(request.summary);
  downloadBlob(blob, `${request.fileName}.xlsx`);
}

export function exportSummaryAsPdf(request: ExportRequest) {
  const blob = toPdfBlob(request.summary);
  downloadBlob(blob, `${request.fileName}.pdf`);
}
