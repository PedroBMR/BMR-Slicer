import Link from 'next/link';

import { EstimateSummary } from '../components/EstimateSummary';
import { FileDropZone } from '../components/FileDropZone';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { APP_NAME } from '../lib/config';

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          display: 'grid',
          gap: '2rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{APP_NAME}</h1>
          <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.6 }}>
            Explore high fidelity slicing previews and resin usage estimates directly in the
            browser. Upload a mesh, inspect generated layers, and produce shareable print reports.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              href="/viewer"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                background: '#38bdf8',
                color: '#0f172a',
                fontWeight: 600
              }}
            >
              Open viewer
            </Link>
            <Link
              href="/estimates"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.5)',
                color: '#e2e8f0',
                fontWeight: 600
              }}
            >
              Review estimates
            </Link>
          </div>
        </div>
        <FileDropZone />
      </section>
      <EstimateSummary />
      <HistoryTimeline />
    </div>
  );
}
