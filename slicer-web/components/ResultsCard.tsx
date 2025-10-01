'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EstimateBreakdown } from '../lib/estimate';
import { exportPDF, exportXLSX } from '../modules/exporters';
import { useSavedEstimatesStore } from '../modules/persistence/store';
import { useViewerStore } from '../modules/store';

export interface ResultsCardProps {
  breakdown: EstimateBreakdown | null;
  loading?: boolean;
  error?: string | null;
}

export function ResultsCard({ breakdown, loading = false, error }: ResultsCardProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const fileName = useViewerStore((state) => state.fileName);
  const geometrySource = useViewerStore((state) => state.geometrySource);

  const { saveEstimate, saving } = useSavedEstimatesStore((state) => ({
    saveEstimate: state.saveEstimate,
    saving: state.saving
  }));

  const baseFileName = useMemo(() => {
    if (!fileName || fileName.trim().length === 0) {
      return 'estimativa';
    }
    const trimmed = fileName.trim();
    const withoutExtension = trimmed.replace(/\.[^/.]+$/, '');
    return withoutExtension.length > 0 ? withoutExtension : 'estimativa';
  }, [fileName]);

  const fileMeta = useMemo(() => {
    if (geometrySource instanceof File) {
      return {
        name: geometrySource.name,
        size: geometrySource.size,
        type: geometrySource.type
      };
    }
    if (fileName) {
      return { name: fileName };
    }
    return undefined;
  }, [geometrySource, fileName]);

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
      costs: breakdown.costs,
      volume: breakdown.volumeModel_mm3,
      filament: breakdown.filamentLen_mm,
      timeMinutes: breakdown.time_s / 60
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

  const handleSave = useCallback(async () => {
    if (!breakdown || saving) {
      return;
    }
    const defaultName = baseFileName || 'estimativa';
    const promptValue =
      typeof window !== 'undefined'
        ? window.prompt('Nome da estimativa', defaultName)
        : defaultName;
    if (promptValue === null) {
      return;
    }
    const trimmed = promptValue.trim();
    if (trimmed.length === 0) {
      setFeedback(null);
      setFeedbackError('Informe um nome válido para salvar a estimativa.');
      return;
    }

    setFeedback(null);
    setFeedbackError(null);

    const result = await saveEstimate({
      name: trimmed,
      material: breakdown.params.material,
      params: breakdown.params,
      volume_mm3: breakdown.volumeModel_mm3,
      results: breakdown,
      fileMeta
    });

    if (result !== undefined) {
      setFeedback('Estimativa salva com sucesso.');
    } else {
      setFeedbackError('Não foi possível salvar a estimativa.');
    }
  }, [baseFileName, breakdown, fileMeta, saveEstimate, saving]);

  const handleExportXLSX = useCallback(() => {
    if (!breakdown) {
      return;
    }
    const rows = [
      { Métrica: 'Nome', Valor: fileName ?? baseFileName },
      { Métrica: 'Material', Valor: breakdown.params.material },
      { Métrica: 'Volume (mm³)', Valor: Number(breakdown.volumeModel_mm3.toFixed(2)) },
      { Métrica: 'Massa (g)', Valor: Number(breakdown.mass_g.toFixed(2)) },
      { Métrica: 'Tempo (min)', Valor: Number((breakdown.time_s / 60).toFixed(2)) },
      { Métrica: 'Filamento (m)', Valor: Number((breakdown.filamentLen_mm / 1000).toFixed(2)) },
      { Métrica: 'Custo total (R$)', Valor: Number(breakdown.costs.total.toFixed(2)) },
      { Métrica: 'Energia (R$)', Valor: Number(breakdown.costs.energy.toFixed(2)) },
      { Métrica: 'Manutenção (R$)', Valor: Number(breakdown.costs.maintenance.toFixed(2)) },
      { Métrica: 'Margem (R$)', Valor: Number(breakdown.costs.margin.toFixed(2)) }
    ];
    exportXLSX(rows, { fileName: `${baseFileName}-estimativa.xlsx`, sheetName: 'Resumo' });
  }, [baseFileName, breakdown, fileName]);

  const handleExportPDF = useCallback(() => {
    if (!breakdown) {
      return;
    }
    const summary = {
      Nome: fileName ?? baseFileName,
      Material: breakdown.params.material,
      'Volume (mm³)': breakdown.volumeModel_mm3.toFixed(2),
      'Massa (g)': breakdown.mass_g.toFixed(2),
      'Tempo (min)': (breakdown.time_s / 60).toFixed(2),
      'Filamento (m)': (breakdown.filamentLen_mm / 1000).toFixed(2),
      'Custo total (R$)': breakdown.costs.total.toFixed(2),
      'Energia (R$)': breakdown.costs.energy.toFixed(2),
      'Manutenção (R$)': breakdown.costs.maintenance.toFixed(2),
      'Margem (R$)': breakdown.costs.margin.toFixed(2)
    } as Record<string, string>;
    exportPDF(summary, {
      fileName: `${baseFileName}-estimativa.pdf`,
      title: 'Resumo da estimativa',
      order: [
        'Nome',
        'Material',
        'Volume (mm³)',
        'Massa (g)',
        'Tempo (min)',
        'Filamento (m)',
        'Custo total (R$)',
        'Energia (R$)',
        'Manutenção (R$)',
        'Margem (R$)'
      ]
    });
  }, [baseFileName, breakdown, fileName]);

  useEffect(() => {
    if (!feedback && !feedbackError) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setFeedback(null);
      setFeedbackError(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback, feedbackError]);

  const hasBreakdown = Boolean(breakdown);

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
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Resultados</h2>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            Visualize peso, tempo de impressão e custos estimados em tempo real.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: '0.5rem'
          }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasBreakdown || saving}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: 'none',
              background: hasBreakdown && !saving ? '#22c55e' : 'rgba(148, 163, 184, 0.2)',
              color: hasBreakdown && !saving ? '#0f172a' : '#94a3b8',
              fontWeight: 600,
              cursor: hasBreakdown && !saving ? 'pointer' : 'not-allowed'
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={handleExportXLSX}
            disabled={!hasBreakdown}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              background: hasBreakdown ? 'rgba(15, 23, 42, 0.6)' : 'rgba(148, 163, 184, 0.2)',
              color: hasBreakdown ? '#f8fafc' : '#94a3b8',
              fontWeight: 600,
              cursor: hasBreakdown ? 'pointer' : 'not-allowed'
            }}
          >
            Exportar XLSX
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={!hasBreakdown}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              background: hasBreakdown ? 'rgba(15, 23, 42, 0.6)' : 'rgba(148, 163, 184, 0.2)',
              color: hasBreakdown ? '#f8fafc' : '#94a3b8',
              fontWeight: 600,
              cursor: hasBreakdown ? 'pointer' : 'not-allowed'
            }}
          >
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasBreakdown}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid rgba(148, 163, 184, 0.4)',
              background: hasBreakdown ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
              color: hasBreakdown ? '#0f172a' : '#94a3b8',
              fontWeight: 600,
              cursor: hasBreakdown ? 'pointer' : 'not-allowed'
            }}
          >
            {copied ? 'Copiado!' : 'Copiar JSON'}
          </button>
        </div>
      </header>

      {feedback ? (
        <p style={{ color: '#4ade80', margin: 0 }}>{feedback}</p>
      ) : null}
      {feedbackError ? (
        <p style={{ color: '#f97316', margin: 0 }}>{feedbackError}</p>
      ) : null}

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
