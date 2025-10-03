'use client';

import { useMemo } from 'react';

import {
  exportSummary,
  exportSummaryAsPdf,
  exportSummaryAsXlsx
} from '../modules/export';
import { useViewerStore } from '../modules/store';

export function EstimateSummary() {
  const summary = useViewerStore((state) => state.summary);
  const fileName = useViewerStore((state) => state.fileName) ?? 'slicer-report';
  const gcodeOverride = useViewerStore((state) => state.gcodeOverride);

  const metrics = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { label: 'Layers', value: summary.layers.length.toString() },
      { label: 'Volume', value: `${summary.volume.toFixed(2)} mm³` },
      { label: 'Mass', value: `${summary.mass.toFixed(2)} g` },
      { label: 'Resin cost', value: `${summary.resinCost.toFixed(2)} currency` },
      { label: 'Estimated duration', value: `${summary.durationMinutes.toFixed(1)} minutes` }
    ];
  }, [summary]);

  if (!summary) {
    return (
      <section
        aria-label="Estimate summary"
        style={{
          padding: '2rem',
          borderRadius: '1rem',
          background: 'rgba(15, 23, 42, 0.5)',
          color: '#94a3b8'
        }}
      >
        Load a mesh to generate a print estimate.
      </section>
    );
  }

  return (
    <section
      aria-label="Estimate summary"
      style={{
        padding: '2rem',
        borderRadius: '1rem',
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Print estimate</h2>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            {gcodeOverride
              ? 'Timing derived from uploaded G-code.'
              : 'Computed using adaptive slicing heuristics.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => exportSummary({ fileName, summary })}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: 'none',
              background: '#38bdf8',
              color: '#0f172a',
              fontWeight: 600
            }}
          >
            Export JSON & CSV
          </button>
          <button
            type="button"
            onClick={() => exportSummaryAsXlsx({ fileName, summary })}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              background: 'transparent',
              color: '#f8fafc',
              fontWeight: 600
            }}
          >
            Download XLSX
          </button>
          <button
            type="button"
            onClick={() => exportSummaryAsPdf({ fileName, summary })}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              background: 'transparent',
              color: '#f8fafc',
              fontWeight: 600
            }}
          >
            Download PDF
          </button>
        </div>
      </header>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem'
        }}
      >
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>
              {metric.label}
            </dt>
            <dd style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
