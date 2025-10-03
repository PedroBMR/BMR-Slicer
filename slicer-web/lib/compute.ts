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
  indices?: Uint32Array;
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

export interface GeometryLayerResult {
  layers: GeometryLayerSummary[];
  volume: number;
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
    indices: response.indices ? new Uint32Array(response.indices) : undefined,
    metrics: response.metrics
  };
}

export async function computeGeometryLayers(
  payload: { positions: Float32Array; indices?: Uint32Array },
  parameters: EstimateParameters
): Promise<GeometryLayerResult> {
  const positions = payload.positions.buffer.slice(0);
  const indices = payload.indices ? payload.indices.buffer.slice(0) : undefined;
  const handle = getGeometryWorkerHandle();
  const transferables: ArrayBuffer[] = [positions];
  if (indices) {
    transferables.push(indices);
  }

  const response = await handle.proxy.generateLayers(
    transfer(
      {
        positions,
        indices,
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
    volume
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
