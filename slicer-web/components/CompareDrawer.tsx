'use client';

import { useEffect, useMemo } from 'react';

import { useSavedEstimatesStore, type SavedEstimate } from '../modules/persistence/store';

interface MetricDefinition {
  key: string;
  label: string;
  precision?: number;
  accessor: (estimate: SavedEstimate) => number;
}

const METRICS: MetricDefinition[] = [
  {
    key: 'cost',
    label: 'Custo total (R$)',
    precision: 2,
    accessor: (estimate) => estimate.results.costs.total,
  },
  {
    key: 'time',
    label: 'Tempo (min)',
    precision: 1,
    accessor: (estimate) => estimate.results.time_s / 60,
  },
  {
    key: 'mass',
    label: 'Massa (g)',
    precision: 2,
    accessor: (estimate) => estimate.results.mass_g,
  },
  {
    key: 'volume',
    label: 'Volume (mm³)',
    precision: 0,
    accessor: (estimate) => estimate.volume_mm3,
  },
  {
    key: 'filament',
    label: 'Filamento (m)',
    precision: 2,
    accessor: (estimate) => estimate.results.filamentLen_mm / 1000,
  },
];

function formatValue(value: number, precision = 2) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value.toFixed(precision);
}

function formatDelta(value: number, baseline: number, precision = 2) {
  const threshold = precision > 0 ? 1 / 10 ** precision : 0.5;
  const delta = value - baseline;
  if (Math.abs(delta) < threshold) {
    return { text: '—', color: '#94a3b8' };
  }
  const sign = delta > 0 ? '+' : '−';
  const absolute = Math.abs(delta).toFixed(precision);
  const percent = baseline !== 0 ? Math.abs((delta / baseline) * 100).toFixed(1) : null;
  const text =
    percent && percent !== 'NaN' ? `${sign}${absolute} (${sign}${percent}%)` : `${sign}${absolute}`;
  return { text, color: delta > 0 ? '#f87171' : '#4ade80' };
}

export function CompareDrawer() {
  const { compareOpen, setCompareOpen, estimates, selectedIds, toggleSelection, clearSelection } =
    useSavedEstimatesStore((state) => ({
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
          width: 'min(100%, 960px)',
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
            <h3 style={{ margin: 0 }}>Comparação de estimativas</h3>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Selecione pelo menos duas estimativas para visualizar diferenças de custo, tempo e
              material.
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
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            flex: 1,
            minHeight: 0,
          }}
        >
          <section
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              borderRadius: '1rem',
              padding: '1rem',
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            <h4 style={{ margin: '0 0 0.75rem 0' }}>Selecione estimativas</h4>
            <ul
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}
            >
              {estimates.length === 0 ? (
                <li style={{ color: '#94a3b8' }}>Nenhuma estimativa salva até o momento.</li>
              ) : (
                estimates.map((estimate) => {
                  const checked = selectedIds.includes(estimate.id);
                  return (
                    <li
                      key={estimate.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.85rem',
                        background: checked ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.6)',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          cursor: 'pointer',
                          flex: 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelection(estimate.id)}
                          style={{ width: '1rem', height: '1rem' }}
                        />
                        <span style={{ fontWeight: 600 }}>{estimate.name}</span>
                      </label>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        R$ {estimate.results.costs.total.toFixed(2)} •{' '}
                        {(estimate.results.time_s / 60).toFixed(1)} min
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {selectedEstimates.length < 2 ? (
              <p style={{ color: '#94a3b8', margin: 0 }}>
                Selecione ao menos duas estimativas para comparar métricas lado a lado.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                }}
              >
                {selectedEstimates.map((estimate, index) => (
                  <article
                    key={estimate.id}
                    style={{
                      borderRadius: '1rem',
                      border:
                        index === 0
                          ? '1px solid rgba(56, 189, 248, 0.5)'
                          : '1px solid rgba(148, 163, 184, 0.35)',
                      background: 'rgba(30, 41, 59, 0.8)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0 }}>{estimate.name}</h4>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                        {estimate.material} • {new Date(estimate.createdAt).toLocaleDateString()}
                      </p>
                      {index === 0 ? (
                        <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600 }}>
                          Referência
                        </span>
                      ) : null}
                    </div>
                    <dl style={{ display: 'grid', gap: '0.75rem', margin: 0 }}>
                      {METRICS.map((metric) => {
                        const value = metric.accessor(estimate);
                        const baseValue = baseline ? metric.accessor(baseline) : value;
                        const delta =
                          baseline && index !== 0
                            ? formatDelta(value, baseValue, metric.precision ?? 2)
                            : { text: index === 0 ? 'Referência' : '—', color: '#94a3b8' };
                        return (
                          <div
                            key={`${estimate.id}-${metric.key}`}
                            style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                          >
                            <dt
                              style={{
                                fontSize: '0.75rem',
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                              }}
                            >
                              {metric.label}
                            </dt>
                            <dd style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                              {formatValue(value, metric.precision ?? 2)}
                            </dd>
                            <span style={{ fontSize: '0.75rem', color: delta.color }}>
                              {delta.text}
                            </span>
                          </div>
                        );
                      })}
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
