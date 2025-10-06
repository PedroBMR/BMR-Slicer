import { describe, expect, it } from 'vitest';

import { MATERIAL_DENSITIES, estimateAll } from '../../lib/estimate';

describe('estimate engine integrity checks', () => {
  it('computes consistent mass, time, and cost breakdowns for default PLA params', () => {
    const volumeModel_mm3 = 100_000;

    const breakdown = estimateAll(volumeModel_mm3, { material: 'PLA' });
    const params = breakdown.params;

    const volumeFactors = params.infill + params.wallFactor + params.topBottomFactor;
    const expectedExtrudedVolume = volumeModel_mm3 * volumeFactors;

    // Mass validation
    const density = MATERIAL_DENSITIES[params.material];
    const expectedMass_g = (expectedExtrudedVolume / 1000) * density;
    const massTolerance = expectedMass_g * 0.01; // ±1%
    expect(Math.abs(breakdown.mass_g - expectedMass_g)).toBeLessThanOrEqual(massTolerance);

    // Time validation
    const effectiveFlow = Math.min(params.targetFlow_mm3_s, params.mvf);
    const baselineTime = effectiveFlow > 0 ? expectedExtrudedVolume / effectiveFlow : 0;
    const expectedTime_s = baselineTime * (1 + params.overhead);
    expect(breakdown.time_s).toBeCloseTo(expectedTime_s, 6);

    // Cost breakdown validation
    const massKg = expectedMass_g / 1000;
    const filamentCost = massKg * params.pricePerKg;
    const time_h = expectedTime_s / 3600;
    const energyKwh = (params.powerW / 1000) * time_h;
    const energyCost = energyKwh * params.kwhPrice;
    const maintenanceCost = time_h * params.maintPerHour;
    const subtotal = filamentCost + energyCost + maintenanceCost;
    const marginCost = subtotal * params.margin;
    const expectedTotal = subtotal + marginCost;

    expect(breakdown.costs.filament).toBeGreaterThan(0);
    expect(breakdown.costs.energy).toBeGreaterThan(0);
    expect(breakdown.costs.maintenance).toBeGreaterThan(0);
    expect(breakdown.costs.margin).toBeGreaterThan(0);
    expect(breakdown.costs.total).toBeGreaterThan(0);

    expect(breakdown.costs.filament).toBeCloseTo(filamentCost, 6);
    expect(breakdown.costs.energy).toBeCloseTo(energyCost, 6);
    expect(breakdown.costs.maintenance).toBeCloseTo(maintenanceCost, 6);
    expect(breakdown.costs.margin).toBeCloseTo(marginCost, 6);
    expect(breakdown.costs.total).toBeCloseTo(expectedTotal, 6);

    const summedCosts =
      breakdown.costs.filament +
      breakdown.costs.energy +
      breakdown.costs.maintenance +
      breakdown.costs.margin;
    expect(breakdown.costs.total).toBeCloseTo(summedCosts, 6);
  });
});
