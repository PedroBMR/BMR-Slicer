import { wrap, type Remote } from 'comlink';

export interface WorkerHandle<T> {
  proxy: Remote<T>;
  worker: Worker;
  terminate: () => void;
}

export function createWorkerHandle<T>(url: URL): WorkerHandle<T> {
  const worker = new Worker(url, { type: 'module' });
  const proxy = wrap<T>(worker);
  return {
    proxy,
    worker,
    terminate: () => worker.terminate(),
  };
}
