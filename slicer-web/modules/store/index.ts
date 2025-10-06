'use client';

import { create } from 'zustand';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import type { EstimateParameters, EstimateSummary, LayerEstimate } from '../estimate';
import { DEFAULT_PARAMETERS } from '../estimate';
import type { EstimateBreakdown } from '../../lib/estimate';
import {
  computeEstimate,
  computeGeometry,
  computeGeometryLayers,
  releaseEstimateCompute,
  releaseGeometryCompute,
  type GeometryLayerSummary,
  type GeometryMetrics,
} from '../../lib/compute';
import { parseAndEstimate } from '../../lib/gcode';
import { createIdleScheduler } from './idleScheduler';

export interface GcodeOverrideState {
  fileName: string;
  time_s: number;
  filamentLen_mm: number;
  loadedAt: number;
}

export interface GeometryPayload {
  positions: Float32Array;
  positionsBuffer: ArrayBuffer;
  indices?: Uint32Array;
  indicesBuffer?: ArrayBuffer;
  metrics?: GeometryMetrics;
}

export interface ViewerStoreState {
  geometry?: BufferGeometry;
  layers: LayerEstimate[];
  summary?: EstimateSummary;
  parameters: EstimateParameters;
  loading: boolean;
  error?: string;
  fileName?: string;
  geometryPayload?: GeometryPayload;
  geometrySource?: ArrayBuffer | File;
  geometryMetrics?: GeometryMetrics;
  geometryCenter?: Vector3;
  estimateBreakdown?: EstimateBreakdown;
  effectiveBreakdown?: EstimateBreakdown;
  gcodeOverride?: GcodeOverrideState;
  gcodeLoading: boolean;
  gcodeError?: string;
}

export interface ViewerStoreActions {
  loadFile: (file: File) => Promise<void>;
  setGeometry: (
    geometry: BufferGeometry,
    fileName?: string,
    source?: ArrayBuffer | File,
    analysis?: GeometryPayload,
  ) => Promise<void>;
  setParameters: (parameters: Partial<EstimateParameters>) => Promise<void>;
  recompute: () => Promise<void>;
  loadGcode: (file: File) => Promise<void>;
  clearGcodeOverride: () => void;
  reset: () => void;
  disposeWorkers: () => void;
}

export type ViewerStore = ViewerStoreState & ViewerStoreActions;

const recomputeScheduler = createIdleScheduler();

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const FILE_TOO_LARGE_ERROR = 'File is too large. Please upload a file smaller than 50 MB.';

function ensureArrayBuffer(buffer: ArrayBufferLike): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(new Uint8Array(buffer));
  return copy;
}

export const useViewerStore = create<ViewerStore>((set, get) => ({
  layers: [],
  parameters: DEFAULT_PARAMETERS,
  loading: false,
  geometrySource: undefined,
  geometryMetrics: undefined,
  geometryCenter: undefined,
  estimateBreakdown: undefined,
  effectiveBreakdown: undefined,
  gcodeOverride: undefined,
  gcodeLoading: false,
  gcodeError: undefined,

  async loadFile(file: File) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      set({ error: FILE_TOO_LARGE_ERROR, loading: false });
      return;
    }

    set({ loading: true, error: undefined });
    try {
      const response = await computeGeometry(file);

      const positions = response.positions;
      const indices = response.indices;

      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      if (indices) {
        geometry.setIndex(new Uint32BufferAttribute(indices, 1));
      }
      geometry.computeVertexNormals();

      await get().setGeometry(geometry, file.name, file, {
        positions,
        positionsBuffer: response.positionsBuffer,
        indices,
        indicesBuffer: response.indicesBuffer,
        metrics: response.metrics,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  async setGeometry(
    geometry: BufferGeometry,
    fileName?: string,
    source?: ArrayBuffer | File,
    analysis?: GeometryPayload,
  ) {
    let positions: Float32Array;
    let indices: Uint32Array | undefined;
    let positionsBuffer: ArrayBuffer | undefined;
    let indicesBuffer: ArrayBuffer | undefined;
    let metrics = analysis?.metrics;

    if (analysis) {
      positions = analysis.positions;
      positionsBuffer = analysis.positionsBuffer ?? ensureArrayBuffer(analysis.positions.buffer);
      indices = analysis.indices;
      indicesBuffer =
        analysis.indicesBuffer ??
        (analysis.indices ? ensureArrayBuffer(analysis.indices.buffer) : undefined);
      metrics = analysis.metrics;
    } else {
      const positionAttribute = geometry.getAttribute('position');
      if (!positionAttribute) {
        set({ error: 'Geometry is missing position data.' });
        return;
      }
      positions = new Float32Array(positionAttribute.array as ArrayLike<number>);
      positionsBuffer = ensureArrayBuffer(positions.buffer);
      const index = geometry.getIndex();
      indices = index ? new Uint32Array(index.array as ArrayLike<number>) : undefined;
      indicesBuffer = indices ? ensureArrayBuffer(indices.buffer) : undefined;
    }

    const resolvedPositionsBuffer = positionsBuffer ?? ensureArrayBuffer(positions.buffer);
    const resolvedIndicesBuffer =
      indices && indices.length > 0
        ? (indicesBuffer ?? ensureArrayBuffer(indices.buffer))
        : undefined;

    const centerVector = metrics ? new Vector3(...metrics.center) : undefined;

    set({
      geometry,
      fileName,
      geometryPayload: {
        positions,
        positionsBuffer: resolvedPositionsBuffer,
        indices,
        indicesBuffer: resolvedIndicesBuffer,
        metrics,
      },
      geometryMetrics: metrics,
      geometryCenter: centerVector,
      geometrySource: source,
      layers: [],
      summary: undefined,
      estimateBreakdown: undefined,
      effectiveBreakdown: undefined,
      gcodeOverride: undefined,
      gcodeLoading: false,
      gcodeError: undefined,
    });
    await recomputeScheduler.schedule(() => get().recompute(), { immediate: true });
  },

  async setParameters(parameters: Partial<EstimateParameters>) {
    const next = { ...get().parameters, ...parameters };
    set({ parameters: next });
    if (get().geometryPayload) {
      await recomputeScheduler.schedule(() => get().recompute());
    }
  },

  async recompute() {
    const payload = get().geometryPayload;
    if (!payload) {
      set({
        layers: [],
        summary: undefined,
        estimateBreakdown: undefined,
        effectiveBreakdown: undefined,
      });
      return;
    }

    try {
      set({ error: undefined });
      const parameters = get().parameters;

      const metricsVolume = payload.metrics?.volume.absolute;
      const estimateResponsePromise =
        metricsVolume !== undefined ? computeEstimate(metricsVolume) : undefined;

      const {
        layers: rawLayers,
        volume,
        positions: refreshedPositions,
        positionsBuffer: refreshedPositionsBuffer,
        indices: refreshedIndices,
        indicesBuffer: refreshedIndicesBuffer,
      } = await computeGeometryLayers(
        {
          positions: payload.positions,
          positionsBuffer: payload.positionsBuffer,
          indices: payload.indices,
          indicesBuffer: payload.indicesBuffer,
        },
        parameters,
      );

      const geometry = get().geometry;
      if (geometry) {
        geometry.setAttribute('position', new Float32BufferAttribute(refreshedPositions, 3));
        if (refreshedIndices) {
          geometry.setIndex(new Uint32BufferAttribute(refreshedIndices, 1));
        } else {
          geometry.setIndex(null);
        }
      }

      const volumeModel_mm3 = metricsVolume ?? volume;
      const estimateResponse =
        estimateResponsePromise !== undefined
          ? await estimateResponsePromise
          : await computeEstimate(volumeModel_mm3);

      const layers: LayerEstimate[] = rawLayers.map((layer: GeometryLayerSummary) => ({
        elevation: layer.elevation,
        area: layer.area,
        circumference: layer.circumference,
        boundingRadius: layer.boundingRadius,
        centroid: new Vector3(...layer.centroid),
        segments: layer.segments.map((segment) => ({
          start: new Vector3(...segment.start),
          end: new Vector3(...segment.end),
        })),
      }));

      const baseBreakdown = estimateResponse.breakdown;
      const override = get().gcodeOverride;
      const effectiveBreakdown: EstimateBreakdown = {
        ...baseBreakdown,
        costs: { ...baseBreakdown.costs },
        params: baseBreakdown.params,
      };

      if (override) {
        effectiveBreakdown.time_s = override.time_s;
        effectiveBreakdown.filamentLen_mm = override.filamentLen_mm;
      }

      const summary: EstimateSummary = {
        layers,
        volume: effectiveBreakdown.volumeModel_mm3,
        mass: effectiveBreakdown.mass_g,
        resinCost: effectiveBreakdown.costs.total,
        durationMinutes: effectiveBreakdown.time_s / 60,
      };

      set({
        layers,
        summary,
        estimateBreakdown: baseBreakdown,
        effectiveBreakdown,
        geometryPayload: {
          positions: refreshedPositions,
          positionsBuffer: refreshedPositionsBuffer,
          indices: refreshedIndices,
          indicesBuffer: refreshedIndicesBuffer,
          metrics: payload.metrics,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  async loadGcode(file: File) {
    set({ gcodeLoading: true, gcodeError: undefined });

    try {
      const fileName = file.name;
      const lowerName = fileName.toLowerCase();
      const isValidExtension =
        lowerName.endsWith('.gcode') || lowerName.endsWith('.gco') || lowerName.endsWith('.g');
      const isValidMime =
        !file.type ||
        file.type === 'text/plain' ||
        file.type === 'application/octet-stream' ||
        file.type === 'application/x-gcode';

      if (!isValidExtension && !isValidMime) {
        throw new Error('Selecione um arquivo G-code válido.');
      }

      let content: string;
      if (typeof file.text === 'function') {
        content = await file.text();
      } else if (typeof file.arrayBuffer === 'function') {
        const buffer = await file.arrayBuffer();
        content = new TextDecoder().decode(buffer);
      } else {
        throw new Error('Não foi possível ler o conteúdo do arquivo G-code.');
      }
      const estimate = parseAndEstimate(content);

      const override: GcodeOverrideState = {
        fileName,
        time_s: estimate.time_s,
        filamentLen_mm: estimate.filamentLen_mm,
        loadedAt: Date.now(),
      };

      set((state) => {
        const summary = state.summary
          ? {
              ...state.summary,
              durationMinutes: estimate.time_s / 60,
            }
          : state.summary;

        const effectiveBreakdown = state.estimateBreakdown
          ? {
              ...state.estimateBreakdown,
              costs: { ...state.estimateBreakdown.costs },
              params: state.estimateBreakdown.params,
              time_s: override.time_s,
              filamentLen_mm: override.filamentLen_mm,
            }
          : state.effectiveBreakdown
            ? {
                ...state.effectiveBreakdown,
                costs: { ...state.effectiveBreakdown.costs },
                params: state.effectiveBreakdown.params,
                time_s: override.time_s,
                filamentLen_mm: override.filamentLen_mm,
              }
            : undefined;

        return {
          gcodeOverride: override,
          gcodeLoading: false,
          gcodeError: undefined,
          summary,
          effectiveBreakdown,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar G-code.';
      set({ gcodeLoading: false, gcodeError: message });
    }
  },

  clearGcodeOverride() {
    set((state) => {
      const summary =
        state.summary && state.estimateBreakdown
          ? {
              ...state.summary,
              durationMinutes: state.estimateBreakdown.time_s / 60,
            }
          : state.summary;

      const effectiveBreakdown = state.estimateBreakdown
        ? {
            ...state.estimateBreakdown,
            costs: { ...state.estimateBreakdown.costs },
            params: state.estimateBreakdown.params,
          }
        : undefined;

      return {
        gcodeOverride: undefined,
        gcodeLoading: false,
        gcodeError: undefined,
        summary,
        effectiveBreakdown,
      };
    });
  },

  reset() {
    recomputeScheduler.cancel();
    set({
      geometry: undefined,
      layers: [],
      summary: undefined,
      fileName: undefined,
      geometryPayload: undefined,
      geometrySource: undefined,
      geometryMetrics: undefined,
      geometryCenter: undefined,
      estimateBreakdown: undefined,
      effectiveBreakdown: undefined,
      gcodeOverride: undefined,
      gcodeLoading: false,
      gcodeError: undefined,
    });
  },

  disposeWorkers() {
    releaseGeometryCompute();
    releaseEstimateCompute();
  },
}));
