'use client';

import { transfer } from 'comlink';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { createWorkerHandle, type WorkerHandle } from '../lib/worker-factory';

import type { BoundingBox, Vector3Tuple } from '../lib/geometry';
import { FILE_TOO_LARGE_ERROR, MAX_FILE_SIZE_BYTES, useViewerStore } from '../modules/store';
import type { GeometryWorkerApi, LoadMeshResponse } from '../workers/geometry.worker';

const SUPPORTED_EXTENSIONS = ['.stl', '.3mf'];
const SUPPORTED_MIME_TYPES = new Set([
  'model/stl',
  'model/3mf',
  'application/vnd.ms-3mfdocument',
  'application/vnd.ms-package.3dmanufacturing-3dmodel',
]);

export interface FileDropResult {
  fileName: string;
  positions: Float32Array;
  indices?: Uint32Array;
  volume_mm3: number;
  triangleCount: number;
  bbox: BoundingBox;
  size: Vector3Tuple;
}

export interface FileDropProps {
  onGeometryLoaded?: (result: FileDropResult) => void;
  onError?: (message: string) => void;
}

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return true;
  }
  if (file.type && SUPPORTED_MIME_TYPES.has(file.type)) {
    return true;
  }
  return false;
}

export function FileDrop({ onGeometryLoaded, onError }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<WorkerHandle<GeometryWorkerApi> | null>(null);

  const [highlighted, setHighlighted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.Worker !== 'function') {
      return undefined;
    }

    const handle = createWorkerHandle<GeometryWorkerApi>(
      new URL('../workers/geometry.worker.ts', import.meta.url),
    );
    workerRef.current = handle;
    return () => {
      workerRef.current = null;
      handle.terminate();
    };
  }, []);

  const acceptAttribute = useMemo(
    () =>
      [
        '.stl',
        '.3mf',
        'model/stl',
        'model/3mf',
        'application/vnd.ms-3mfdocument',
        'application/vnd.ms-package.3dmanufacturing-3dmodel',
      ].join(','),
    [],
  );

  const resetInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const handleFailure = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
      useViewerStore.setState({ error: message, loading: false });
    },
    [onError],
  );

  const processFile = useCallback(
    async (file: File) => {
      if (loading) {
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        handleFailure(FILE_TOO_LARGE_ERROR);
        resetInput();
        return;
      }

      if (!isSupportedFile(file)) {
        handleFailure('Unsupported file type. Please upload an STL or 3MF model.');
        resetInput();
        setLoading(false);
        return;
      }

      if (!workerRef.current) {
        handleFailure('Geometry worker is not ready.');
        resetInput();
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        const buffer = await file.arrayBuffer();
        const response: LoadMeshResponse = await workerRef.current.proxy.loadMesh(
          transfer(
            {
              buffer,
              fileName: file.name,
              mimeType: file.type || undefined,
            },
            [buffer],
          ),
        );

        const positions = new Float32Array(response.positions);
        const indices = response.indices ? new Uint32Array(response.indices) : undefined;

        const result: FileDropResult = {
          fileName: file.name,
          positions,
          indices,
          volume_mm3: response.volume_mm3,
          triangleCount: response.triangleCount,
          bbox: response.bbox,
          size: response.size,
        };

        useViewerStore.setState({ error: undefined });
        onGeometryLoaded?.(result);
        setError(undefined);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Failed to process file.';
        handleFailure(message);
        return;
      } finally {
        setLoading(false);
        resetInput();
      }
    },
    [handleFailure, loading, onGeometryLoaded, resetInput],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      await processFile(files[0]);
    },
    [processFile],
  );

  const baseStyles: CSSProperties = useMemo(
    () => ({
      border: `2px dashed ${highlighted ? '#38bdf8' : 'rgba(148, 163, 184, 0.5)'}`,
      borderRadius: '1rem',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.5)',
      transition: 'border-color 150ms ease, background 150ms ease',
    }),
    [highlighted],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setHighlighted(true);
      }}
      onDragLeave={() => setHighlighted(false)}
      onDrop={(event) => {
        event.preventDefault();
        setHighlighted(false);
        void handleFiles(event.dataTransfer.files);
      }}
      style={baseStyles}
    >
      <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Upload STL or 3MF</p>
      <p style={{ color: '#94a3b8', maxWidth: '32rem', textAlign: 'center', margin: 0 }}>
        Drag and drop a mesh file here or choose one from your computer. The model is parsed in a
        Web Worker so the UI stays responsive while geometry metrics are computed.
      </p>
      <label
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '9999px',
          background: '#38bdf8',
          color: '#0f172a',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {loading ? 'Processing…' : 'Choose file'}
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttribute}
          disabled={loading}
          style={{ display: 'none' }}
          onChange={(event) => {
            void handleFiles(event.target.files);
          }}
        />
      </label>
      {loading ? <p style={{ color: '#94a3b8', margin: 0 }}>Parsing geometry…</p> : null}
      {error ? <p style={{ color: '#f87171', margin: 0 }}>{error}</p> : null}
    </div>
  );
}
