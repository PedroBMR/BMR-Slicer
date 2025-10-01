import { expose } from 'comlink';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import { BufferGeometryUtils, STLLoader, ThreeMFLoader } from 'three-stdlib';

const THREE_MF_MIME_TYPES = new Set([
  'model/3mf',
  'application/vnd.ms-3mfdocument',
  'application/vnd.ms-package.3dmanufacturing-3dmodel'
]);

import { getMeshStatistics, sliceGeometry } from '../modules/geometry';
import { generateLayers, type EstimateParameters } from '../modules/estimate';

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

export interface GenerateLayersRequest {
  positions: ArrayBuffer;
  indices?: ArrayBuffer;
  parameters: EstimateParameters;
}

export interface GenerateLayersResponse {
  layers: Array<{
    elevation: number;
    area: number;
    circumference: number;
    boundingRadius: number;
    centroid: [number, number, number];
    segments: Array<{ start: [number, number, number]; end: [number, number, number] }>;
  }>;
}

export interface ParseMeshRequest {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType?: string;
}

export interface ParseMeshResponse {
  positions: Float32Array;
  indices?: Uint32Array;
  statistics: {
    vertexCount: number;
    faceCount: number;
    boundingBox: { min: [number, number, number]; max: [number, number, number] };
  };
}

function createGeometryFromLoader(buffer: ArrayBuffer, request: ParseMeshRequest): BufferGeometry {
  const identifier = request.fileName.toLowerCase();
  const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  const isThreeMF =
    identifier.endsWith('.3mf') ||
    (request.mimeType && THREE_MF_MIME_TYPES.has(request.mimeType)) ||
    (signature.length === 4 &&
      signature[0] === 0x50 &&
      signature[1] === 0x4b &&
      signature[2] === 0x03 &&
      signature[3] === 0x04);

  if (isThreeMF) {
    const loader = new ThreeMFLoader();
    const object = loader.parse(buffer);
    const geometries: BufferGeometry[] = [];
    object.traverse((child: unknown) => {
      if ((child as { isMesh?: boolean; geometry?: BufferGeometry }).isMesh) {
        const mesh = child as { geometry: BufferGeometry };
        geometries.push(mesh.geometry.clone());
      }
    });

    if (geometries.length > 0) {
      const merged = geometries.length === 1
        ? geometries[0]
        : BufferGeometryUtils.mergeGeometries(geometries, true);
      if (!merged) {
        throw new Error('Unable to merge 3MF mesh data.');
      }
      merged.computeVertexNormals();
      return merged;
    }
    throw new Error('Unable to parse 3MF file. No mesh data found.');
  }

  const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();
  return geometry;
}

function toParseResponse(geometry: BufferGeometry): ParseMeshResponse {
  const position = geometry.getAttribute('position');
  if (!position) {
    throw new Error('Geometry is missing position data.');
  }

  const positions = new Float32Array(position.array as ArrayLike<number>);
  const index = geometry.getIndex();
  const indices = index ? new Uint32Array(index.array as ArrayLike<number>) : undefined;

  const stats = getMeshStatistics(geometry);

  return {
    positions,
    indices,
    statistics: {
      vertexCount: stats.vertexCount,
      faceCount: stats.faceCount,
      boundingBox: {
        min: stats.boundingBox.min.toArray() as [number, number, number],
        max: stats.boundingBox.max.toArray() as [number, number, number]
      }
    }
  };
}

function toGeometry(payload: SliceWorkerRequest | GenerateLayersRequest): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(payload.positions), 3));
  if (payload.indices) {
    geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(payload.indices), 1));
  }
  return geometry;
}

const api = {
  parseMesh(payload: ParseMeshRequest): ParseMeshResponse {
    const geometry = createGeometryFromLoader(payload.buffer, payload);
    return toParseResponse(geometry);
  },
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
  },
  generateLayers(payload: GenerateLayersRequest): GenerateLayersResponse {
    const geometry = toGeometry(payload);
    const layers = generateLayers(geometry, { parameters: payload.parameters });

    return {
      layers: layers.map((layer) => ({
        elevation: layer.elevation,
        area: layer.area,
        circumference: layer.circumference,
        boundingRadius: layer.boundingRadius,
        centroid: layer.centroid.toArray() as [number, number, number],
        segments: layer.segments.map((segment) => ({
          start: segment.start.toArray() as [number, number, number],
          end: segment.end.toArray() as [number, number, number]
        }))
      }))
    };
  }
};

export type GeometryWorkerApi = typeof api;

expose(api);
