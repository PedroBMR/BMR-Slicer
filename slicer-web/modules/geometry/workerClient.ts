import type { WorkerHandle } from '../../lib/worker-factory';
import { createWorkerHandle } from '../../lib/worker-factory';
import type { GeometryWorkerApi } from '../../workers/geometry.worker';

let handle: WorkerHandle<GeometryWorkerApi> | undefined;

export function getGeometryWorkerHandle(): WorkerHandle<GeometryWorkerApi> {
  if (!handle) {
    handle = createWorkerHandle<GeometryWorkerApi>(
      new URL('../../workers/geometry.worker.ts', import.meta.url),
    );
  }
  return handle;
}

export function releaseGeometryWorker() {
  if (!handle) {
    return;
  }
  handle.terminate();
  handle = undefined;
}
