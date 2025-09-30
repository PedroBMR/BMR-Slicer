import type { WorkerHandle } from '../../lib/worker-factory';
import { createWorkerHandle } from '../../lib/worker-factory';
import type { EstimateWorkerApi } from '../../workers/estimate.worker';

let handle: WorkerHandle<EstimateWorkerApi> | undefined;

export function getEstimateWorkerHandle(): WorkerHandle<EstimateWorkerApi> {
  if (!handle) {
    handle = createWorkerHandle<EstimateWorkerApi>(
      new URL('../../workers/estimate.worker.ts', import.meta.url)
    );
  }
  return handle;
}

export function releaseEstimateWorker() {
  if (!handle) {
    return;
  }
  handle.terminate();
  handle = undefined;
}
