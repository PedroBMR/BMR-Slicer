import Dexie, { type Table } from 'dexie';
import { z } from 'zod';

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

export const EstimateRecordSchema = z.object({
  id: z.number().int().nonnegative().optional(),
  fileName: z.string().min(1),
  createdAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'createdAt must be an ISO date' }),
  summary: z.object({
    volume: z.number().nonnegative(),
    mass: z.number().nonnegative(),
    resinCost: z.number().nonnegative(),
    durationMinutes: z.number().nonnegative(),
    layers: z.number().int().nonnegative()
  })
});

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

export function saveEstimate(record: EstimateRecord) {
  const parsedRecord = EstimateRecordSchema.parse(record);
  const db = getDatabase();
  if (!db) {
    return Promise.resolve(undefined);
  }
  return db.estimates.add(parsedRecord as EstimateRecord);
}

export async function loadRecentEstimates(limit = 5) {
  const db = getDatabase();
  if (!db) {
    return [] as EstimateRecord[];
  }
  return db.estimates.orderBy('createdAt').reverse().limit(limit).toArray();
}
