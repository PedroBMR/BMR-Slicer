'use client';

import { useEffect, useMemo } from 'react';

import { useSavedEstimatesStore, type SavedEstimate } from '../lib/store';

interface MetricDefinition {
  key: 'cost' | 'time' | 'mass';
  label: string;
  accessor: (estimate: SavedEstimate) => number;
  precision: number;
  unit: string;
}

const METRICS: MetricDefinition[] = [
  {
    key: 'cost',
    label: 'Custo total',
    accessor: (estimate) => estimate.results.costs.total,
    precision: 2,
    unit: 'R$',
  },
  {
    key: 'time',
    label: 'Tempo estimado',
    accessor: (estimate) => estimate.results.time_s / 60,
    precision: 1,
    unit: 'min',
  },
  {
    key: 'mass',
    label: 'Massa prevista',
    accessor: (estimate) => estimate.results.mass_g,
    precision: 2,
    unit: 'g',
  },
];

function formatValue(value: number, precision: number) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(precision);
}

function buildDelta(value: number, baseline: number, precision: number) {
  const delta = value - baseline;
  const threshold = precision > 0 ? 1 / 10 ** precision : 0.5;
  if (Math.abs(delta) < threshold) {
    return { text: 'Sem variação', color: '#94a3b8' } as const;
  }

  const sign = delta > 0 ? '+' : '−';
  const absolute = Math.abs(delta).toFixed(precision);
  const percent = baseline !== 0 ? Math.abs((delta / baseline) * 100).toFixed(1) : null;
  const suffix = percent && percent !== 'NaN' ? ` (${sign}${percent}%)` : '';

  return {
    text: `${sign}${absolute}${suffix}`,
    color: delta > 0 ? '#f87171' : '#4ade80',
  } as const;
}

export function CompareDrawer() {
  const {
    compareOpen,
    setCompareOpen,
    estimates,
    selectedIds,
    toggleSelection,
    clearSelection,
  } = useSavedEstimatesStore((state) => ({
    compareOpen: state.compareOpen,
    setCompareOpen: state.setCompareOpen,
    estimates: state.estimates,
    selectedIds: state.selectedIds,
    toggleSelection: state.toggleSelection,
    clearSelection: state.clearSelection,
  }));

  const selectedEstimates = useMemo(
    () =>
      selectedIds
        .map((id) => estimates.find((estimate) => estimate.id === id))
        .filter((estimate): estimate is SavedEstimate => Boolean(estimate)),
    [estimates, selectedIds],
  );

  useEffect(() => {
    if (!compareOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCompareOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [compareOpen, setCompareOpen]);

  if (!compareOpen) {
    return null;
  }

  const closeDrawer = () => setCompareOpen(false);
  const baseline = selectedEstimates[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comparar estimativas salvas"
      onClick={closeDrawer}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#e2e8f0',
          width: 'min(100%, 1040px)',
          height: '100%',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Comparar estimativas</h3>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Escolha diferentes presets para analisar impactos de custo, tempo e massa.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                background:
                  selectedIds.length === 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                color: selectedIds.length === 0 ? '#94a3b8' : '#e2e8f0',
                fontWeight: 500,
                cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={closeDrawer}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.4)',
                background: '#38bdf8',
                color: '#0f172a',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '1.5rem',
            flex: 1,
            minHeight: 0,
          }}
        >
          <aside
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              borderRadius: '1rem',
              padding: '1rem',
              overflowY: 'auto',
            }}
          >
            <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>Histórico salvo</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
              {estimates.map((estimate) => {
                const isSelected = selectedIds.includes(estimate.id);
                return (
                  <li key={estimate.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelection(estimate.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.75rem',
                        borderRadius: '0.75rem',
                        border: isSelected
                          ? '1px solid rgba(56, 189, 248, 0.6)'
                          : '1px solid rgba(148, 163, 184, 0.25)',
                        background: isSelected
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'rgba(30, 41, 59, 0.65)',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                        display: 'grid',
                        gap: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{estimate.name}</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {new Date(estimate.createdAt).toLocaleString()} • {estimate.material}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflow: 'hidden',
            }}
          >
            {selectedEstimates.length < 2 ? (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.65)',
                  borderRadius: '1rem',
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  flex: 1,
                }}
              >
                Selecione pelo menos duas estimativas para visualizar as diferenças entre presets.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  overflowX: 'auto',
                  paddingBottom: '0.5rem',
                }}
              >
                {selectedEstimates.map((estimate, index) => {
                  const isBaseline = index === 0;
                  return (
                    <article
                      key={estimate.id}
                      style={{
                        flex: '0 0 260px',
                        background: 'rgba(30, 41, 59, 0.75)',
                        borderRadius: '1rem',
                        border: isBaseline
                          ? '1px solid rgba(56, 189, 248, 0.6)'
                          : '1px solid rgba(148, 163, 184, 0.3)',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                      }}
                    >
                      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {isBaseline ? 'Referência' : `Comparação ${index + 1}`}
                        </span>
                        <strong style={{ fontSize: '1.05rem' }}>{estimate.name}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          {new Date(estimate.createdAt).toLocaleString()}
                        </span>
                      </header>

                      <dl style={{ margin: 0, display: 'grid', gap: '0.75rem' }}>
                        {METRICS.map((metric) => {
                          const value = metric.accessor(estimate);
                          const baseValue = baseline ? metric.accessor(baseline) : value;
                          const delta = isBaseline
                            ? { text: 'Baseline', color: '#38bdf8' }
                            : buildDelta(value, baseValue, metric.precision);

                          return (
                            <div key={metric.key} style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{
                                metric.label
                              }</span>
                              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                {metric.unit} {formatValue(value, metric.precision)}
                              </span>
                              <span style={{ color: delta.color, fontSize: '0.85rem' }}>{delta.text}</span>
                            </div>
                          );
                        })}
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
