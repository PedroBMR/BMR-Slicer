import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { read } from 'xlsx';

import type { EstimateSummary } from '../../modules/estimate';
import { toPdfBlob, toXlsxBlob } from '../../modules/export';

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  if ('arrayBuffer' in blob) {
    const arrayBuffer = await (
      blob as Blob & { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(Buffer.from(reader.result as ArrayBuffer));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

const summary: EstimateSummary = {
  layers: [
    {
      elevation: 0.05,
      circumference: 12.5,
      area: 45.67,
      centroid: new Vector3(1.23, 4.56, 7.89),
      boundingRadius: 10,
      segments: [],
    },
  ],
  volume: 456.7,
  mass: 123.4,
  resinCost: 67.89,
  durationMinutes: 42.5,
};

describe('export helpers', () => {
  it('creates an XLSX blob with workbook sheets', async () => {
    const blob = toXlsxBlob(summary);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buffer = await blobToBuffer(blob);
    const workbook = read(buffer);
    expect(workbook.SheetNames).toContain('Summary');
    expect(workbook.SheetNames).toContain('Layers');
  });

  it('creates a PDF blob with a PDF header', async () => {
    const blob = toPdfBlob(summary);
    expect(blob.type).toBe('application/pdf');

    const buffer = await blobToBuffer(blob);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
