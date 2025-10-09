import { describe, expect, it } from 'vitest';

import { parseAndEstimate } from '../../lib/gcode';

describe('parseAndEstimate', () => {
  it('computes time and filament for absolute positioning with extrusion', () => {
    const content = `
      ; Simple square perimeter
      G90 ; absolute positioning
      M82 ; absolute extrusion
      G1 X10 Y0 F1200
      G1 X10 Y10 E1
      G1 X0 Y10 E2 F600
      G1 X0 Y0
    `;

    const estimate = parseAndEstimate(content);

    expect(estimate.time_s).toBeCloseTo(3, 4);
    expect(estimate.filamentLen_mm).toBeCloseTo(2, 4);
    expect(estimate.extrusionDistance_mm).toBeCloseTo(20, 4);
    expect(estimate.travelDistance_mm).toBeCloseTo(20, 4);
  });

  it('supports relative moves and extrusion, ignoring retractions for filament total', () => {
    const content = `
      G91 ; relative positioning
      M83 ; relative extrusion
      G1 X10 F1200
      G1 Y10 E0.5
      G1 X-10 E0.5
      G1 Y-10 E-0.2 ; retraction should not add filament
    `;

    const estimate = parseAndEstimate(content);

    expect(estimate.time_s).toBeCloseTo(2, 4);
    expect(estimate.filamentLen_mm).toBeCloseTo(1, 4);
    expect(estimate.extrusionDistance_mm).toBeCloseTo(20, 4);
    expect(estimate.travelDistance_mm).toBeCloseTo(20, 4);
  });

  it('honors G92 resets for the extruder when using absolute extrusion', () => {
    const content = `
      G90
      M82
      G92 E0
      G1 X0 Y0 F600
      G1 X10 E5
      G92 E0
      G1 X20 E4
    `;

    const estimate = parseAndEstimate(content);

    expect(estimate.time_s).toBeCloseTo(2, 4);
    expect(estimate.filamentLen_mm).toBeCloseTo(9, 4);
    expect(estimate.extrusionDistance_mm).toBeCloseTo(20, 4);
    expect(estimate.travelDistance_mm).toBeCloseTo(0, 4);
  });
});
