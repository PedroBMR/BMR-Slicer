import { describe, expect, it } from 'vitest';
import { CylinderGeometry, Vector3 } from 'three';

import { sliceGeometry } from '../../modules/geometry';

describe('geometry slicing', () => {
  it('computes accurate area for slices with high segment counts', () => {
    const radius = 10;
    const radialSegments = 128;
    const geometry = new CylinderGeometry(radius, radius, 2, radialSegments, 1, false);

    const summary = sliceGeometry(geometry, {
      origin: new Vector3(0, 0, 0),
      normal: new Vector3(0, 1, 0)
    });

    const expectedArea = Math.PI * radius * radius;

    expect(summary.segments.length).toBeGreaterThan(64);
    expect(summary.area).toBeCloseTo(expectedArea, 0);

    geometry.dispose();
  });
});
