import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';

import type { LayerEstimate } from '../estimate';

export interface ViewerContext {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  scene: Scene;
  dispose: () => void;
  render: () => void;
  updateGeometry: (geometry: BufferGeometry | undefined) => void;
  updateSlice: (slice: LayerEstimate | undefined) => void;
}

export function createViewer(canvas: HTMLCanvasElement): ViewerContext {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new Scene();
  scene.background = new Color(0x0f172a);

  const camera = new PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);
  camera.position.set(3, 3, 3);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  const ambientLight = new AmbientLight(0xffffff, 0.6);
  const directionalLight = new DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(ambientLight, directionalLight);

  let mesh: Mesh | undefined;
  let sliceLine: Line | undefined;

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  function updateGeometry(geometry: BufferGeometry | undefined) {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh = undefined;
    }

    if (geometry) {
      const material = new MeshStandardMaterial({ color: 0x38bdf8, wireframe: false });
      mesh = new Mesh(geometry, material);
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere;
      if (sphere) {
        const distance = sphere.radius * 2.5;
        const direction = new Vector3(1, 1, 1).normalize();
        camera.position.copy(sphere.center.clone().addScaledVector(direction, distance));
        camera.lookAt(sphere.center);
        controls.target.copy(sphere.center);
      }
      scene.add(mesh);
    }
    render();
  }

  function updateSlice(slice: LayerEstimate | undefined) {
    if (sliceLine) {
      scene.remove(sliceLine);
      sliceLine.geometry.dispose();
      (sliceLine.material as LineBasicMaterial).dispose();
      sliceLine = undefined;
    }

    if (slice && slice.segments.length > 0) {
      const points: number[] = [];
      slice.segments.forEach((segment) => {
        points.push(...segment.start.toArray(), ...segment.end.toArray());
      });
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
      const material = new LineBasicMaterial({ color: 0xf97316 });
      sliceLine = new Line(geometry, material);
      scene.add(sliceLine);
    }
    render();
  }

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const { clientWidth, clientHeight } = canvas;
          renderer.setSize(clientWidth, clientHeight, false);
          camera.aspect = clientWidth / clientHeight;
          camera.updateProjectionMatrix();
          render();
        })
      : undefined;
  resizeObserver?.observe(canvas);

  function dispose() {
    resizeObserver?.disconnect();
    controls.dispose();
    renderer.dispose();
    if (mesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    if (sliceLine) {
      sliceLine.geometry.dispose();
      (sliceLine.material as LineBasicMaterial).dispose();
    }
  }

  render();

  return {
    renderer,
    camera,
    controls,
    scene,
    dispose,
    render,
    updateGeometry,
    updateSlice
  };
}
