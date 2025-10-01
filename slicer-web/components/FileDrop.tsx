'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useViewerStore } from '../modules/store';

const SUPPORTED_EXTENSIONS = ['.stl', '.3mf'];
const SUPPORTED_MIME_TYPES = new Set([
  'model/stl',
  'model/3mf',
  'application/vnd.ms-3mfdocument',
  'application/vnd.ms-package.3dmanufacturing-3dmodel'
]);

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return true;
  }
  return file.type ? SUPPORTED_MIME_TYPES.has(file.type) : false;
}

export function FileDrop() {
  const [highlighted, setHighlighted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loading = useViewerStore((state) => state.loading);
  const error = useViewerStore((state) => state.error);
  const loadFile = useViewerStore((state) => state.loadFile);
  const disposeWorkers = useViewerStore((state) => state.disposeWorkers);

  const resetInput = () => {
    const input = inputRef.current;
    if (input) {
      input.value = '';
    }
  };

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) {
        return;
      }

      if (!isSupportedFile(file)) {
        useViewerStore.setState({
          error: 'Unsupported file type. Please upload an STL or 3MF file.',
          loading: false
        });
        resetInput();
        return;
      }

      try {
        await loadFile(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        useViewerStore.setState({ error: message, loading: false });
      } finally {
        resetInput();
      }
    },
    [loadFile]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      if (loading) {
        return;
      }
      await handleFile(files[0]);
    },
    [handleFile, loading]
  );

  useEffect(() => {
    return () => {
      disposeWorkers();
    };
  }, [disposeWorkers]);

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
      style={{
        border: `2px dashed ${highlighted ? '#38bdf8' : 'rgba(148, 163, 184, 0.5)'}`,
        borderRadius: '1rem',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.5)'
      }}
    >
      <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>Drop a mesh file to begin slicing</p>
      <p style={{ color: '#94a3b8', maxWidth: '32rem', textAlign: 'center' }}>
        Supports STL or 3MF files. The model will be processed in the browser and prepared for
        slicing.
      </p>
      <label
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '9999px',
          background: '#38bdf8',
          color: '#0f172a',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Loading…' : 'Choose file'}
        <input
          ref={inputRef}
          disabled={loading}
          type="file"
          accept=".stl,.3mf,model/stl,model/3mf,application/vnd.ms-3mfdocument,application/vnd.ms-package.3dmanufacturing-3dmodel"
          style={{ display: 'none' }}
          onChange={(event) => {
            void handleFiles(event.target.files);
          }}
        />
      </label>
      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}
    </div>
  );
}
