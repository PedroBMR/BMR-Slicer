import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { saveEstimate } from '../../modules/store/persistence';

describe('estimate persistence validation', () => {
  it('rejects records that fail validation', () => {
    expect(() =>
      saveEstimate({
        fileName: '',
        createdAt: 'not-a-date',
        summary: {
          volume: -1,
          mass: 0,
          resinCost: 0,
          durationMinutes: 0,
          layers: -1
        }
      } as any)
    ).toThrowError(ZodError);
  });

  it('resolves when data is valid even without indexedDB', async () => {
    await expect(
      saveEstimate({
        fileName: 'cube.stl',
        createdAt: new Date().toISOString(),
        summary: {
          volume: 1,
          mass: 1,
          resinCost: 1,
          durationMinutes: 1,
          layers: 1
        }
      })
    ).resolves.toBeUndefined();
  });
});
