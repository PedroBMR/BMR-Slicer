'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  AmbientLight,
  Box3,
  Box3Helper,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  GridHelper,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Uint32BufferAttribute,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { OrbitControls } from 'three-stdlib';

import type { BoundingBox, Vector3Tuple } from '../lib/geometry';

export interface ViewerGeometryData {
  positions: Float32Array;
  indices?: Uint32Array;
}

export interface ViewerMetrics {
  volume_mm3: number;
  triangleCount: number;
  bbox: BoundingBox;
  size: Vector3Tuple;
}

export interface ModelViewerProps {
  geometry?: ViewerGeometryData;
  metrics?: ViewerMetrics;
  fileName?: string;
}

interface ViewerState {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  rootGroup: Group;
  grid: GridHelper;
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((item) => disposeMaterial(item));
    return;
  }
  material.dispose();
}

function disposeObject(object: Object3D): void {
  if ((object as Mesh).isMesh) {
    const mesh = object as Mesh;
    mesh.geometry.dispose();
    disposeMaterial(mesh.material);
  }
}

function clearGroup(group: Group): void {
  [...group.children].forEach((child) => {
    group.remove(child);
    disposeObject(child);
  });
}

export function ModelViewer({ geometry, metrics, fileName }: ModelViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<ViewerState | null>(null);
  const animationRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const bboxHelperRef = useRef<Box3Helper | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1);
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false);

    const scene = new Scene();
    scene.background = new Color(0x0f172a);

    const camera = new PerspectiveCamera(
      45,
      (container.clientWidth || 1) / (container.clientHeight || 1),
      0.1,
      10000,
    );
    camera.position.set(180, 160, 180);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const ambient = new AmbientLight(0xffffff, 0.7);
    const directional = new DirectionalLight(0xffffff, 0.85);
    directional.position.set(200, 320, 200);
    scene.add(ambient, directional);

    const rootGroup = new Group();
    scene.add(rootGroup);

    const grid = new GridHelper(400, 40, 0x1f2937, 0x1f2937);
    grid.position.set(0, 0, 0);
    scene.add(grid);

    stateRef.current = { renderer, scene, camera, controls, rootGroup, grid };

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

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
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      controls.dispose();
      clearGroup(rootGroup);
      bboxHelperRef.current?.geometry.dispose();
      if (bboxHelperRef.current) {
        disposeMaterial(bboxHelperRef.current.material as Material);
        scene.remove(bboxHelperRef.current);
        bboxHelperRef.current = null;
      }
      grid.geometry.dispose();
      disposeMaterial(grid.material as Material);
      scene.clear();
      renderer.dispose();
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }

    const { scene, camera, controls, rootGroup, grid } = state;

    clearGroup(rootGroup);
    if (bboxHelperRef.current) {
      bboxHelperRef.current.geometry.dispose();
      disposeMaterial(bboxHelperRef.current.material as Material);
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (!geometry) {
      controls.target.set(0, 0, 0);
      controls.update();
      return;
    }

    const bufferGeometry = new BufferGeometry();
    bufferGeometry.setAttribute('position', new Float32BufferAttribute(geometry.positions, 3));
    if (geometry.indices && geometry.indices.length > 0) {
      bufferGeometry.setIndex(new Uint32BufferAttribute(geometry.indices, 1));
    }
    bufferGeometry.computeVertexNormals();

    const material = new MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.55,
      emissive: new Color(0x0b1220),
    });
    const mesh = new Mesh(bufferGeometry, material);
    rootGroup.add(mesh);

    scene.updateMatrixWorld(true);

    const localBox = new Box3().setFromObject(mesh);
    const center = localBox.getCenter(new Vector3());
    rootGroup.position.set(-center.x, -center.y, -center.z);

    scene.updateMatrixWorld(true);

    const worldBox = new Box3().setFromObject(rootGroup);
    const helper = new Box3Helper(worldBox, 0x38bdf8);
    bboxHelperRef.current = helper;
    scene.add(helper);

    grid.position.y = worldBox.min.y;

    const sizeVector = worldBox.getSize(new Vector3());
    const radius = Math.max(sizeVector.x, sizeVector.y, sizeVector.z) * 0.5;
    const distance =
      radius > 0 ? (radius / Math.sin(MathUtils.degToRad(camera.fov) / 2)) * 1.35 : 200;

    const direction = new Vector3(1, 1, 1).normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    camera.near = Math.max(distance / 500, 0.1);
    camera.far = Math.max(distance * 10, 2000);
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.update();

    return () => {
      rootGroup.remove(mesh);
      disposeObject(mesh);
      if (bboxHelperRef.current) {
        bboxHelperRef.current.geometry.dispose();
        disposeMaterial(bboxHelperRef.current.material as Material);
        scene.remove(bboxHelperRef.current);
        bboxHelperRef.current = null;
      }
    };
  }, [geometry]);

  const dimensionLabel = useMemo(() => {
    if (!metrics) {
      return undefined;
    }
    const [x, y, z] = metrics.size;
    return `${x.toFixed(2)} × ${y.toFixed(2)} × ${z.toFixed(2)} mm`;
  }, [metrics]);

  const volumeLabel = useMemo(() => {
    if (!metrics) {
      return undefined;
    }
    return `${metrics.volume_mm3.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} mm³`;
  }, [metrics]);

  const triangleLabel = useMemo(() => {
    if (!metrics) {
      return undefined;
    }
    return metrics.triangleCount.toLocaleString();
  }, [metrics]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '1rem',
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.85)',
        minHeight: '480px',
      }}
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-label="3D model viewer"
      />
      {metrics ? (
        <div
          style={{
            position: 'absolute',
            left: '1rem',
            bottom: '1rem',
            background: 'rgba(15, 23, 42, 0.75)',
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
          }}
        >
          {fileName ? (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
              {fileName}
            </span>
          ) : null}
          {dimensionLabel ? <span style={{ fontWeight: 600 }}>Size: {dimensionLabel}</span> : null}
          {volumeLabel ? <span style={{ color: '#e0f2fe' }}>Volume: {volumeLabel}</span> : null}
          {triangleLabel ? (
            <span style={{ color: '#94a3b8' }}>Triangles: {triangleLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
