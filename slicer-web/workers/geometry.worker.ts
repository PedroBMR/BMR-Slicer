import { expose } from 'comlink';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';

import { sliceGeometry } from '../modules/geometry';

export interface SliceWorkerRequest {
  positions: ArrayBuffer;
  indices?: ArrayBuffer;
  origin: [number, number, number];
  normal: [number, number, number];
  thickness?: number;
}

export interface SliceWorkerResponse {
  segments: Array<{ start: [number, number, number]; end: [number, number, number] }>;
  centroid: [number, number, number];
  area: number;
  boundingRadius: number;
}

function toGeometry(payload: SliceWorkerRequest): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(payload.positions), 3));
  if (payload.indices) {
    geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(payload.indices), 1));
  }
  return geometry;
}

const api = {
  slice(payload: SliceWorkerRequest): SliceWorkerResponse {
    const geometry = toGeometry(payload);
    const summary = sliceGeometry(geometry, {
      origin: new Vector3(...payload.origin),
      normal: new Vector3(...payload.normal),
      thickness: payload.thickness
    });

    return {
      segments: summary.segments.map((segment) => ({
        start: segment.start.toArray() as [number, number, number],
        end: segment.end.toArray() as [number, number, number]
      })),
      centroid: summary.centroid.toArray() as [number, number, number],
      area: summary.area,
      boundingRadius: summary.boundingRadius
    };
  }
};

export type GeometryWorkerApi = typeof api;

expose(api);
