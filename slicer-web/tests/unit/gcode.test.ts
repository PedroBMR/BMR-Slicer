import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAndEstimate } from '../../lib/gcode';

describe('gcode parsing helpers', () => {
  it('estimates time and filament from the tiny square fixture', () => {
    const fixturePath = resolve(__dirname, '../fixtures/tiny-square.gcode');
    const gcode = readFileSync(fixturePath, 'utf-8');
    const result = parseAndEstimate(gcode);

    expect(result.filamentLen_mm).toBeCloseTo(2.6, 5);
    expect(result.time_s).toBeCloseTo(3.3733333333, 6);
  });

  it('handles inline G92 resets and missing feed rates defensively', () => {
    const inlineSample = `
      g90 ; absolute positioning
      m83 ; relative extrusion
      g1 x1 e0.1 ; missing feed rate should not contribute to time
      g1 f1200
      g1 x2 e0.2 ; feed now defined
      g92 e5 ; reset extruder to 5mm
      g1 e-1 ; negative extrusion should not count
    `;

    const result = parseAndEstimate(inlineSample);

    expect(result.filamentLen_mm).toBeCloseTo(0.3, 5);
    expect(result.time_s).toBeCloseTo(0.05, 6);
  });
});
