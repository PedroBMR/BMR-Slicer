'use client';

import { useCallback, useEffect, useState } from 'react';

import { useViewerStore } from '../modules/store';

export function FileDropZone() {
  const loadFile = useViewerStore((state) => state.loadFile);
  const loading = useViewerStore((state) => state.loading);
  const error = useViewerStore((state) => state.error);
  const disposeWorkers = useViewerStore((state) => state.disposeWorkers);
  const [highlighted, setHighlighted] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      await loadFile(files[0]);
    },
    [loadFile]
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
        handleFiles(event.dataTransfer.files);
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
        Supports STL or BufferGeometry JSON exports. The model will be processed in the browser and
        prepared for slicing.
      </p>
      <label
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '9999px',
          background: '#38bdf8',
          color: '#0f172a',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {loading ? 'Loading…' : 'Choose file'}
        <input
          disabled={loading}
          type="file"
          accept=".stl,application/json"
          style={{ display: 'none' }}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </label>
      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}
    </div>
  );
}
