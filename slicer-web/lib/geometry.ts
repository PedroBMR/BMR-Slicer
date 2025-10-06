export type Vector3Tuple = [number, number, number];

export interface BoundingBox {
  min: Vector3Tuple;
  max: Vector3Tuple;
}

export interface GeometrySummary {
  volume_mm3: number;
  triangleCount: number;
  bbox: BoundingBox;
  size: Vector3Tuple;
}

export function computeBoundingBox(positions: Float32Array): BoundingBox {
  if (positions.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}

export function computeSize(bbox: BoundingBox): Vector3Tuple {
  return [bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2]];
}

export function computeTriangleCount(positions: Float32Array, indices?: Uint32Array): number {
  if (indices && indices.length > 0) {
    return Math.floor(indices.length / 3);
  }
  return Math.floor(positions.length / 9);
}

export function computeSignedVolume(positions: Float32Array, indices?: Uint32Array): number {
  let volume = 0;

  if (indices && indices.length > 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const ax = positions[i0];
      const ay = positions[i0 + 1];
      const az = positions[i0 + 2];
      const bx = positions[i1];
      const by = positions[i1 + 1];
      const bz = positions[i1 + 2];
      const cx = positions[i2];
      const cy = positions[i2 + 1];
      const cz = positions[i2 + 2];

      volume += tetrahedronSignedVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
    }
  } else {
    for (let i = 0; i < positions.length; i += 9) {
      const ax = positions[i];
      const ay = positions[i + 1];
      const az = positions[i + 2];
      const bx = positions[i + 3];
      const by = positions[i + 4];
      const bz = positions[i + 5];
      const cx = positions[i + 6];
      const cy = positions[i + 7];
      const cz = positions[i + 8];

      volume += tetrahedronSignedVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
    }
  }

  return volume / 6;
}

function tetrahedronSignedVolume(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): number {
  const crossX = by * cz - bz * cy;
  const crossY = bz * cx - bx * cz;
  const crossZ = bx * cy - by * cx;
  return ax * crossX + ay * crossY + az * crossZ;
}

export function summarizeGeometry(positions: Float32Array, indices?: Uint32Array): GeometrySummary {
  const bbox = computeBoundingBox(positions);
  const size = computeSize(bbox);
  const triangleCount = computeTriangleCount(positions, indices);
  const signedVolume = computeSignedVolume(positions, indices);

  return {
    bbox,
    size,
    triangleCount,
    volume_mm3: Math.abs(signedVolume),
  };
}
