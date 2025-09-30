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
