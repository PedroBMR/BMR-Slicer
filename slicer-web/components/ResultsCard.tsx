'use client';

import { useCallback, useMemo, useState } from 'react';

import type { EstimateBreakdown } from '../lib/estimate';

export interface ResultsCardProps {
  breakdown: EstimateBreakdown | null;
  loading?: boolean;
  error?: string | null;
}

export function ResultsCard({ breakdown, loading = false, error }: ResultsCardProps) {
  const [copied, setCopied] = useState(false);

  const timeDisplay = useMemo(() => {
    if (!breakdown) {
      return '--:--';
    }
    const totalMinutes = breakdown.time_s / 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${hours.toString().padStart(2, '0')}:${paddedMinutes}`;
  }, [breakdown]);

  const formattedBreakdown = useMemo(() => {
    if (!breakdown) {
      return null;
    }
    return {
      mass: breakdown.mass_g,
      totalCost: breakdown.costs.total,
      costs: breakdown.costs
    };
  }, [breakdown]);

  const handleCopy = useCallback(async () => {
    if (!breakdown) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(breakdown, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Falha ao copiar resumo', copyError);
      setCopied(false);
    }
  }, [breakdown]);

  return (
    <section
      aria-label="Resultados da estimativa"
      style={{
        background: 'rgba(15, 23, 42, 0.55)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Resultados</h2>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            Visualize peso, tempo de impressão e custos estimados em tempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!breakdown}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '9999px',
            border: '1px solid rgba(148, 163, 184, 0.4)',
            background: breakdown ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
            color: breakdown ? '#0f172a' : '#94a3b8',
            fontWeight: 600,
            cursor: breakdown ? 'pointer' : 'not-allowed'
          }}
        >
          {copied ? 'Copiado!' : 'Copiar JSON'}
        </button>
      </header>

      {error ? (
        <p style={{ color: '#f87171', margin: 0 }}>{error}</p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem'
        }}
      >
        <Metric label="Tempo estimado" value={loading ? '---' : timeDisplay} />
        <Metric
          label="Massa de filamento"
          value={loading || !formattedBreakdown ? '---' : `${formattedBreakdown.mass.toFixed(2)} g`}
        />
        <Metric
          label="Custo total"
          value={
            loading || !formattedBreakdown
              ? '---'
              : `R$ ${formattedBreakdown.totalCost.toFixed(2)}`
          }
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>Detalhamento de custos</h3>
        {loading ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>Calculando...</p>
        ) : !formattedBreakdown ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Ajuste os parâmetros para gerar uma nova estimativa.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
            <CostItem label="Filamento" value={formattedBreakdown.costs.filament} />
            <CostItem label="Energia" value={formattedBreakdown.costs.energy} />
            <CostItem label="Manutenção" value={formattedBreakdown.costs.maintenance} />
            <CostItem label="Margem" value={formattedBreakdown.costs.margin} />
          </ul>
        )}
      </div>
    </section>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div>
      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>{label}</span>
      <strong style={{ display: 'block', fontSize: '1.25rem' }}>{value}</strong>
    </div>
  );
}

interface CostItemProps {
  label: string;
  value: number;
}

function CostItem({ label, value }: CostItemProps) {
  return (
    <li
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        background: 'rgba(15, 23, 42, 0.4)'
      }}
    >
      <span>{label}</span>
      <span>R$ {value.toFixed(2)}</span>
    </li>
  );
}
