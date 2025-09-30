import { BufferGeometry, Float32BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';

import { DEFAULT_PARAMETERS, estimatePrint, generateLayers } from '../../modules/estimate';

function createCube(size = 1) {
  const half = size / 2;
  const vertices = new Float32Array([
    -half, -half, -half,
    half, -half, -half,
    half, half, -half,
    -half, half, -half,
    -half, -half, half,
    half, -half, half,
    half, half, half,
    -half, half, half
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6,
    0, 3, 7, 0, 7, 4,
    1, 2, 6, 1, 6, 5
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

describe('estimate module', () => {
  it('generates layers for a cube aligned to Z axis', () => {
    const geometry = createCube(10);
    const layers = generateLayers(geometry, { parameters: { ...DEFAULT_PARAMETERS, layerHeight: 1 } });
    expect(layers.length).toBeGreaterThan(0);
    const centroids = layers.map((layer) => layer.centroid.length());
    expect(Math.max(...centroids)).toBeGreaterThan(0);
  });

  it('estimates print metrics with reasonable numbers', () => {
    const geometry = createCube(10);
    const summary = estimatePrint(geometry, { parameters: { ...DEFAULT_PARAMETERS, layerHeight: 1 } });
    expect(summary.layers.length).toBeGreaterThan(0);
    expect(summary.volume).toBeGreaterThan(0);
    expect(summary.mass).toBeGreaterThan(0);
  });
});
