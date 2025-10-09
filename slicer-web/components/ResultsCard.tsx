'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FEATURE_FLAGS } from '../lib/config';
import { exportPDF, exportXLSX } from '../lib/exporters';
import { useSavedEstimatesStore } from '../modules/persistence/store';
import { useViewerStore } from '../modules/store';

import type { EstimateBreakdown } from '../lib/estimate';
import type { ExportPDFSection, ExportRow } from '../lib/exporters';
import type { ChangeEvent } from 'react';

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
  const { loadGcode, setGcodeEnabled, gcodeOverride, gcodeEnabled, gcodeLoading, gcodeError } =
    useViewerStore((state) => ({
      loadGcode: state.loadGcode,
      setGcodeEnabled: state.setGcodeEnabled,
      gcodeOverride: state.gcodeOverride,
      gcodeEnabled: state.gcodeEnabled,
      gcodeLoading: state.gcodeLoading,
      gcodeError: state.gcodeError,
    }));

  const { saveEstimate, saving } = useSavedEstimatesStore((state) => ({
    saveEstimate: state.saveEstimate,
    saving: state.saving,
  }));

  const gcodeInputRef = useRef<HTMLInputElement | null>(null);

  const baseFileName = useMemo(() => {
    if (!fileName || fileName.trim().length === 0) {
      return 'estimativa';
    }
    const trimmed = fileName.trim();
    const withoutExtension = trimmed.replace(/\.[^/.]+$/, '');
    return withoutExtension.length > 0 ? withoutExtension : 'estimativa';
  }, [fileName]);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const fileMeta = useMemo<
    | {
        name: string;
        size?: number;
        type?: string;
      }
    | undefined
  >(() => {
    if (geometrySource instanceof File) {
      return {
        name: geometrySource.name,
        size: geometrySource.size,
        type: geometrySource.type,
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

  const overrideTimeDisplay = useMemo(() => {
    if (!gcodeOverride) {
      return null;
    }
    const totalMinutes = gcodeOverride.time_s / 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${hours.toString().padStart(2, '0')}:${paddedMinutes}`;
  }, [gcodeOverride]);

  const overrideFilamentDisplay = useMemo(() => {
    if (!gcodeOverride) {
      return null;
    }
    return `${(gcodeOverride.filamentLen_mm / 1000).toFixed(2)} m`;
  }, [gcodeOverride]);

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
      timeMinutes: breakdown.time_s / 60,
    };
  }, [breakdown]);

  const handleGcodeUploadClick = useCallback(() => {
    if (gcodeLoading) {
      return;
    }
    setGcodeEnabled(true);
    gcodeInputRef.current?.click();
  }, [gcodeLoading, setGcodeEnabled]);

  const handleGcodeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void loadGcode(file);
      }
      event.target.value = '';
    },
    [loadGcode],
  );

  const handleGcodeToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const enabled = event.target.checked;
      setGcodeEnabled(enabled);
      if (enabled && !gcodeOverride) {
        gcodeInputRef.current?.click();
      }
    },
    [gcodeOverride, setGcodeEnabled],
  );

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
      fileMeta,
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

    const formatPercent = (value: number) => `${numberFormatter.format(value * 100)}%`;
    const formatNumber = (value: number) => numberFormatter.format(value);
    const formatCurrency = (value: number) => currencyFormatter.format(value);

    const metadataRows: ExportRow[] = [
      {
        section: 'Arquivo',
        metric: 'Nome',
        value: fileMeta?.name ?? baseFileName,
      },
    ];

    if (fileMeta?.type) {
      metadataRows.push({
        section: 'Arquivo',
        metric: 'Tipo',
        value: fileMeta.type,
      });
    }

    if (typeof fileMeta?.size === 'number') {
      const sizeInMb = fileMeta.size / (1024 * 1024);
      metadataRows.push({
        section: 'Arquivo',
        metric: 'Tamanho',
        value: `${formatNumber(sizeInMb)} MB`,
      });
    }

    const params = breakdown.params;
    const paramsRows: ExportRow[] = [
      { section: 'Parâmetros de impressão', metric: 'Material', value: params.material },
      { section: 'Parâmetros de impressão', metric: 'Infill', value: formatPercent(params.infill) },
      {
        section: 'Parâmetros de impressão',
        metric: 'Fator de parede',
        value: formatPercent(params.wallFactor),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Fator topo/base',
        value: formatPercent(params.topBottomFactor),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'MVF (mm³/s)',
        value: formatNumber(params.mvf),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Fluxo alvo (mm³/s)',
        value: formatNumber(params.targetFlow_mm3_s),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Overhead',
        value: formatPercent(params.overhead),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Preço por kg',
        value: formatCurrency(params.pricePerKg),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Potência (W)',
        value: formatNumber(params.powerW),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Preço kWh',
        value: formatCurrency(params.kwhPrice),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Manutenção por hora',
        value: formatCurrency(params.maintPerHour),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Margem',
        value: formatPercent(params.margin),
      },
      {
        section: 'Parâmetros de impressão',
        metric: 'Diâmetro do filamento (mm)',
        value: formatNumber(params.filamentDiameter_mm),
      },
    ];

    const timeMinutes = breakdown.time_s / 60;
    const timeHours = breakdown.time_s / 3600;
    const resultsRows: ExportRow[] = [
      {
        section: 'Resultados',
        metric: 'Volume do modelo (mm³)',
        value: formatNumber(breakdown.volumeModel_mm3),
      },
      {
        section: 'Resultados',
        metric: 'Volume extrudado (mm³)',
        value: formatNumber(breakdown.extrudedVolume_mm3),
      },
      {
        section: 'Resultados',
        metric: 'Massa (g)',
        value: formatNumber(breakdown.mass_g),
      },
      {
        section: 'Resultados',
        metric: 'Filamento (m)',
        value: formatNumber(breakdown.filamentLen_mm / 1000),
      },
      {
        section: 'Resultados',
        metric: 'Tempo (min)',
        value: formatNumber(timeMinutes),
      },
      {
        section: 'Resultados',
        metric: 'Tempo (h)',
        value: formatNumber(timeHours),
      },
    ];

    const costsRows: ExportRow[] = [
      {
        section: 'Custos',
        metric: 'Filamento',
        value: formatCurrency(breakdown.costs.filament),
      },
      {
        section: 'Custos',
        metric: 'Energia',
        value: formatCurrency(breakdown.costs.energy),
      },
      {
        section: 'Custos',
        metric: 'Manutenção',
        value: formatCurrency(breakdown.costs.maintenance),
      },
      {
        section: 'Custos',
        metric: 'Margem',
        value: formatCurrency(breakdown.costs.margin),
      },
      {
        section: 'Custos',
        metric: 'Total',
        value: formatCurrency(breakdown.costs.total),
      },
    ];

    const rows: ExportRow[] = [...metadataRows, ...paramsRows, ...resultsRows, ...costsRows];

    exportXLSX(rows, {
      fileName: `${baseFileName}-estimativa.xlsx`,
      sheetName: 'Resumo',
      headers: {
        section: 'Categoria',
        metric: 'Métrica',
        value: 'Valor',
      },
    });
  }, [baseFileName, breakdown, currencyFormatter, fileMeta, numberFormatter]);

  const handleExportPDF = useCallback(() => {
    if (!breakdown) {
      return;
    }

    const formatPercent = (value: number) => `${numberFormatter.format(value * 100)}%`;
    const formatNumber = (value: number) => numberFormatter.format(value);
    const formatCurrency = (value: number) => currencyFormatter.format(value);

    const metadataEntries: ExportPDFSection['entries'] = [
      {
        label: 'Nome',
        value: fileMeta?.name ?? baseFileName,
      },
    ];

    if (fileMeta?.type) {
      metadataEntries.push({ label: 'Tipo', value: fileMeta.type });
    }

    if (typeof fileMeta?.size === 'number') {
      const sizeInMb = fileMeta.size / (1024 * 1024);
      metadataEntries.push({ label: 'Tamanho', value: `${formatNumber(sizeInMb)} MB` });
    }

    const params = breakdown.params;
    const paramsEntries: ExportPDFSection['entries'] = [
      { label: 'Material', value: params.material },
      { label: 'Infill', value: formatPercent(params.infill) },
      { label: 'Fator de parede', value: formatPercent(params.wallFactor) },
      { label: 'Fator topo/base', value: formatPercent(params.topBottomFactor) },
      { label: 'MVF (mm³/s)', value: formatNumber(params.mvf) },
      { label: 'Fluxo alvo (mm³/s)', value: formatNumber(params.targetFlow_mm3_s) },
      { label: 'Overhead', value: formatPercent(params.overhead) },
      { label: 'Preço por kg', value: formatCurrency(params.pricePerKg) },
      { label: 'Potência (W)', value: formatNumber(params.powerW) },
      { label: 'Preço kWh', value: formatCurrency(params.kwhPrice) },
      { label: 'Manutenção por hora', value: formatCurrency(params.maintPerHour) },
      { label: 'Margem', value: formatPercent(params.margin) },
      { label: 'Diâmetro do filamento (mm)', value: formatNumber(params.filamentDiameter_mm) },
    ];

    const timeMinutes = breakdown.time_s / 60;
    const timeHours = breakdown.time_s / 3600;
    const resultsEntries: ExportPDFSection['entries'] = [
      { label: 'Volume do modelo (mm³)', value: formatNumber(breakdown.volumeModel_mm3) },
      { label: 'Volume extrudado (mm³)', value: formatNumber(breakdown.extrudedVolume_mm3) },
      { label: 'Massa (g)', value: formatNumber(breakdown.mass_g) },
      { label: 'Filamento (m)', value: formatNumber(breakdown.filamentLen_mm / 1000) },
      { label: 'Tempo (min)', value: formatNumber(timeMinutes) },
      { label: 'Tempo (h)', value: formatNumber(timeHours) },
    ];

    const costsEntries: ExportPDFSection['entries'] = [
      { label: 'Filamento', value: formatCurrency(breakdown.costs.filament) },
      { label: 'Energia', value: formatCurrency(breakdown.costs.energy) },
      { label: 'Manutenção', value: formatCurrency(breakdown.costs.maintenance) },
      { label: 'Margem', value: formatCurrency(breakdown.costs.margin) },
      { label: 'Total', value: formatCurrency(breakdown.costs.total) },
    ];

    const sections: ExportPDFSection[] = [
      { title: 'Arquivo', entries: metadataEntries },
      { title: 'Parâmetros de impressão', entries: paramsEntries },
      { title: 'Resultados', entries: resultsEntries },
      { title: 'Custos', entries: costsEntries },
    ].filter((section) => section.entries.length > 0);

    exportPDF(sections, {
      fileName: `${baseFileName}-estimativa.pdf`,
      documentTitle: 'Resumo da estimativa',
    });
  }, [baseFileName, breakdown, currencyFormatter, fileMeta, numberFormatter]);

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
  const showGcodeControls = FEATURE_FLAGS.enableGcodeUpload && hasBreakdown;
  const timeSourceNote =
    gcodeEnabled && gcodeOverride ? 'Tempo estimado com base no G-code carregado.' : null;

  return (
    <section
      aria-label="Resultados da estimativa"
      style={{
        background: 'rgba(15, 23, 42, 0.55)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
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
            gap: '0.5rem',
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
              cursor: hasBreakdown && !saving ? 'pointer' : 'not-allowed',
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
              cursor: hasBreakdown ? 'pointer' : 'not-allowed',
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
              cursor: hasBreakdown ? 'pointer' : 'not-allowed',
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
              cursor: hasBreakdown ? 'pointer' : 'not-allowed',
            }}
          >
            {copied ? 'Copiado!' : 'Copiar JSON'}
          </button>
        </div>
      </header>

      {showGcodeControls ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'rgba(15, 23, 42, 0.35)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}
        >
          <input
            ref={gcodeInputRef}
            type="file"
            accept=".gcode,.gco,.g,text/plain"
            style={{ display: 'none' }}
            onChange={handleGcodeChange}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>Usar G-code</span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Substitui as estimativas heurísticas com dados do arquivo carregado.
              </span>
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: gcodeLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {gcodeEnabled ? 'Ativo' : 'Desativado'}
              </span>
              <input
                type="checkbox"
                checked={gcodeEnabled}
                onChange={handleGcodeToggle}
                disabled={gcodeLoading}
                style={{ width: '1.25rem', height: '1.25rem' }}
              />
            </label>
          </div>
          {gcodeEnabled ? (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={handleGcodeUploadClick}
                  disabled={gcodeLoading}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '9999px',
                    border: '1px solid rgba(148, 163, 184, 0.4)',
                    background: gcodeLoading ? 'rgba(148, 163, 184, 0.2)' : '#38bdf8',
                    color: gcodeLoading ? '#94a3b8' : '#0f172a',
                    fontWeight: 600,
                    cursor: gcodeLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {gcodeLoading ? 'Processando...' : 'Selecionar G-code'}
                </button>
              </div>
              {gcodeOverride ? (
                <div style={{ color: '#cbd5f5', fontSize: '0.9rem' }}>
                  <strong>{gcodeOverride.fileName}</strong>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>Tempo: {overrideTimeDisplay}</span>
                    <span>Filamento: {overrideFilamentDisplay}</span>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, color: '#94a3b8' }}>
                  Selecione um arquivo G-code (.gcode, .gco, .g) para calcular tempo e filamento a
                  partir do conteúdo real de impressão.
                </p>
              )}
            </>
          ) : (
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Ative "Usar G-code" para carregar um arquivo e substituir as estimativas heurísticas de
              tempo e filamento.
            </p>
          )}
          {gcodeError ? <p style={{ margin: 0, color: '#f87171' }}>{gcodeError}</p> : null}
        </div>
      ) : null}

      {feedback ? <p style={{ color: '#4ade80', margin: 0 }}>{feedback}</p> : null}
      {feedbackError ? <p style={{ color: '#f97316', margin: 0 }}>{feedbackError}</p> : null}

      {error ? <p style={{ color: '#f87171', margin: 0 }}>{error}</p> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
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
            loading || !formattedBreakdown ? '---' : `R$ ${formattedBreakdown.totalCost.toFixed(2)}`
          }
        />
      </div>
      {timeSourceNote ? (
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>{timeSourceNote}</p>
      ) : null}

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
      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>
        {label}
      </span>
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
        background: 'rgba(15, 23, 42, 0.4)',
      }}
    >
      <span>{label}</span>
      <span>R$ {value.toFixed(2)}</span>
    </li>
  );
}
