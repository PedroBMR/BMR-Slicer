'use client';

import { useEffect } from 'react';

import { useViewerStore } from '../modules/store';

export function HistoryTimeline() {
  const history = useViewerStore((state) => state.history);
  const refreshHistory = useViewerStore((state) => state.refreshHistory);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  if (history.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        background: 'rgba(15, 23, 42, 0.45)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <h2 style={{ margin: 0 }}>Recent estimates</h2>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
        {history.map((entry) => (
          <li
            key={entry.id ?? entry.createdAt}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              background: 'rgba(30, 41, 59, 0.6)'
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{entry.fileName}</p>
              <p style={{ margin: 0, color: '#94a3b8' }}>
                {new Date(entry.createdAt).toLocaleString()} • {entry.summary.layers} layers
              </p>
            </div>
            <div style={{ textAlign: 'right', color: '#38bdf8' }}>
              <p style={{ margin: 0 }}>{entry.summary.volume.toFixed(1)} mm³</p>
              <p style={{ margin: 0 }}>{entry.summary.resinCost.toFixed(2)} cost</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
