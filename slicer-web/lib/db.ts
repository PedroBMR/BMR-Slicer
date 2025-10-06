import Dexie, { type Table } from 'dexie';

import type { EstimateBreakdown, Material, PrintParams } from './estimate';

export interface EstimateFileMeta {
  name: string;
  size?: number;
  type?: string;
}

export interface EstimateRecord {
  id?: number;
  createdAt: string;
  name: string;
  material: Material;
  params: PrintParams;
  volume_mm3: number;
  results: EstimateBreakdown;
  presetId: number | null;
  fileMeta?: EstimateFileMeta;
}

export interface PresetRecord {
  id?: number;
  name: string;
  params: Partial<PrintParams>;
  createdAt: string;
  updatedAt: string;
}

class SlicerDatabase extends Dexie {
  estimates!: Table<EstimateRecord, number>;
  presets!: Table<PresetRecord, number>;

  constructor() {
    super('bmr-slicer');

    this.version(1).stores({
      estimates: '++id, createdAt, name, material',
      presets: '++id, name',
    });

    this.version(2)
      .stores({
        estimates: '++id, createdAt, name, material, presetId',
        presets: '++id, name',
      })
      .upgrade((transaction) => {
        return transaction
          .table<EstimateRecord>('estimates')
          .toCollection()
          .modify((row) => {
            if (row.presetId === undefined) {
              row.presetId = null;
            }
          });
      });
  }
}

let database: SlicerDatabase | null = null;

export function getDatabase(): SlicerDatabase | null {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  if (!database) {
    database = new SlicerDatabase();
  }

  return database;
}
