'use client';

import { useCallback, useMemo, useState } from 'react';

import { FileDrop, type FileDropResult } from '../../components/FileDrop';
import { ModelViewer } from '../../components/ModelViewer';

function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  });
}

export default function MainPage() {
  const [mesh, setMesh] = useState<FileDropResult | null>(null);
  const [error, setError] = useState<string | undefined>();

  const handleGeometryLoaded = useCallback((result: FileDropResult) => {
    setMesh(result);
    setError(undefined);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const metrics = mesh
    ? {
        volume_mm3: mesh.volume_mm3,
        triangleCount: mesh.triangleCount,
        bbox: mesh.bbox,
        size: mesh.size,
      }
    : undefined;

  const dimensionRows = useMemo(() => {
    if (!mesh) {
      return [] as Array<{ label: string; value: string }>;
    }
    const [width, height, depth] = mesh.size;
    return [
      { label: 'Width (X)', value: `${formatNumber(width)} mm` },
      { label: 'Height (Y)', value: `${formatNumber(height)} mm` },
      { label: 'Depth (Z)', value: `${formatNumber(depth)} mm` },
    ];
  }, [mesh]);

  const boundsRows = useMemo(() => {
    if (!mesh) {
      return [] as Array<{ label: string; value: string }>;
    }
    const { min, max } = mesh.bbox;
    return [
      {
        label: 'Min',
        value: `${formatNumber(min[0])}, ${formatNumber(min[1])}, ${formatNumber(min[2])} mm`,
      },
      {
        label: 'Max',
        value: `${formatNumber(max[0])}, ${formatNumber(max[1])}, ${formatNumber(max[2])} mm`,
      },
    ];
  }, [mesh]);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        padding: '2rem 0',
      }}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <FileDrop onGeometryLoaded={handleGeometryLoaded} onError={handleError} />
        {error ? <span style={{ color: '#f87171' }}>{error}</span> : null}
      </section>
      {mesh ? (
        <>
          <section>
            <ModelViewer
              geometry={{ positions: mesh.positions, indices: mesh.indices }}
              metrics={metrics}
              fileName={mesh.fileName}
            />
          </section>
          <section
            style={{
              display: 'grid',
              gap: '1.5rem',
              background: 'rgba(15, 23, 42, 0.55)',
              borderRadius: '1rem',
              padding: '2rem',
            }}
          >
            <header
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <h2 style={{ margin: 0 }}>{mesh.fileName}</h2>
                <p style={{ margin: 0, color: '#94a3b8' }}>Model metrics computed off-thread.</p>
              </div>
              <button
                type="button"
                onClick={() => setMesh(null)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '9999px',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  background: 'transparent',
                  color: '#e2e8f0',
                  fontWeight: 600,
                }}
              >
                Upload another file
              </button>
            </header>
            <div
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <MetricCard title="Volume" value={`${formatNumber(mesh.volume_mm3)} mm³`} />
              <MetricCard
                title="Triangles"
                value={mesh.triangleCount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              />
              {dimensionRows.map((row) => (
                <MetricCard key={row.label} title={row.label} value={row.value} />
              ))}
              {boundsRows.map((row) => (
                <MetricCard key={row.label} title={`BBox ${row.label}`} value={row.value} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section
          style={{
            padding: '2rem',
            borderRadius: '1rem',
            border: '1px dashed rgba(148, 163, 184, 0.35)',
            textAlign: 'center',
            color: '#94a3b8',
            background: 'rgba(15, 23, 42, 0.45)',
          }}
        >
          <p style={{ margin: 0 }}>
            Upload an STL or 3MF file to visualise the geometry and volume.
          </p>
        </section>
      )}
    </main>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
}

function MetricCard({ title, value }: MetricCardProps) {
  return (
    <div
      style={{
        borderRadius: '0.75rem',
        background: 'rgba(30, 41, 59, 0.65)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      <span style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.75rem' }}>
        {title}
      </span>
      <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
