'use client';

import { create } from 'zustand';
import { BufferGeometry } from 'three';

import type { EstimateParameters, EstimateSummary, LayerEstimate } from '../estimate';
import { DEFAULT_PARAMETERS, generateLayers, integrateLayers } from '../estimate';
import { loadGeometryFromFile } from '../geometry';
import { loadRecentEstimates, saveEstimate, type EstimateRecord } from './persistence';

export interface ViewerStoreState {
  geometry?: BufferGeometry;
  layers: LayerEstimate[];
  summary?: EstimateSummary;
  parameters: EstimateParameters;
  loading: boolean;
  error?: string;
  fileName?: string;
  history: EstimateRecord[];
}

export interface ViewerStoreActions {
  loadFile: (file: File) => Promise<void>;
  setGeometry: (geometry: BufferGeometry, fileName?: string) => void;
  setParameters: (parameters: Partial<EstimateParameters>) => void;
  recompute: () => void;
  reset: () => void;
  refreshHistory: () => Promise<void>;
}

export type ViewerStore = ViewerStoreState & ViewerStoreActions;

export const useViewerStore = create<ViewerStore>((set, get) => ({
  layers: [],
  parameters: DEFAULT_PARAMETERS,
  loading: false,
  history: [],

  async loadFile(file: File) {
    set({ loading: true, error: undefined });
    try {
      const geometry = await loadGeometryFromFile(file);
      get().setGeometry(geometry, file.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  setGeometry(geometry: BufferGeometry, fileName?: string) {
    const parameters = get().parameters;
    const layers = generateLayers(geometry, { parameters });
    const summary = integrateLayers(layers, parameters);
    set({ geometry, layers, summary, fileName });
    if (summary) {
      const operation = saveEstimate({
        fileName: fileName ?? 'untitled-mesh',
        createdAt: new Date().toISOString(),
        summary: {
          volume: summary.volume,
          mass: summary.mass,
          resinCost: summary.resinCost,
          durationMinutes: summary.durationMinutes,
          layers: summary.layers.length
        }
      });
      if (operation) {
        void operation.then(() => get().refreshHistory());
      }
    }
  },

  setParameters(parameters: Partial<EstimateParameters>) {
    const next = { ...get().parameters, ...parameters };
    set({ parameters: next });
    if (get().geometry) {
      const layers = generateLayers(get().geometry as BufferGeometry, { parameters: next });
      const summary = integrateLayers(layers, next);
      set({ layers, summary });
    }
  },

  recompute() {
    const geometry = get().geometry;
    if (!geometry) {
      return;
    }
    const layers = generateLayers(geometry, { parameters: get().parameters });
    const summary = integrateLayers(layers, get().parameters);
    set({ layers, summary });
  },

  reset() {
    set({ geometry: undefined, layers: [], summary: undefined, fileName: undefined });
  },

  async refreshHistory() {
    if (typeof window === 'undefined') {
      return;
    }
    const history = await loadRecentEstimates();
    set({ history });
  }
}));
