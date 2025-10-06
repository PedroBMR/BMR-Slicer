import type { EstimateParameters, EstimateSummary } from '../../modules/estimate';
import type { GeometryMetrics } from '../compute';

export interface EstimateRecord {
  id: string;
  createdAt: Date;
  summary: EstimateSummary;
  parameters: EstimateParameters;
  geometryMetrics?: GeometryMetrics;
  fileName?: string;
}

export interface SaveEstimateRequest {
  summary: EstimateSummary;
  parameters: EstimateParameters;
  geometryMetrics?: GeometryMetrics;
  fileName?: string;
}

const records: EstimateRecord[] = [];

function createId(): string {
  const globalCrypto = globalThis.crypto as typeof globalThis.crypto | undefined;
  if (globalCrypto && 'randomUUID' in globalCrypto) {
    return globalCrypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
}

export async function saveEstimate(request: SaveEstimateRequest): Promise<EstimateRecord> {
  const record: EstimateRecord = {
    id: createId(),
    createdAt: new Date(),
    summary: request.summary,
    parameters: request.parameters,
    geometryMetrics: request.geometryMetrics,
    fileName: request.fileName,
  };

  records.push(record);
  return record;
}

export async function listEstimates(): Promise<EstimateRecord[]> {
  return records.map((record) => ({ ...record }));
}
