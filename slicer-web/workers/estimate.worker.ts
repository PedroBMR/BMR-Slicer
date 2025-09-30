import { expose } from 'comlink';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';

import type { EstimateParameters } from '../modules/estimate';
import { DEFAULT_PARAMETERS, generateLayers, integrateLayers } from '../modules/estimate';

export interface EstimateWorkerRequest {
  positions: ArrayBuffer;
  indices?: ArrayBuffer;
  parameters?: EstimateParameters;
}

export interface EstimateWorkerResponse {
  summary: {
    volume: number;
    mass: number;
    resinCost: number;
    durationMinutes: number;
    layers: number;
  };
  layers: Array<{
    elevation: number;
    area: number;
    centroid: [number, number, number];
    circumference: number;
    boundingRadius: number;
  }>;
}

function geometryFromPayload(payload: EstimateWorkerRequest): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(payload.positions), 3));
  if (payload.indices) {
    geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(payload.indices), 1));
  }
  return geometry;
}

const api = {
  estimate(payload: EstimateWorkerRequest): EstimateWorkerResponse {
    const geometry = geometryFromPayload(payload);
    const parameters = payload.parameters ?? DEFAULT_PARAMETERS;
    const layers = generateLayers(geometry, { parameters, orientation: new Vector3(0, 0, 1) });
    const summary = integrateLayers(layers, parameters);

    return {
      summary: {
        volume: summary.volume,
        mass: summary.mass,
        resinCost: summary.resinCost,
        durationMinutes: summary.durationMinutes,
        layers: summary.layers.length
      },
      layers: summary.layers.map((layer) => ({
        elevation: layer.elevation,
        area: layer.area,
        centroid: layer.centroid.toArray() as [number, number, number],
        circumference: layer.circumference,
        boundingRadius: layer.boundingRadius
      }))
    };
  }
};

export type EstimateWorkerApi = typeof api;

expose(api);
