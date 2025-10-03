import { transfer } from 'comlink';

import type { EstimateParameters } from '../modules/estimate';
import type { GeometryWorkerApi, GeometryMetrics } from '../workers/geometry.worker';
import type { EstimateWorkerApi, EstimateWorkerResponse } from '../workers/estimate.worker';
import type { PrintParams } from './estimate';
import { createWorkerHandle, type WorkerHandle } from './worker-factory';

let geometryHandle: WorkerHandle<GeometryWorkerApi> | undefined;
let estimateHandle: WorkerHandle<EstimateWorkerApi> | undefined;

function getGeometryWorkerHandle(): WorkerHandle<GeometryWorkerApi> {
  if (!geometryHandle) {
    geometryHandle = createWorkerHandle<GeometryWorkerApi>(
      new URL('../workers/geometry.worker.ts', import.meta.url)
    );
  }

  return geometryHandle;
}

function getEstimateWorkerHandle(): WorkerHandle<EstimateWorkerApi> {
  if (!estimateHandle) {
    estimateHandle = createWorkerHandle<EstimateWorkerApi>(
      new URL('../workers/estimate.worker.ts', import.meta.url)
    );
  }

  return estimateHandle;
}

export interface GeometryComputationResult {
  positions: Float32Array;
  positionsBuffer: ArrayBuffer;
  indices?: Uint32Array;
  indicesBuffer?: ArrayBuffer;
  metrics: GeometryMetrics;
}

export interface GeometryLayerSegment {
  start: [number, number, number];
  end: [number, number, number];
}

export interface GeometryLayerSummary {
  elevation: number;
  area: number;
  circumference: number;
  boundingRadius: number;
  centroid: [number, number, number];
  segments: GeometryLayerSegment[];
}

export interface GeometryLayerRequestPayload {
  positions: Float32Array;
  positionsBuffer?: ArrayBuffer;
  indices?: Uint32Array;
  indicesBuffer?: ArrayBuffer;
}

export interface GeometryLayerResult {
  layers: GeometryLayerSummary[];
  volume: number;
  positions: Float32Array;
  positionsBuffer: ArrayBuffer;
  indices?: Uint32Array;
  indicesBuffer?: ArrayBuffer;
}

export async function computeGeometry(file: File): Promise<GeometryComputationResult> {
  const buffer = await file.arrayBuffer();
  const handle = getGeometryWorkerHandle();
  const response = await handle.proxy.analyzeGeometry(
    transfer(
      {
        buffer,
        fileName: file.name,
        mimeType: file.type
      },
      [buffer]
    )
  );

  return {
    positions: new Float32Array(response.positions),
    positionsBuffer: response.positions,
    indices: response.indices ? new Uint32Array(response.indices) : undefined,
    indicesBuffer: response.indices,
    metrics: response.metrics
  };
}

export async function computeGeometryLayers(
  payload: GeometryLayerRequestPayload,
  parameters: EstimateParameters
): Promise<GeometryLayerResult> {
  const positionsBuffer = payload.positionsBuffer ?? payload.positions.buffer;
  const indicesBuffer = payload.indices ? payload.indicesBuffer ?? payload.indices.buffer : undefined;
  const handle = getGeometryWorkerHandle();
  const transferables: ArrayBuffer[] = [positionsBuffer];
  if (indicesBuffer) {
    transferables.push(indicesBuffer);
  }

  const response = await handle.proxy.generateLayers(
    transfer(
      {
        positions: positionsBuffer,
        indices: indicesBuffer,
        parameters
      },
      transferables
    )
  );

  const volume = response.layers.reduce(
    (acc, layer) => acc + layer.area * parameters.layerHeight,
    0
  );

  return {
    layers: response.layers,
    volume,
    positions: new Float32Array(response.positions),
    positionsBuffer: response.positions,
    indices: response.indices ? new Uint32Array(response.indices) : undefined,
    indicesBuffer: response.indices
  };
}

export async function computeEstimate(
  volumeModel_mm3: number,
  params?: Partial<PrintParams>
): Promise<EstimateWorkerResponse> {
  const handle = getEstimateWorkerHandle();
  return handle.proxy.estimate({ volumeModel_mm3, params });
}

export function releaseGeometryCompute(): void {
  if (!geometryHandle) {
    return;
  }

  geometryHandle.terminate();
  geometryHandle = undefined;
}

export function releaseEstimateCompute(): void {
  if (!estimateHandle) {
    return;
  }

  estimateHandle.terminate();
  estimateHandle = undefined;
}

export type { GeometryMetrics };
