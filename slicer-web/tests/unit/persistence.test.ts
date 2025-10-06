import { describe, expect, it } from 'vitest';

import { DEFAULT_PRINT_PARAMS, type EstimateBreakdown } from '../../lib/estimate';
import { useSavedEstimatesStore } from '../../modules/persistence/store';

describe('saved estimates store without IndexedDB', () => {
  it('reports an error when persistence is unavailable', async () => {
    const breakdown: EstimateBreakdown = {
      volumeModel_mm3: 120,
      extrudedVolume_mm3: 150,
      mass_g: 12,
      filamentLen_mm: 3200,
      time_s: 3600,
      costs: {
        filament: 5,
        energy: 2,
        maintenance: 1,
        margin: 2,
        total: 10,
      },
      params: DEFAULT_PRINT_PARAMS,
    };

    const result = await useSavedEstimatesStore.getState().saveEstimate({
      name: 'Cube',
      material: DEFAULT_PRINT_PARAMS.material,
      params: DEFAULT_PRINT_PARAMS,
      volume_mm3: breakdown.volumeModel_mm3,
      results: breakdown,
    });

    expect(result).toBeUndefined();
    expect(useSavedEstimatesStore.getState().error).toContain('Persistência local indisponível');
  });
});
