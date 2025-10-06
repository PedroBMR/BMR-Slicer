'use client';

import { useCallback, useEffect } from 'react';

import { CompareDrawer } from './CompareDrawer';
import { useSavedEstimatesStore } from '../modules/persistence/store';

export function HistoryTimeline() {
  const {
    estimates,
    loadEstimates,
    loading,
    error,
    deleteEstimate,
    setCompareOpen,
    setSelection,
    clearSelection,
    selectedIds,
  } = useSavedEstimatesStore((state) => ({
    estimates: state.estimates,
    loadEstimates: state.loadEstimates,
    loading: state.loading,
    error: state.error,
    deleteEstimate: state.deleteEstimate,
    setCompareOpen: state.setCompareOpen,
    setSelection: state.setSelection,
    clearSelection: state.clearSelection,
    selectedIds: state.selectedIds,
  }));

  useEffect(() => {
    void loadEstimates();
  }, [loadEstimates]);

  const selectedCount = selectedIds.length;
  const hasMultiple = estimates.length >= 2;

  const openCompare = useCallback(() => {
    if (selectedCount < 2 && hasMultiple) {
      const defaults = estimates.slice(0, 2).map((estimate) => estimate.id);
      setSelection(defaults);
    }
    setCompareOpen(true);
  }, [estimates, hasMultiple, selectedCount, setCompareOpen, setSelection]);

  const handleCompareSingle = useCallback(
    (id: number) => {
      const next = selectedIds.includes(id) ? selectedIds : [...selectedIds, id];
      setSelection(next);
      setCompareOpen(true);
    },
    [selectedIds, setCompareOpen, setSelection],
  );

  const handleDelete = useCallback(
    (id: number) => {
      void deleteEstimate(id);
    },
    [deleteEstimate],
  );

  if (!loading && estimates.length === 0) {
    return <CompareDrawer />;
  }

  return (
    <>
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          borderRadius: '1rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Histórico de estimativas</h2>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Revise estimativas salvas e compare diferentes combinações de parâmetros.
            </p>
          </div>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}
          >
            <button
              type="button"
              onClick={openCompare}
              disabled={!hasMultiple && selectedCount < 2}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.4)',
                background:
                  selectedCount >= 2 || hasMultiple ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
                color: selectedCount >= 2 || hasMultiple ? '#0f172a' : '#94a3b8',
                fontWeight: 600,
                cursor: selectedCount >= 2 || hasMultiple ? 'pointer' : 'not-allowed',
              }}
            >
              {selectedCount > 1 ? `Comparar (${selectedCount})` : 'Comparar estimativas'}
            </button>
            {selectedCount > 0 ? (
              <button
                type="button"
                onClick={clearSelection}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '9999px',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  color: '#e2e8f0',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Limpar seleção
              </button>
            ) : null}
          </div>
        </header>

        {error ? <p style={{ color: '#f87171', margin: 0 }}>{error}</p> : null}
        {loading ? <p style={{ color: '#94a3b8', margin: 0 }}>Carregando histórico...</p> : null}

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
          {estimates.map((estimate) => {
            const isSelected = selectedIds.includes(estimate.id);
            const totalCost = estimate.results.costs.total;
            const timeMinutes = estimate.results.time_s / 60;
            const volume = estimate.volume_mm3;
            return (
              <li
                key={estimate.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '0.9rem 1.1rem',
                  borderRadius: '0.85rem',
                  background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.65)',
                  border: isSelected
                    ? '1px solid rgba(56, 189, 248, 0.45)'
                    : '1px solid transparent',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{estimate.name}</p>
                    <p style={{ margin: 0, color: '#94a3b8' }}>
                      {new Date(estimate.createdAt).toLocaleString()} • {estimate.material}
                    </p>
                    <p style={{ margin: 0, color: '#cbd5f5', fontSize: '0.875rem' }}>
                      Volume: {volume.toFixed(0)} mm³ • Massa: {estimate.results.mass_g.toFixed(1)}{' '}
                      g
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '120px' }}>
                    <p style={{ margin: 0, color: '#38bdf8', fontWeight: 600 }}>
                      R$ {totalCost.toFixed(2)}
                    </p>
                    <p style={{ margin: 0, color: '#94a3b8' }}>{timeMinutes.toFixed(1)} min</p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleCompareSingle(estimate.id)}
                    style={{
                      padding: '0.45rem 1.1rem',
                      borderRadius: '9999px',
                      border: '1px solid rgba(56, 189, 248, 0.5)',
                      background: isSelected ? '#38bdf8' : 'transparent',
                      color: isSelected ? '#0f172a' : '#38bdf8',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isSelected ? 'Selecionado' : 'Comparar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(estimate.id)}
                    style={{
                      padding: '0.45rem 1.1rem',
                      borderRadius: '9999px',
                      border: '1px solid rgba(248, 113, 113, 0.35)',
                      background: 'transparent',
                      color: '#f87171',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <CompareDrawer />
    </>
  );
}
