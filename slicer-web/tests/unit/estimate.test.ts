import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  DEFAULT_PARAMETERS,
  estimatePrint,
  generateLayers,
  integrateLayers,
  type EstimateParameters,
} from '../../modules/estimate';

function createCube(size = 1) {
  const half = size / 2;
  const vertices = new Float32Array([
    -half,
    -half,
    -half,
    half,
    -half,
    -half,
    half,
    half,
    -half,
    -half,
    half,
    -half,
    -half,
    -half,
    half,
    half,
    -half,
    half,
    half,
    half,
    half,
    -half,
    half,
    half,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 0, 3, 7, 0, 7, 4, 1, 2,
    6, 1, 6, 5,
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
    const layers = generateLayers(geometry, {
      parameters: { ...DEFAULT_PARAMETERS, layerHeight: 1 },
    });
    expect(layers.length).toBeGreaterThan(0);
    const centroids = layers.map((layer) => layer.centroid.length());
    expect(Math.max(...centroids)).toBeGreaterThan(0);
  });

  it('generates layers for orientations with negative components', () => {
    const geometry = createCube(10);
    const orientation = new Vector3(1, -1, 0).normalize();
    const layers = generateLayers(geometry, {
      orientation,
      parameters: { ...DEFAULT_PARAMETERS, layerHeight: 1 },
    });

    expect(layers.length).toBeGreaterThan(10);
    const elevations = layers.map((layer) => layer.elevation);
    expect(Math.max(...elevations)).toBeGreaterThan(10);
  });

  it('estimates print metrics with reasonable numbers', () => {
    const geometry = createCube(10);
    const summary = estimatePrint(geometry, {
      parameters: { ...DEFAULT_PARAMETERS, layerHeight: 1 },
    });
    expect(summary.layers.length).toBeGreaterThan(0);
    expect(summary.volume).toBeGreaterThan(0);
    expect(summary.mass).toBeGreaterThan(0);
  });

  it('throws when parameters are invalid', () => {
    const geometry = createCube(10);
    const invalidParameters = {
      ...DEFAULT_PARAMETERS,
      layerHeight: -1,
    } as unknown as EstimateParameters;

    expect(() => generateLayers(geometry, { parameters: invalidParameters })).toThrowError(
      ZodError,
    );
  });

  it('throws when layer data fails validation', () => {
    const geometry = createCube(10);
    const layers = generateLayers(geometry, {
      parameters: { ...DEFAULT_PARAMETERS, layerHeight: 1 },
    });
    const invalidLayers = layers.map((layer, index) =>
      index === 0
        ? {
            ...layer,
            area: -1,
          }
        : layer,
    );

    expect(() => integrateLayers(invalidLayers, DEFAULT_PARAMETERS)).toThrowError(ZodError);
  });
});
