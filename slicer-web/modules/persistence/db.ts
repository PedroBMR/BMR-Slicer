import Dexie, { type Table } from 'dexie';

import type { EstimateBreakdown, Material, PrintParams } from '../../lib/estimate';

export interface EstimateFileMeta {
  name: string;
  size?: number;
  type?: string;
}

export interface EstimateRow {
  id?: number;
  createdAt: string;
  name: string;
  material: Material;
  params: PrintParams;
  volume_mm3: number;
  results: EstimateBreakdown;
  fileMeta?: EstimateFileMeta;
}

export interface PresetRow {
  id?: number;
  name: string;
  params: Partial<PrintParams>;
}

class SlicerDatabase extends Dexie {
  estimates!: Table<EstimateRow, number>;
  presets!: Table<PresetRow, number>;

  constructor() {
    super('bmr-slicer');
    this.version(1).stores({
      estimates: '++id, createdAt, name, material',
      presets: '++id, name',
    });
  }
}

let database: SlicerDatabase | null = null;

export function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  if (!database) {
    database = new SlicerDatabase();
  }
  return database;
}
