'use client';

import { useEffect, useRef, useState } from 'react';

import type { LayerEstimate } from '../modules/estimate';
import { useViewerStore } from '../modules/store';
import { createViewer, type ViewerContext } from '../modules/viewer';

export function ViewerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const geometry = useViewerStore((state) => state.geometry);
  const layers = useViewerStore((state) => state.layers);
  const [selectedLayer, setSelectedLayer] = useState<number>(0);

  const viewerRef = useRef<ViewerContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    viewerRef.current = createViewer(canvas);
    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.updateGeometry(geometry);
  }, [geometry]);

  useEffect(() => {
    viewerRef.current?.updateSlice(layers[selectedLayer]);
  }, [layers, selectedLayer]);

  useEffect(() => {
    setSelectedLayer(0);
  }, [geometry]);

  useEffect(() => {
    if (selectedLayer >= layers.length) {
      setSelectedLayer(Math.max(0, layers.length - 1));
    }
  }, [layers, selectedLayer]);

  const selected = layers[selectedLayer];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', width: '100%' }}>
      <div
        style={{
          position: 'relative',
          borderRadius: '1rem',
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.75)',
          minHeight: '480px'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          aria-label="3D viewer canvas"
        />
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
                key={layer.elevation}
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
