import Dexie, { type Table } from 'dexie';

export interface EstimateRecord {
  id?: number;
  fileName: string;
  createdAt: string;
  summary: {
    volume: number;
    mass: number;
    resinCost: number;
    durationMinutes: number;
    layers: number;
  };
}

class SlicerDatabase extends Dexie {
  estimates!: Table<EstimateRecord>;

  constructor() {
    super('bmr-slicer');
    this.version(1).stores({
      estimates: '++id, fileName, createdAt'
    });
  }
}

let database: SlicerDatabase | undefined;

function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    return undefined;
  }
  if (!database) {
    database = new SlicerDatabase();
  }
  return database;
}

export async function saveEstimate(record: EstimateRecord) {
  const db = getDatabase();
  if (!db) {
    return undefined;
  }
  return db.estimates.add(record);
}

export async function loadRecentEstimates(limit = 5) {
  const db = getDatabase();
  if (!db) {
    return [] as EstimateRecord[];
  }
  return db.estimates.orderBy('createdAt').reverse().limit(limit).toArray();
}
