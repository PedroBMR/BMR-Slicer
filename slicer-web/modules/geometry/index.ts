import { BufferGeometry, Matrix4, Plane, Vector3 } from 'three';

export interface SlicePlane {
  origin: Vector3;
  normal: Vector3;
  thickness?: number;
}

export interface SliceSegment {
  start: Vector3;
  end: Vector3;
}

export interface SliceSummary {
  segments: SliceSegment[];
  centroid: Vector3;
  area: number;
  boundingRadius: number;
}

export interface MeshStatistics {
  vertexCount: number;
  faceCount: number;
  boundingBox: {
    min: Vector3;
    max: Vector3;
  };
}

export async function loadGeometryFromFile(file: File): Promise<BufferGeometry> {
  if (file.type === 'model/stl' || file.name.toLowerCase().endsWith('.stl')) {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
    const loader = new STLLoader();
    const arrayBuffer = await file.arrayBuffer();
    const geometry = loader.parse(arrayBuffer);
    geometry.computeVertexNormals();
    return geometry;
  }

  const { BufferGeometryLoader } = await import('three/addons/loaders/BufferGeometryLoader.js');
  const loader = new BufferGeometryLoader();
  const text = await file.text();
  const json = JSON.parse(text);
  const geometry = loader.parse(json);
  geometry.computeVertexNormals();
  return geometry;
}

export function toWorldSpace(geometry: BufferGeometry, matrix: Matrix4): BufferGeometry {
  const transformed = geometry.clone();
  transformed.applyMatrix4(matrix);
  return transformed;
}

export function getMeshStatistics(geometry: BufferGeometry): MeshStatistics {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const vertexCount = position ? position.count : 0;
  const faceCount = index ? index.count / 3 : vertexCount / 3;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  return {
    vertexCount,
    faceCount,
    boundingBox: {
      min: box?.min.clone() ?? new Vector3(),
      max: box?.max.clone() ?? new Vector3()
    }
  };
}

export function sliceGeometry(geometry: BufferGeometry, slice: SlicePlane): SliceSummary {
  const { origin, normal } = slice;
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal.clone().normalize(), origin);
  const thickness = slice.thickness ?? 0.05;
  const epsilon = Math.max(thickness, 1e-4);

  const nonIndexed = geometry.clone().toNonIndexed();
  const position = nonIndexed.getAttribute('position');
  const segments: SliceSegment[] = [];
  const intersections: Vector3[] = [];

  const v0 = new Vector3();
  const v1 = new Vector3();
  const v2 = new Vector3();
  const temp = new Vector3();

  const basisU = new Vector3();
  const basisV = new Vector3();
  const projected: Array<[number, number]> = [];

  function ensureBasis() {
    if (basisU.lengthSq() > 0) {
      return;
    }
    const arbitrary = Math.abs(normal.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
    basisU.copy(arbitrary).cross(normal).normalize();
    basisV.copy(normal).cross(basisU).normalize();
  }

  for (let i = 0; i < position.count; i += 3) {
    v0.fromBufferAttribute(position, i);
    v1.fromBufferAttribute(position, i + 1);
    v2.fromBufferAttribute(position, i + 2);

    const d0 = plane.distanceToPoint(v0);
    const d1 = plane.distanceToPoint(v1);
    const d2 = plane.distanceToPoint(v2);

    const localPoints: Vector3[] = [];

    const points = [
      { point: v0.clone(), distance: d0 },
      { point: v1.clone(), distance: d1 },
      { point: v2.clone(), distance: d2 }
    ];

    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
      const current = points[edgeIndex];
      const next = points[(edgeIndex + 1) % 3];

      if (Math.abs(current.distance) <= epsilon) {
        localPoints.push(current.point.clone());
      }

      if (current.distance * next.distance < 0) {
        const t = current.distance / (current.distance - next.distance);
        temp.copy(current.point).lerp(next.point, t);
        localPoints.push(temp.clone());
      }
    }

    if (localPoints.length >= 2) {
      const [p1, p2] = localPoints;
      segments.push({ start: p1.clone(), end: p2.clone() });
      intersections.push(...localPoints.map((p) => p.clone()));
      ensureBasis();
      projected.push(
        ...localPoints.map((p) => {
          const relative = p.clone().sub(origin);
          return [relative.dot(basisU), relative.dot(basisV)];
        })
      );
    }
  }

  const centroid = intersections.reduce((acc, point) => acc.add(point), new Vector3()).divideScalar(
    intersections.length || 1
  );

  let area = 0;
  if (projected.length >= 3) {
    const unique = projected.slice(0, 64); // clamp to avoid runaway memory
    for (let i = 0; i < unique.length; i++) {
      const [x1, y1] = unique[i];
      const [x2, y2] = unique[(i + 1) % unique.length];
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) * 0.5;
  }

  const boundingRadius = intersections.reduce((radius, point) => {
    const distance = point.distanceTo(origin);
    return Math.max(radius, distance);
  }, 0);

  return {
    segments,
    centroid,
    area,
    boundingRadius
  };
}
