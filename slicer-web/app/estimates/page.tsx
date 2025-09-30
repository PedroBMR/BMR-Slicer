'use client';

import { EstimateSummary } from '../../components/EstimateSummary';
import { useViewerStore } from '../../modules/store';

export default function EstimatesPage() {
  const layers = useViewerStore((state) => state.layers);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <EstimateSummary />
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.55)',
          borderRadius: '1rem',
          padding: '1.5rem'
        }}
      >
        <h2 style={{ marginTop: 0 }}>Layer breakdown</h2>
        {layers.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Load a mesh to see generated layer metrics.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '0.875rem' }}>
                  <th style={{ padding: '0.5rem' }}>Layer</th>
                  <th style={{ padding: '0.5rem' }}>Elevation (mm)</th>
                  <th style={{ padding: '0.5rem' }}>Area (mm²)</th>
                  <th style={{ padding: '0.5rem' }}>Perimeter (mm)</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer, index) => (
                  <tr key={layer.elevation} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{index + 1}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{layer.elevation.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{layer.area.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{layer.circumference.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
