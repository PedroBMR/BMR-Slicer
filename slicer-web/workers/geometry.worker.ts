import { expose, transfer } from 'comlink';
import { unzipSync } from 'fflate';
import { Box3, BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import { BufferGeometryUtils, STLLoader, ThreeMFLoader } from 'three-stdlib';

const THREE_MF_MIME_TYPES = new Set([
  'model/3mf',
  'application/vnd.ms-3mfdocument',
  'application/vnd.ms-package.3dmanufacturing-3dmodel'
]);

const THREE_MF_UNITS_TO_MM: Record<string, number> = {
  micron: 0.001,
  micrometer: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000
};

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

export interface AnalyzeGeometryRequest {
  buffer?: ArrayBuffer;
  positions?: ArrayBuffer;
  indices?: ArrayBuffer;
  fileName?: string;
  mimeType?: string;
}

export interface GeometryMetrics {
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  size: [number, number, number];
  triangleCount: number;
  volume: { signed: number; absolute: number };
  center: [number, number, number];
}

export interface AnalyzeGeometryResponse {
  positions: ArrayBuffer;
  indices?: ArrayBuffer;
  metrics: GeometryMetrics;
}

function detectThreeMf(buffer: ArrayBuffer, fileName?: string, mimeType?: string): boolean {
  const identifier = (fileName ?? '').toLowerCase();
  const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return (
    identifier.endsWith('.3mf') ||
    (!!mimeType && THREE_MF_MIME_TYPES.has(mimeType)) ||
    (signature.length === 4 &&
      signature[0] === 0x50 &&
      signature[1] === 0x4b &&
      signature[2] === 0x03 &&
      signature[3] === 0x04)
  );
}

function extractThreeMfUnit(buffer: ArrayBuffer): string | undefined {
  try {
    const archive = unzipSync(new Uint8Array(buffer));
    for (const name of Object.keys(archive)) {
      if (/^3D\/.*\.model$/i.test(name)) {
        const text = new TextDecoder().decode(archive[name]);
        const match = text.match(/<model[^>]*unit="([^"]+)"/i);
        if (match) {
          return match[1].toLowerCase();
        }
      }
    }
  } catch (error) {
    console.warn('Failed to inspect 3MF unit metadata.', error);
  }
  return undefined;
}

function createGeometryFromLoader(
  buffer: ArrayBuffer,
  request: ParseMeshRequest
): { geometry: BufferGeometry; scale: number } {
  const isThreeMF = detectThreeMf(buffer, request.fileName, request.mimeType);
  let scale = 1;

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
      const merged =
        geometries.length === 1
          ? geometries[0]
          : BufferGeometryUtils.mergeGeometries(geometries, true);
      if (!merged) {
        throw new Error('Unable to merge 3MF mesh data.');
      }
      merged.computeVertexNormals();
      const unit = extractThreeMfUnit(buffer);
      if (unit && THREE_MF_UNITS_TO_MM[unit]) {
        scale = THREE_MF_UNITS_TO_MM[unit];
      }
      return { geometry: merged, scale };
    }
    throw new Error('Unable to parse 3MF file. No mesh data found.');
  }

  const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();
  return { geometry, scale };
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

function geometryFromTypedArrays(positions: ArrayBuffer, indices?: ArrayBuffer): BufferGeometry {
  const geometry = new BufferGeometry();
  const positionsArray = new Float32Array(new Float32Array(positions));
  geometry.setAttribute('position', new Float32BufferAttribute(positionsArray, 3));
  if (indices) {
    const indicesArray = new Uint32Array(new Uint32Array(indices));
    geometry.setIndex(new Uint32BufferAttribute(indicesArray, 1));
  }
  return geometry;
}

function normalizeGeometry(
  geometry: BufferGeometry,
  scale: number
): { geometry: BufferGeometry; boundingBox: Box3; center: Vector3; size: Vector3 } {
  const normalized = geometry.clone();
  if (scale !== 1) {
    normalized.scale(scale, scale, scale);
  }
  normalized.computeBoundingBox();
  const initialBox = normalized.boundingBox ? normalized.boundingBox.clone() : new Box3();
  const center = initialBox.getCenter(new Vector3());
  normalized.translate(-center.x, -center.y, -center.z);
  normalized.computeBoundingBox();
  const finalBox = normalized.boundingBox ? normalized.boundingBox.clone() : new Box3();
  const size = finalBox.getSize(new Vector3());
  normalized.computeVertexNormals();
  return { geometry: normalized, boundingBox: finalBox, center, size };
}

function toUint32Array(array: ArrayLike<number>, count: number): Uint32Array {
  const result = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = Number(array[i]);
  }
  return result;
}

function computeSignedVolume(positions: Float32Array, indices?: Uint32Array): number {
  let volume = 0;
  const v0 = new Vector3();
  const v1 = new Vector3();
  const v2 = new Vector3();
  const cross = new Vector3();

  if (indices && indices.length > 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      v0.set(positions[i0], positions[i0 + 1], positions[i0 + 2]);
      v1.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      v2.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);
      cross.copy(v1).cross(v2);
      volume += v0.dot(cross);
    }
  } else {
    for (let i = 0; i < positions.length; i += 9) {
      v0.set(positions[i], positions[i + 1], positions[i + 2]);
      v1.set(positions[i + 3], positions[i + 4], positions[i + 5]);
      v2.set(positions[i + 6], positions[i + 7], positions[i + 8]);
      cross.copy(v1).cross(v2);
      volume += v0.dot(cross);
    }
  }

  return volume / 6;
}

const api = {
  parseMesh(payload: ParseMeshRequest): ParseMeshResponse {
    const { geometry } = createGeometryFromLoader(payload.buffer, payload);
    return toParseResponse(geometry);
  },
  analyzeGeometry(payload: AnalyzeGeometryRequest): AnalyzeGeometryResponse {
    if (!payload.buffer && !payload.positions) {
      throw new Error('Analyze request requires raw mesh data or typed arrays.');
    }

    const sourceGeometryResult = payload.buffer
      ? createGeometryFromLoader(payload.buffer, {
          buffer: payload.buffer,
          fileName: payload.fileName ?? '',
          mimeType: payload.mimeType
        })
      : { geometry: geometryFromTypedArrays(payload.positions!, payload.indices), scale: 1 };

    const { geometry: normalizedGeometry, boundingBox, center, size } = normalizeGeometry(
      sourceGeometryResult.geometry,
      sourceGeometryResult.scale
    );

    const positionAttribute = normalizedGeometry.getAttribute('position');
    if (!positionAttribute) {
      throw new Error('Geometry is missing position data.');
    }

    const positions = new Float32Array(positionAttribute.array as ArrayLike<number>);
    normalizedGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    const indexAttribute = normalizedGeometry.getIndex();
    let indices: Uint32Array | undefined;
    if (indexAttribute) {
      indices = toUint32Array(indexAttribute.array as ArrayLike<number>, indexAttribute.count);
      normalizedGeometry.setIndex(new Uint32BufferAttribute(indices, 1));
    }

    const triangleCount = indices ? indices.length / 3 : positions.length / 9;
    const signedVolume = computeSignedVolume(positions, indices);

    const metrics: GeometryMetrics = {
      boundingBox: {
        min: boundingBox.min.toArray() as [number, number, number],
        max: boundingBox.max.toArray() as [number, number, number]
      },
      size: size.toArray() as [number, number, number],
      triangleCount,
      volume: { signed: signedVolume, absolute: Math.abs(signedVolume) },
      center: center.toArray() as [number, number, number]
    };

    const transfers: ArrayBuffer[] = [positions.buffer];
    if (indices) {
      transfers.push(indices.buffer);
    }

    return transfer(
      {
        positions: positions.buffer,
        indices: indices ? indices.buffer : undefined,
        metrics
      },
      transfers
    );
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
