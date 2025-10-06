'use client';

import { create } from 'zustand';

import type { EstimateBreakdown, Material, PrintParams } from '../../lib/estimate';
import { getDatabase, type EstimateFileMeta, type EstimateRow } from './db';

export type SavedEstimate = EstimateRow & { id: number };

export interface SaveEstimateInput {
  name: string;
  material: Material;
  params: PrintParams;
  volume_mm3: number;
  results: EstimateBreakdown;
  fileMeta?: EstimateFileMeta;
}

interface SavedEstimatesState {
  estimates: SavedEstimate[];
  loading: boolean;
  saving: boolean;
  compareOpen: boolean;
  selectedIds: number[];
  initialized: boolean;
  error?: string;
}

interface SavedEstimatesActions {
  loadEstimates: () => Promise<void>;
  saveEstimate: (input: SaveEstimateInput) => Promise<number | undefined>;
  deleteEstimate: (id: number) => Promise<void>;
  setCompareOpen: (open: boolean) => void;
  toggleSelection: (id: number) => void;
  clearSelection: () => void;
  setSelection: (ids: Array<number | undefined>) => void;
}

export type SavedEstimatesStore = SavedEstimatesState & SavedEstimatesActions;

function normalizeSelection(ids: Array<number | undefined>) {
  return Array.from(new Set(ids.filter((value): value is number => typeof value === 'number')));
}

export const useSavedEstimatesStore = create<SavedEstimatesStore>((set) => ({
  estimates: [],
  loading: false,
  saving: false,
  compareOpen: false,
  selectedIds: [],
  initialized: false,
  error: undefined,

  async loadEstimates() {
    const db = getDatabase();
    if (!db) {
      set({
        estimates: [],
        loading: false,
        initialized: true,
        error: 'IndexedDB indisponível no navegador atual.',
      });
      return;
    }

    set({ loading: true, error: undefined });
    try {
      const rows = await db.estimates.orderBy('createdAt').reverse().toArray();
      const normalized = rows.filter((row): row is SavedEstimate => typeof row.id === 'number');
      const availableIds = new Set(normalized.map((row) => row.id));

      set((state) => ({
        estimates: normalized,
        loading: false,
        initialized: true,
        selectedIds: state.selectedIds.filter((id) => availableIds.has(id)),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao carregar histórico de estimativas.';
      set({ loading: false, error: message });
    }
  },

  async saveEstimate(input) {
    const db = getDatabase();
    if (!db) {
      const message = 'Persistência local indisponível.';
      set({ error: message, saving: false });
      return undefined;
    }

    set({ saving: true, error: undefined });
    try {
      const record: EstimateRow = {
        createdAt: new Date().toISOString(),
        name: input.name,
        material: input.material,
        params: input.params,
        volume_mm3: input.volume_mm3,
        results: input.results,
        fileMeta: input.fileMeta,
      };

      const id = await db.estimates.add(record);
      const saved: SavedEstimate = { ...record, id };

      set((state) => ({
        estimates: [saved, ...state.estimates],
        saving: false,
        initialized: true,
      }));

      return id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível salvar a estimativa.';
      set({ error: message, saving: false });
      return undefined;
    }
  },

  async deleteEstimate(id) {
    const db = getDatabase();
    if (!db) {
      return;
    }

    await db.estimates.delete(id);
    set((state) => ({
      estimates: state.estimates.filter((estimate) => estimate.id !== id),
      selectedIds: state.selectedIds.filter((selected) => selected !== id),
    }));
  },

  setCompareOpen(open) {
    set({ compareOpen: open });
  },

  toggleSelection(id) {
    set((state) => {
      const selected = state.selectedIds.includes(id)
        ? state.selectedIds.filter((value) => value !== id)
        : [...state.selectedIds, id];
      return { selectedIds: selected };
    });
  },

  clearSelection() {
    set({ selectedIds: [] });
  },

  setSelection(ids) {
    set({ selectedIds: normalizeSelection(ids) });
  },
}));
