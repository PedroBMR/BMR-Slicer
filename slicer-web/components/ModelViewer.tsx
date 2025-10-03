'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Uint32BufferAttribute,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three-stdlib';

import type { LayerEstimate } from '../modules/estimate';
import { useViewerStore, type GeometryPayload } from '../modules/store';

export interface GeometryInfo {
  bbox: { min: [number, number, number]; max: [number, number, number] };
  size: [number, number, number];
  triangleCount: number;
}

export interface ModelViewerProps {
  source?: ArrayBuffer | File;
  geometry?: BufferGeometry;
  onGeometryInfo?: (info: GeometryInfo) => void;
}

const DEFAULT_INFO: GeometryInfo = {
  bbox: { min: [0, 0, 0], max: [0, 0, 0] },
  size: [0, 0, 0],
  triangleCount: 0
};

export function ModelViewer({ source: externalSource, geometry: externalGeometry, onGeometryInfo }: ModelViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const storeGeometry = useViewerStore((state) => state.geometry);
  const geometrySource = useViewerStore((state) => state.geometrySource);
  const layers = useViewerStore((state) => state.layers) as LayerEstimate[];

  const [selectedLayer, setSelectedLayer] = useState(0);

  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootGroupRef = useRef<Group | null>(null);
  const meshGroupRef = useRef<Group | null>(null);
  const sliceGroupRef = useRef<Group | null>(null);
  const gridRef = useRef<GridHelper | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const source = externalSource ?? geometrySource;
  const geometry = externalGeometry ?? storeGeometry;
  const geometryPayload = useViewerStore((state) => state.geometryPayload);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1);
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false);

    const scene = new Scene();
    scene.background = new Color(0x0f172a);

    const camera = new PerspectiveCamera(45, (container.clientWidth || 1) / (container.clientHeight || 1), 0.1, 100000);
    camera.position.set(180, 140, 180);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const ambientLight = new AmbientLight(0xffffff, 0.6);
    const directionalLight = new DirectionalLight(0xffffff, 0.85);
    directionalLight.position.set(120, 260, 160);
    scene.add(ambientLight, directionalLight);

    const rootGroup = new Group();
    const meshGroup = new Group();
    const sliceGroup = new Group();
    rootGroup.add(meshGroup);
    rootGroup.add(sliceGroup);
    scene.add(rootGroup);

    const grid = new GridHelper(200, 40, 0x1f2937, 0x1f2937);
    grid.position.y = 0;
    scene.add(grid);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    rootGroupRef.current = rootGroup;
    meshGroupRef.current = meshGroup;
    sliceGroupRef.current = sliceGroup;
    gridRef.current = grid;

    const renderLoop = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        const width = container.clientWidth || 1;
        const height = container.clientHeight || 1;
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(window.devicePixelRatio ?? 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
      observer.observe(container);
      resizeObserverRef.current = observer;
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserverRef.current?.disconnect();
      controls.dispose();
      renderer.dispose();
      disposeGroup(sliceGroup);
      disposeGroup(meshGroup);
      const activeGrid = gridRef.current;
      if (activeGrid) {
        activeGrid.geometry.dispose();
        const materials = Array.isArray(activeGrid.material) ? activeGrid.material : [activeGrid.material];
        materials.forEach((material) => material.dispose());
        scene.remove(activeGrid);
      }
      scene.clear();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const rootGroup = rootGroupRef.current;
    const meshGroup = meshGroupRef.current;
    const grid = gridRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    let disposed = false;

    if (!scene || !rootGroup || !meshGroup || !grid || !camera || !controls) {
      return;
    }

    async function loadModel() {
      clearGroup(meshGroup);
      rootGroup.scale.setScalar(1);
      rootGroup.position.set(0, 0, 0);

      if (!source && !geometry) {
        onGeometryInfo?.(DEFAULT_INFO);
        return;
      }

      try {
        const object = geometry
          ? createMeshFromGeometry(geometry)
          : geometryPayload
              ? createMeshFromPayload(geometryPayload)
              : source
                  ? await loadObjectFromSource(source)
                  : null;

        if (!object || disposed) {
          return;
        }

        meshGroup.add(object);
        scene.updateMatrixWorld(true);

        const initialBox = new Box3().setFromObject(meshGroup);
        const initialSize = initialBox.getSize(new Vector3());
        const scale = determineScale(initialSize);

        rootGroup.scale.setScalar(scale);
        scene.updateMatrixWorld(true);

        const scaledBox = new Box3().setFromObject(meshGroup);
        const center = scaledBox.getCenter(new Vector3());
        rootGroup.position.set(-center.x, -center.y, -center.z);
        scene.updateMatrixWorld(true);

        const finalBox = new Box3().setFromObject(meshGroup);
        const finalSize = finalBox.getSize(new Vector3());

        const updatedGrid = rebuildGrid(scene, grid, finalBox);
        gridRef.current = updatedGrid;

        const radius = Math.max(finalSize.x, finalSize.y, finalSize.z) * 0.75;
        const distance = radius > 0 ? radius * 2.5 : 250;
        const direction = new Vector3(1, 1, 1).normalize();
        const target = new Vector3(0, 0, 0);
        camera.position.copy(target.clone().addScaledVector(direction, distance));
        controls.target.copy(target);
        controls.update();

        const triangleCount = countTriangles(meshGroup);
        onGeometryInfo?.({
          bbox: {
            min: [finalBox.min.x, finalBox.min.y, finalBox.min.z],
            max: [finalBox.max.x, finalBox.max.y, finalBox.max.z]
          },
          size: [finalSize.x, finalSize.y, finalSize.z],
          triangleCount
        });
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Failed to load model for viewer', error);
        }
        onGeometryInfo?.(DEFAULT_INFO);
      }
    }

    void loadModel();

    return () => {
      disposed = true;
    };
  }, [geometry, geometryPayload, onGeometryInfo, source]);

  useEffect(() => {
    if (geometry || source) {
      setSelectedLayer(0);
    }
  }, [geometry, source]);

  useEffect(() => {
    if (selectedLayer >= layers.length) {
      setSelectedLayer(Math.max(0, layers.length - 1));
    }
  }, [layers, selectedLayer]);

  useEffect(() => {
    const sliceGroup = sliceGroupRef.current;
    if (!sliceGroup) {
      return;
    }

    clearGroup(sliceGroup);

    const layer = layers[selectedLayer];
    if (!layer || layer.segments.length === 0) {
      return;
    }

    const points: number[] = [];
    layer.segments.forEach((segment) => {
      points.push(
        segment.start.x,
        segment.start.y,
        segment.start.z,
        segment.end.x,
        segment.end.y,
        segment.end.z
      );
    });

    if (points.length === 0) {
      return;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
    const material = new LineBasicMaterial({ color: 0xf97316 });
    const lineSegments = new LineSegments(geometry, material);
    sliceGroup.add(lineSegments);
  }, [layers, selectedLayer]);

  const selected = useMemo(() => layers[selectedLayer], [layers, selectedLayer]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          borderRadius: '1rem',
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.75)',
          minHeight: '480px'
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="3D model viewer" />
      </div>
      <aside
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '1rem',
          padding: '1.5rem'
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Layers</h2>
        {layers.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Load a mesh to inspect generated layers.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {layers.map((layer, index) => (
              <LayerRow
                key={`${layer.elevation}-${index}`}
                layer={layer}
                index={index}
                active={index === selectedLayer}
                onSelect={setSelectedLayer}
              />
            ))}
          </div>
        )}
        {selected ? (
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Selected layer</h3>
            <p style={{ color: '#cbd5f5', margin: 0 }}>Elevation: {selected.elevation.toFixed(2)} mm</p>
            <p style={{ color: '#cbd5f5', margin: 0 }}>Area: {selected.area.toFixed(2)} mm²</p>
            <p style={{ color: '#cbd5f5', margin: 0 }}>Perimeter: {selected.circumference.toFixed(2)} mm</p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

interface LayerRowProps {
  layer: LayerEstimate;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
}

function LayerRow({ layer, index, active, onSelect }: LayerRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        border: 'none',
        background: active ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
        color: active ? '#38bdf8' : '#e2e8f0',
        fontSize: '0.875rem'
      }}
    >
      <span>#{index + 1}</span>
      <span>{layer.area.toFixed(2)} mm²</span>
    </button>
  );
}

function clearGroup(group: Group) {
  const children = [...group.children];
  children.forEach((child) => {
    group.remove(child);
    disposeObject(child);
  });
}

function disposeGroup(group: Group) {
  clearGroup(group);
}

function disposeObject(object: Object3D) {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
    }
    if ((child as LineSegments).isLineSegments) {
      const line = child as LineSegments;
      line.geometry.dispose();
      const materials = Array.isArray(line.material) ? line.material : [line.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

async function loadObjectFromSource(source: ArrayBuffer | File): Promise<Object3D | null> {
  const buffer = source instanceof File ? await source.arrayBuffer() : source;
  const identifier = source instanceof File ? source.name.toLowerCase() : '';
  const signature = new Uint8Array(buffer.slice(0, 4));
  const isThreeMF =
    identifier.endsWith('.3mf') ||
    (signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x03 && signature[3] === 0x04);

  if (isThreeMF) {
    const { ThreeMFLoader } = await import('three-stdlib');
    const loader = new ThreeMFLoader();
    return loader.parse(buffer);
  }

  const { STLLoader } = await import('three-stdlib');
  const loader = new STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.05, roughness: 0.85 });
  return new Mesh(geometry, material);
}

function createMeshFromPayload(payload: GeometryPayload): Mesh {
  const geometry = new BufferGeometry();
  const positions = payload.positionsBuffer
    ? new Float32Array(payload.positionsBuffer)
    : payload.positions;
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

  const indexSource = payload.indicesBuffer
    ? new Uint32Array(payload.indicesBuffer)
    : payload.indices;
  if (indexSource) {
    geometry.setIndex(new Uint32BufferAttribute(indexSource, 1));
  }

  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.05, roughness: 0.85 });
  return new Mesh(geometry, material);
}

function createMeshFromGeometry(geometry: BufferGeometry): Mesh {
  const cloned = geometry.clone();
  cloned.computeVertexNormals();
  const material = new MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.05, roughness: 0.85 });
  return new Mesh(cloned, material);
}

function determineScale(size: Vector3): number {
  const largest = Math.max(size.x, size.y, size.z);
  if (!isFinite(largest) || largest <= 0) {
    return 1;
  }
  if (largest < 1) {
    return 1000;
  }
  return 1;
}

function rebuildGrid(scene: Scene, currentGrid: GridHelper, bounds: Box3): GridHelper {
  const existingMaterial = Array.isArray(currentGrid.material) ? currentGrid.material : [currentGrid.material];
  currentGrid.geometry.dispose();
  existingMaterial.forEach((material) => (material as Material).dispose());
  scene.remove(currentGrid);

  const size = bounds.getSize(new Vector3());
  const maxHorizontal = Math.max(size.x, size.z, 100);
  const divisions = Math.max(10, Math.round(maxHorizontal / 10));
  const grid = new GridHelper(Math.max(100, maxHorizontal * 1.2), divisions, 0x1f2937, 0x1f2937);
  grid.position.y = bounds.min.y;
  scene.add(grid);
  return grid;
}

function countTriangles(group: Group): number {
  let total = 0;
  group.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh;
      const geometry = mesh.geometry;
      const index = geometry.getIndex();
      if (index) {
        total += index.count / 3;
      } else {
        const position = geometry.getAttribute('position');
        total += position ? position.count / 3 : 0;
      }
    }
  });
  return total;
}
