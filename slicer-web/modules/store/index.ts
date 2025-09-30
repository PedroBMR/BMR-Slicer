'use client';

import { create } from 'zustand';
import { BufferGeometry, Vector3 } from 'three';
import { ZodError } from 'zod';

import type { EstimateParameters, EstimateSummary, LayerEstimate } from '../estimate';
import { DEFAULT_PARAMETERS } from '../estimate';
import { loadGeometryFromFile } from '../geometry';
import { getGeometryWorkerHandle, releaseGeometryWorker } from '../geometry/workerClient';
import { getEstimateWorkerHandle, releaseEstimateWorker } from '../estimate/workerClient';
import { loadRecentEstimates, saveEstimate, type EstimateRecord } from './persistence';

interface GeometryPayload {
  positions: Float32Array;
  indices?: Uint32Array;
}

export interface ViewerStoreState {
  geometry?: BufferGeometry;
  layers: LayerEstimate[];
  summary?: EstimateSummary;
  parameters: EstimateParameters;
  loading: boolean;
  error?: string;
  fileName?: string;
  history: EstimateRecord[];
  geometryPayload?: GeometryPayload;
  geometrySource?: ArrayBuffer | File;
}

export interface ViewerStoreActions {
  loadFile: (file: File) => Promise<void>;
  setGeometry: (geometry: BufferGeometry, fileName?: string, source?: ArrayBuffer | File) => Promise<void>;
  setParameters: (parameters: Partial<EstimateParameters>) => Promise<void>;
  recompute: () => Promise<void>;
  reset: () => void;
  refreshHistory: () => Promise<void>;
  disposeWorkers: () => void;
}

export type ViewerStore = ViewerStoreState & ViewerStoreActions;

export const useViewerStore = create<ViewerStore>((set, get) => ({
  layers: [],
  parameters: DEFAULT_PARAMETERS,
  loading: false,
  history: [],
  geometrySource: undefined,

  async loadFile(file: File) {
    set({ loading: true, error: undefined });
    try {
      const geometry = await loadGeometryFromFile(file);
      await get().setGeometry(geometry, file.name, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  async setGeometry(geometry: BufferGeometry, fileName?: string, source?: ArrayBuffer | File) {
    const positionAttribute = geometry.getAttribute('position');
    if (!positionAttribute) {
      set({ error: 'Geometry is missing position data.' });
      return;
    }

    const positions = new Float32Array(positionAttribute.array as ArrayLike<number>);
    const index = geometry.getIndex();
    const indices = index ? new Uint32Array(index.array as ArrayLike<number>) : undefined;

    set({
      geometry,
      fileName,
      geometryPayload: { positions, indices },
      geometrySource: source,
      layers: [],
      summary: undefined
    });
    await get().recompute();

    const summary = get().summary;
    if (summary) {
      const record = {
        fileName: fileName ?? 'untitled-mesh',
        createdAt: new Date().toISOString(),
        summary: {
          volume: summary.volume,
          mass: summary.mass,
          resinCost: summary.resinCost,
          durationMinutes: summary.durationMinutes,
          layers: summary.layers.length
        }
      } satisfies EstimateRecord;

      const handlePersistenceError = (error: unknown) => {
        const message =
          error instanceof ZodError
            ? 'Failed to save estimate history: invalid estimate record.'
            : error instanceof Error
              ? error.message
              : 'Unknown error';
        set({ error: message });
      };

      try {
        const operation = saveEstimate(record);
        if (operation) {
          void operation
            .then(() => get().refreshHistory())
            .catch((error) => {
              handlePersistenceError(error);
            });
        }
      } catch (error) {
        handlePersistenceError(error);
      }
    }
  },

  async setParameters(parameters: Partial<EstimateParameters>) {
    const next = { ...get().parameters, ...parameters };
    set({ parameters: next });
    if (get().geometryPayload) {
      await get().recompute();
    }
  },

  async recompute() {
    const payload = get().geometryPayload;
    if (!payload) {
      set({ layers: [], summary: undefined });
      return;
    }

    try {
      set({ error: undefined });
      const parameters = get().parameters;

      const geometryResponsePromise = getGeometryWorkerHandle().proxy.generateLayers({
        positions: payload.positions.buffer.slice(0) as ArrayBuffer,
        indices: payload.indices ? (payload.indices.buffer.slice(0) as ArrayBuffer) : undefined,
        parameters
      });

      const estimateResponsePromise = getEstimateWorkerHandle().proxy.estimate({
        positions: payload.positions.buffer.slice(0) as ArrayBuffer,
        indices: payload.indices ? (payload.indices.buffer.slice(0) as ArrayBuffer) : undefined,
        parameters
      });

      const [geometryResponse, estimateResponse] = await Promise.all([
        geometryResponsePromise,
        estimateResponsePromise
      ]);

      const layers: LayerEstimate[] = geometryResponse.layers.map((layer) => ({
        elevation: layer.elevation,
        area: layer.area,
        circumference: layer.circumference,
        boundingRadius: layer.boundingRadius,
        centroid: new Vector3(...layer.centroid),
        segments: layer.segments.map((segment) => ({
          start: new Vector3(...segment.start),
          end: new Vector3(...segment.end)
        }))
      }));

      const summary: EstimateSummary = {
        layers,
        volume: estimateResponse.summary.volume,
        mass: estimateResponse.summary.mass,
        resinCost: estimateResponse.summary.resinCost,
        durationMinutes: estimateResponse.summary.durationMinutes
      };

      set({ layers, summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  reset() {
    set({
      geometry: undefined,
      layers: [],
      summary: undefined,
      fileName: undefined,
      geometryPayload: undefined,
      geometrySource: undefined
    });
  },

  async refreshHistory() {
    if (typeof window === 'undefined') {
      return;
    }
    const history = await loadRecentEstimates();
    set({ history });
  },

  disposeWorkers() {
    releaseGeometryWorker();
    releaseEstimateWorker();
  }
}));
