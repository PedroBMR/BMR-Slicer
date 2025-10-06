'use client';

import { create } from 'zustand';

import type { EstimateBreakdown, Material, PrintParams } from './estimate';
import {
  getDatabase,
  type EstimateFileMeta,
  type EstimateRecord,
  type PresetRecord,
} from './db';

export type SavedEstimate = EstimateRecord & { id: number };
export type SavedPreset = PresetRecord & { id: number };

export interface SaveEstimateInput {
  name: string;
  material: Material;
  params: PrintParams;
  volume_mm3: number;
  results: EstimateBreakdown;
  presetId?: number | null;
  fileMeta?: EstimateFileMeta;
  createdAt?: string;
}

export interface SavePresetInput {
  name: string;
  params: Partial<PrintParams>;
}

interface SavedEstimatesState {
  estimates: SavedEstimate[];
  presets: SavedPreset[];
  loading: boolean;
  saving: boolean;
  presetsLoading: boolean;
  presetSaving: boolean;
  compareOpen: boolean;
  selectedIds: number[];
  initialized: boolean;
  error?: string;
  presetError?: string;
}

interface SavedEstimatesActions {
  loadEstimates: () => Promise<void>;
  saveEstimate: (input: SaveEstimateInput) => Promise<number | undefined>;
  deleteEstimate: (id: number) => Promise<void>;
  loadPresets: () => Promise<void>;
  savePreset: (input: SavePresetInput) => Promise<number | undefined>;
  updatePreset: (id: number, input: SavePresetInput) => Promise<void>;
  deletePreset: (id: number) => Promise<void>;
  setCompareOpen: (open: boolean) => void;
  toggleSelection: (id: number) => void;
  clearSelection: () => void;
  setSelection: (ids: Array<number | undefined>) => void;
}

export type SavedEstimatesStore = SavedEstimatesState & SavedEstimatesActions;

function normalizeSelection(ids: Array<number | undefined>) {
  return Array.from(new Set(ids.filter((value): value is number => typeof value === 'number')));
}

export const useSavedEstimatesStore = create<SavedEstimatesStore>((set, get) => ({
  estimates: [],
  presets: [],
  loading: false,
  saving: false,
  presetsLoading: false,
  presetSaving: false,
  compareOpen: false,
  selectedIds: [],
  initialized: false,
  error: undefined,
  presetError: undefined,

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
      const record: EstimateRecord = {
        createdAt: input.createdAt ?? new Date().toISOString(),
        name: input.name,
        material: input.material,
        params: input.params,
        volume_mm3: input.volume_mm3,
        results: input.results,
        presetId: input.presetId ?? null,
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
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a estimativa.';
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

  async loadPresets() {
    const db = getDatabase();
    if (!db) {
      set({ presets: [], presetsLoading: false, presetError: 'IndexedDB indisponível.' });
      return;
    }

    set({ presetsLoading: true, presetError: undefined });
    try {
      const rows = await db.presets.orderBy('createdAt').toArray();
      const normalized = rows.filter((row): row is SavedPreset => typeof row.id === 'number');
      set({ presets: normalized, presetsLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar presets salvos.';
      set({ presetsLoading: false, presetError: message });
    }
  },

  async savePreset(input) {
    const db = getDatabase();
    if (!db) {
      const message = 'Persistência local indisponível.';
      set({ presetError: message, presetSaving: false });
      return undefined;
    }

    set({ presetSaving: true, presetError: undefined });
    try {
      const timestamp = new Date().toISOString();
      const record: PresetRecord = {
        name: input.name,
        params: { ...input.params },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const id = await db.presets.add(record);
      const saved: SavedPreset = { ...record, id };

      set((state) => ({
        presets: [...state.presets, saved],
        presetSaving: false,
      }));

      return id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o preset.';
      set({ presetError: message, presetSaving: false });
      return undefined;
    }
  },

  async updatePreset(id, input) {
    const db = getDatabase();
    if (!db) {
      return;
    }

    const existing = get().presets.find((preset) => preset.id === id);
    if (!existing) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextParams = { ...existing.params, ...input.params };

    await db.presets.update(id, {
      name: input.name,
      params: nextParams,
      updatedAt,
    });

    set((state) => ({
      presets: state.presets.map((preset) =>
        preset.id === id ? { ...preset, name: input.name, params: nextParams, updatedAt } : preset,
      ),
    }));
  },

  async deletePreset(id) {
    const db = getDatabase();
    if (!db) {
      return;
    }

    await db.presets.delete(id);
    set((state) => ({ presets: state.presets.filter((preset) => preset.id !== id) }));
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
