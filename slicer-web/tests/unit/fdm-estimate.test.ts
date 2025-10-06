import { describe, expect, it } from 'vitest';

import { DEFAULT_PRINT_PARAMS, estimateAll } from '../../lib/estimate';

describe('fdm estimate calculations', () => {
  it('returns deterministic results for default parameters and known volume', () => {
    const volumeModel_mm3 = 10_000;
    const breakdown = estimateAll(volumeModel_mm3);

    expect(breakdown.volumeModel_mm3).toBe(volumeModel_mm3);
    expect(breakdown.extrudedVolume_mm3).toBeCloseTo(6_000, 5);
    expect(breakdown.mass_g).toBeCloseTo(7.44, 5);
    expect(breakdown.filamentLen_mm).toBeCloseTo(2_494.51, 2);
    expect(breakdown.time_s).toBeCloseTo(690, 5);
    expect(breakdown.costs.filament).toBeCloseTo(0.186, 5);
    expect(breakdown.costs.energy).toBeCloseTo(0.00276, 5);
    expect(breakdown.costs.maintenance).toBeCloseTo(0.38333, 5);
    expect(breakdown.costs.margin).toBeCloseTo(0.1144187, 4);
    expect(breakdown.costs.total).toBeCloseTo(0.686512, 6);
  });

  it('clamps the effective flow rate when the requested print speed exceeds the mvf limit', () => {
    const volumeModel_mm3 = 10_000;
    const excessiveFlowParams = {
      targetFlow_mm3_s: 100,
      mvf: DEFAULT_PRINT_PARAMS.mvf,
      overhead: 0,
    } as const;

    const breakdown = estimateAll(volumeModel_mm3, excessiveFlowParams);
    const expectedExtrudedVolume =
      volumeModel_mm3 *
      (DEFAULT_PRINT_PARAMS.infill +
        DEFAULT_PRINT_PARAMS.wallFactor +
        DEFAULT_PRINT_PARAMS.topBottomFactor);
    const expectedTime = expectedExtrudedVolume / DEFAULT_PRINT_PARAMS.mvf;

    expect(breakdown.params.targetFlow_mm3_s).toBe(excessiveFlowParams.targetFlow_mm3_s);
    expect(breakdown.params.mvf).toBe(DEFAULT_PRINT_PARAMS.mvf);
    expect(breakdown.time_s).toBeCloseTo(expectedTime, 5);
  });

  it('inflates the computed time when overhead is applied', () => {
    const volumeModel_mm3 = 10_000;
    const baseParams = {
      targetFlow_mm3_s: DEFAULT_PRINT_PARAMS.targetFlow_mm3_s,
      mvf: DEFAULT_PRINT_PARAMS.mvf,
      overhead: 0,
    } as const;

    const baseline = estimateAll(volumeModel_mm3, baseParams);
    const withOverhead = estimateAll(volumeModel_mm3, { ...baseParams, overhead: 0.5 });

    expect(baseline.time_s).toBeGreaterThan(0);
    expect(withOverhead.time_s).toBeGreaterThan(baseline.time_s);
    expect(withOverhead.time_s).toBeCloseTo(baseline.time_s * 1.5, 5);
  });
});
