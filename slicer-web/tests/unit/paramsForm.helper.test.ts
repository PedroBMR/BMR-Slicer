import { describe, expect, it } from 'vitest';

import { DEFAULT_PRINT_PARAMS, type EstimateBreakdown } from '../../lib/estimate';
import { mergeBreakdownWithOverride } from '../../components/ParamsForm';

describe('mergeBreakdownWithOverride', () => {
  it('applies override values without mutating the base breakdown', () => {
    const base: EstimateBreakdown = {
      volumeModel_mm3: 123,
      extrudedVolume_mm3: 150,
      mass_g: 20,
      filamentLen_mm: 45,
      time_s: 300,
      costs: {
        filament: 10,
        energy: 1,
        maintenance: 2,
        margin: 3,
        total: 16,
      },
      params: DEFAULT_PRINT_PARAMS,
    };

    const snapshot = JSON.parse(JSON.stringify(base));
    const override = { time_s: 900, filamentLen_mm: 99 };

    const merged = mergeBreakdownWithOverride(base, override);

    expect(merged).not.toBeNull();
    expect(merged).not.toBe(base);
    expect(merged?.time_s).toBe(900);
    expect(merged?.filamentLen_mm).toBe(99);
    expect(base).toEqual(snapshot);
  });

  it('returns a cloned copy when no override is provided', () => {
    const base: EstimateBreakdown = {
      volumeModel_mm3: 10,
      extrudedVolume_mm3: 12,
      mass_g: 3,
      filamentLen_mm: 4,
      time_s: 120,
      costs: {
        filament: 1,
        energy: 0.5,
        maintenance: 0.25,
        margin: 0.1,
        total: 1.85,
      },
      params: DEFAULT_PRINT_PARAMS,
    };

    const merged = mergeBreakdownWithOverride(base, null);

    expect(merged).not.toBeNull();
    expect(merged).not.toBe(base);
    expect(merged).toEqual(base);
  });
});
