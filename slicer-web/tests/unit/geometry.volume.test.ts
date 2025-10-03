import { afterAll, describe, expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Worker as NodeWorker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';

import { createWorkerHandle, type WorkerHandle } from '../../lib/worker-factory';
import type { GeometryWorkerApi } from '../../workers/geometry.worker';

class VitestTextEncoder {
  encode(input: string): Uint8Array {
    const buffer = Buffer.from(input, 'utf-8');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
}

(globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder =
  VitestTextEncoder as unknown as typeof TextEncoder;

const { build } = await import('esbuild');

const projectRoot = process.cwd();
const require = createRequire(import.meta.url);
const fflateEntry = require.resolve('fflate');
const threeStdlibStub = path.resolve(projectRoot, 'tests/stubs/three-stdlib.ts');
const bufferGeometryLoaderPath = require.resolve('three/src/loaders/BufferGeometryLoader.js');
const stlLoaderPath = require.resolve('three/examples/jsm/loaders/STLLoader.js');
const threeMfLoaderPath = require.resolve('three/examples/jsm/loaders/3MFLoader.js');

function resolveWorkerEntry(url: URL): string {
  if (url.protocol === 'file:') {
    return fileURLToPath(url);
  }

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return path.resolve(projectRoot, `.${decodeURIComponent(url.pathname)}`);
  }

  throw new Error(`Unsupported worker URL protocol: ${url.protocol}`);
}

async function bundleWorker(entryPath: string): Promise<string> {
  const result = await build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2020',
    sourcemap: 'inline',
    write: false,
    absWorkingDir: projectRoot,
    plugins: [
      {
        name: 'worker-alias',
        setup(build) {
          build.onResolve({ filter: /^three\/addons\/loaders\/BufferGeometryLoader\.js$/ }, () => ({
            path: bufferGeometryLoaderPath
          }));
          build.onResolve({ filter: /^three\/examples\/jsm\/loaders\/BufferGeometryLoader\.js$/ }, () => ({
            path: bufferGeometryLoaderPath
          }));
          build.onResolve({ filter: /^three\/addons\/loaders\/STLLoader\.js$/ }, () => ({
            path: stlLoaderPath
          }));
          build.onResolve({ filter: /^three\/examples\/jsm\/loaders\/STLLoader\.js$/ }, () => ({
            path: stlLoaderPath
          }));
          build.onResolve({ filter: /^three\/addons\/loaders\/3MFLoader\.js$/ }, () => ({
            path: threeMfLoaderPath
          }));
          build.onResolve({ filter: /^three\/examples\/jsm\/loaders\/3MFLoader\.js$/ }, () => ({
            path: threeMfLoaderPath
          }));
          build.onResolve({ filter: /^three-stdlib$/ }, () => ({
            path: threeStdlibStub
          }));
          build.onResolve({ filter: /^fflate$/ }, () => ({
            path: fflateEntry
          }));
        }
      }
    ]
  });

  const prelude = `import { parentPort } from 'node:worker_threads';
const listeners = new Map();
const endpoint = {
  postMessage: (data) => parentPort.postMessage(data),
  addEventListener: (type, listener) => {
    if (type !== 'message') {
      return;
    }
    const handler = (data) => listener({ data });
    listeners.set(listener, handler);
    parentPort.on('message', handler);
  },
  removeEventListener: (type, listener) => {
    if (type !== 'message') {
      return;
    }
    const handler = listeners.get(listener);
    if (handler) {
      parentPort.off('message', handler);
      listeners.delete(listener);
    }
  }
};
globalThis.self = endpoint;
globalThis.addEventListener = endpoint.addEventListener;
globalThis.removeEventListener = endpoint.removeEventListener;
globalThis.postMessage = endpoint.postMessage;
`;

  return `${prelude}\n${result.outputFiles[0].text}`;
}

const workerBundles = new Map<string, string>();

const geometryWorkerUrl = new URL('../../workers/geometry.worker.ts', import.meta.url);
workerBundles.set(geometryWorkerUrl.href, await bundleWorker(resolveWorkerEntry(geometryWorkerUrl)));

if (typeof globalThis.Worker === 'undefined') {
  class VitestWorker extends NodeWorker {
    #listeners = new Map<EventListenerOrEventListenerObject, (value: unknown) => void>();

    constructor(url: string | URL, options?: ConstructorParameters<typeof NodeWorker>[1]) {
      const resolvedUrl =
        typeof url === 'string'
          ? url.startsWith('file:')
            ? new URL(url)
            : pathToFileURL(url)
          : url;

      const outputText = workerBundles.get(resolvedUrl.href);

      if (!outputText) {
        throw new Error(`No bundled worker available for ${resolvedUrl.href}`);
      }

      const workerOptions: ConstructorParameters<typeof NodeWorker>[1] = {
        ...(options ?? {}),
        eval: true,
        type: 'module'
      };

      super(outputText, workerOptions);
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type !== 'message') {
        return;
      }
      const handler: (value: unknown) => void = (value) => {
        if (typeof listener === 'function') {
          listener({ data: value } as MessageEvent<unknown>);
        } else if (listener && typeof listener === 'object' && 'handleEvent' in listener) {
          (listener.handleEvent as (event: MessageEvent<unknown>) => void)({ data: value } as MessageEvent<unknown>);
        }
      };
      this.#listeners.set(listener, handler);
      this.on('message', handler);
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type !== 'message') {
        return;
      }
      const handler = this.#listeners.get(listener);
      if (handler) {
        this.off('message', handler);
        this.#listeners.delete(listener);
      }
    }
  }

  (globalThis as unknown as { Worker: typeof Worker }).Worker = VitestWorker as unknown as typeof Worker;
}

let workerHandle: WorkerHandle<GeometryWorkerApi> | undefined;

function getGeometryWorkerHandle(): WorkerHandle<GeometryWorkerApi> {
  if (!workerHandle) {
    workerHandle = createWorkerHandle<GeometryWorkerApi>(
      new URL('../../workers/geometry.worker.ts', import.meta.url)
    );
  }

  return workerHandle;
}

afterAll(() => {
  if (workerHandle) {
    workerHandle.terminate();
    workerHandle = undefined;
  }
});

describe('geometry volume analysis', () => {
  it('computes an accurate volume for typed array payloads', async () => {
    const { proxy } = getGeometryWorkerHandle();

    const geometry = new BoxGeometry(20, 20, 20);
    const positionAttribute = geometry.getAttribute('position');
    const positions = new Float32Array(positionAttribute.array as ArrayLike<number>);

    const indexAttribute = geometry.getIndex();
    const indices = indexAttribute
      ? new Uint32Array(indexAttribute.array as ArrayLike<number>)
      : undefined;

    const result = await proxy.analyzeGeometry({
      positions: positions.buffer,
      indices: indices?.buffer
    });

    geometry.dispose();

    const volume = result.metrics.volume.absolute;
    const expectedVolume = 8000;
    const tolerance = expectedVolume * 0.01;
    expect(volume).toBeGreaterThanOrEqual(expectedVolume - tolerance);
    expect(volume).toBeLessThanOrEqual(expectedVolume + tolerance);
  });

  it('computes positive volume for STL geometry payloads', async () => {
    const { proxy } = getGeometryWorkerHandle();

    const stlPath = path.resolve(__dirname, '../../e2e/fixtures/sample.stl');
    const fileBuffer = await fs.readFile(stlPath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );

    const result = await proxy.analyzeGeometry({
      buffer: arrayBuffer,
      fileName: 'sample.stl',
      mimeType: 'model/stl'
    });

    expect(result.metrics.volume.absolute).toBeGreaterThan(0);
  });
});
