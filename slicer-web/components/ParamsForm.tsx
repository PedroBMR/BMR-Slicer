'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import {
  DEFAULT_PRINT_PARAMS,
  MATERIAL_DENSITIES,
  type EstimateBreakdown,
  type Material,
  type PrintParams,
} from '../lib/estimate';
import { getEstimateWorkerHandle } from '../modules/estimate/workerClient';
import { useViewerStore } from '../modules/store';

const MATERIAL_OPTIONS = Object.keys(MATERIAL_DENSITIES) as Material[];
const MaterialSchema = z.enum(MATERIAL_OPTIONS as [Material, ...Material[]]);

const FormSchema = z.object({
  material: MaterialSchema,
  layerHeight_mm: z.number().positive(),
  nozzleWidth_mm: z.number().positive(),
  printSpeed_mm_s: z.number().positive(),
  infill: z.number().min(0).max(1),
  wallFactor: z.number().min(0).max(1),
  topBottomFactor: z.number().min(0).max(1),
  mvf_mm3_s: z.number().positive(),
  overhead: z.number().min(0).max(1),
  pricePerKg: z.number().positive(),
  powerW: z.number().positive(),
  kwhPrice: z.number().min(0),
  maintPerHour: z.number().min(0),
  margin: z.number().min(0).max(1),
  filamentDiameter_mm: z.number().positive(),
});

type FormValues = z.infer<typeof FormSchema>;

type FormState = {
  [Key in keyof FormValues]: Key extends 'material' ? FormValues[Key] : string;
};

const DEFAULT_FORM_VALUES: FormState = {
  material: DEFAULT_PRINT_PARAMS.material,
  layerHeight_mm: '0.2',
  nozzleWidth_mm: '0.4',
  printSpeed_mm_s: '60',
  infill: DEFAULT_PRINT_PARAMS.infill.toString(),
  wallFactor: DEFAULT_PRINT_PARAMS.wallFactor.toString(),
  topBottomFactor: DEFAULT_PRINT_PARAMS.topBottomFactor.toString(),
  mvf_mm3_s: DEFAULT_PRINT_PARAMS.mvf.toString(),
  overhead: DEFAULT_PRINT_PARAMS.overhead.toString(),
  pricePerKg: DEFAULT_PRINT_PARAMS.pricePerKg.toString(),
  powerW: DEFAULT_PRINT_PARAMS.powerW.toString(),
  kwhPrice: DEFAULT_PRINT_PARAMS.kwhPrice.toString(),
  maintPerHour: DEFAULT_PRINT_PARAMS.maintPerHour.toString(),
  margin: DEFAULT_PRINT_PARAMS.margin.toString(),
  filamentDiameter_mm: DEFAULT_PRINT_PARAMS.filamentDiameter_mm.toString(),
};

const PRESETS: Array<{
  label: string;
  layerHeight_mm: number;
  printSpeed_mm_s: number;
}> = [
  { label: 'Qualidade Fina (0.12)', layerHeight_mm: 0.12, printSpeed_mm_s: 40 },
  { label: 'Padrão (0.20)', layerHeight_mm: 0.2, printSpeed_mm_s: 55 },
  { label: 'Rápido (0.28)', layerHeight_mm: 0.28, printSpeed_mm_s: 70 },
];

export interface ParamsFormProps {
  volumeModel_mm3: number;
  onEstimateChange: (estimate: EstimateBreakdown | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  onErrorChange?: (message: string | null) => void;
  initialParams?: Partial<PrintParams>;
}

export interface OverrideMetrics {
  time_s: number;
  filamentLen_mm: number;
}

export function mergeBreakdownWithOverride(
  base: EstimateBreakdown | null,
  override: OverrideMetrics | null | undefined,
): EstimateBreakdown | null {
  if (!base) {
    return null;
  }

  if (!override) {
    return { ...base, costs: { ...base.costs }, params: base.params };
  }

  return {
    ...base,
    costs: { ...base.costs },
    params: base.params,
    time_s: override.time_s,
    filamentLen_mm: override.filamentLen_mm,
  };
}

function formatNumber(value: number | undefined, fractionDigits = 2) {
  if (!Number.isFinite(value)) {
    return '';
  }
  return value!.toFixed(fractionDigits);
}

export function ParamsForm({
  volumeModel_mm3,
  onEstimateChange,
  onLoadingChange,
  onErrorChange,
  initialParams,
}: ParamsFormProps) {
  const mergedDefaults = useMemo(
    () => ({
      ...DEFAULT_FORM_VALUES,
      ...(initialParams?.infill !== undefined ? { infill: initialParams.infill.toString() } : {}),
      ...(initialParams?.wallFactor !== undefined
        ? { wallFactor: initialParams.wallFactor.toString() }
        : {}),
      ...(initialParams?.topBottomFactor !== undefined
        ? { topBottomFactor: initialParams.topBottomFactor.toString() }
        : {}),
      ...(initialParams?.mvf !== undefined ? { mvf_mm3_s: initialParams.mvf.toString() } : {}),
      ...(initialParams?.overhead !== undefined
        ? { overhead: initialParams.overhead.toString() }
        : {}),
      ...(initialParams?.pricePerKg !== undefined
        ? { pricePerKg: initialParams.pricePerKg.toString() }
        : {}),
      ...(initialParams?.powerW !== undefined ? { powerW: initialParams.powerW.toString() } : {}),
      ...(initialParams?.kwhPrice !== undefined
        ? { kwhPrice: initialParams.kwhPrice.toString() }
        : {}),
      ...(initialParams?.maintPerHour !== undefined
        ? { maintPerHour: initialParams.maintPerHour.toString() }
        : {}),
      ...(initialParams?.margin !== undefined ? { margin: initialParams.margin.toString() } : {}),
      ...(initialParams?.filamentDiameter_mm !== undefined
        ? { filamentDiameter_mm: initialParams.filamentDiameter_mm.toString() }
        : {}),
      ...(initialParams?.material !== undefined ? { material: initialParams.material } : {}),
    }),
    [initialParams],
  );

  const [formValues, setFormValues] = useState<FormState>(mergedDefaults);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [workerBreakdown, setWorkerBreakdown] = useState<EstimateBreakdown | null>(null);
  const gcodeOverride = useViewerStore((state) => state.gcodeOverride);
  const gcodeError = useViewerStore((state) => state.gcodeError);

  useEffect(() => {
    setFormValues(mergedDefaults);
  }, [mergedDefaults]);

  useEffect(() => {
    onErrorChange?.(gcodeError ?? generalError);
  }, [generalError, gcodeError, onErrorChange]);

  const parsedResult = useMemo(() => {
    const parsed: FormValues = {
      material: formValues.material,
      layerHeight_mm: parseNumber(formValues.layerHeight_mm),
      nozzleWidth_mm: parseNumber(formValues.nozzleWidth_mm),
      printSpeed_mm_s: parseNumber(formValues.printSpeed_mm_s),
      infill: parseNumber(formValues.infill),
      wallFactor: parseNumber(formValues.wallFactor),
      topBottomFactor: parseNumber(formValues.topBottomFactor),
      mvf_mm3_s: parseNumber(formValues.mvf_mm3_s),
      overhead: parseNumber(formValues.overhead),
      pricePerKg: parseNumber(formValues.pricePerKg),
      powerW: parseNumber(formValues.powerW),
      kwhPrice: parseNumber(formValues.kwhPrice),
      maintPerHour: parseNumber(formValues.maintPerHour),
      margin: parseNumber(formValues.margin),
      filamentDiameter_mm: parseNumber(formValues.filamentDiameter_mm),
    };
    return { data: parsed, result: FormSchema.safeParse(parsed) };
  }, [formValues]);

  useEffect(() => {
    if (parsedResult.result.success) {
      setFieldErrors({});
    } else {
      const errors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsedResult.result.error.issues) {
        const pathKey = issue.path[0];
        if (typeof pathKey === 'string') {
          errors[pathKey as keyof FormValues] = issue.message;
        }
      }
      setFieldErrors(errors);
    }
  }, [parsedResult]);

  const pendingRef = useRef(false);
  const lastSignatureRef = useRef<string | null>(null);
  const lastVolumeRef = useRef<number | null>(null);

  const updateLoading = useCallback(
    (loading: boolean) => {
      if (pendingRef.current === loading) {
        return;
      }
      pendingRef.current = loading;
      onLoadingChange?.(loading);
    },
    [onLoadingChange],
  );

  useEffect(() => {
    const { result, data } = parsedResult;

    if (!result.success) {
      setGeneralError('Preencha os campos com valores válidos.');
      setWorkerBreakdown(null);
      updateLoading(false);
      return;
    }

    if (volumeModel_mm3 <= 0) {
      setGeneralError('Carregue um modelo para obter o volume da peça.');
      setWorkerBreakdown(null);
      updateLoading(false);
      return;
    }

    const signature = JSON.stringify(data);
    if (signature === lastSignatureRef.current && volumeModel_mm3 === lastVolumeRef.current) {
      return;
    }
    lastSignatureRef.current = signature;
    lastVolumeRef.current = volumeModel_mm3;

    let cancelled = false;
    updateLoading(true);
    setGeneralError(null);
    pendingRef.current = true;

    const performEstimate = async () => {
      try {
        const worker = getEstimateWorkerHandle();
        const targetFlow_mm3_s = data.layerHeight_mm * data.nozzleWidth_mm * data.printSpeed_mm_s;
        const params: Partial<PrintParams> = {
          material: data.material,
          infill: data.infill,
          wallFactor: data.wallFactor,
          topBottomFactor: data.topBottomFactor,
          mvf: data.mvf_mm3_s,
          targetFlow_mm3_s,
          overhead: data.overhead,
          pricePerKg: data.pricePerKg,
          powerW: data.powerW,
          kwhPrice: data.kwhPrice,
          maintPerHour: data.maintPerHour,
          margin: data.margin,
          filamentDiameter_mm: data.filamentDiameter_mm,
        };

        const breakdown = await worker.proxy.estimateAll(volumeModel_mm3, params);
        if (!cancelled) {
          setWorkerBreakdown(breakdown);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Erro desconhecido ao estimar.';
          setGeneralError(message);
          setWorkerBreakdown(null);
        }
      } finally {
        if (!cancelled) {
          updateLoading(false);
        }
      }
    };

    void performEstimate();

    return () => {
      cancelled = true;
    };
  }, [parsedResult, updateLoading, volumeModel_mm3]);

  useEffect(() => {
    const merged = mergeBreakdownWithOverride(workerBreakdown, gcodeOverride);
    onEstimateChange(merged);
  }, [workerBreakdown, gcodeOverride, onEstimateChange]);

  function handleFieldChange<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(layerHeight: number, printSpeed: number) {
    setFormValues((current) => ({
      ...current,
      layerHeight_mm: layerHeight.toString(),
      printSpeed_mm_s: printSpeed.toString(),
    }));
  }

  const targetFlowDisplay = useMemo(() => {
    const { result, data } = parsedResult;
    if (!result.success) {
      return '';
    }
    const flow = data.layerHeight_mm * data.nozzleWidth_mm * data.printSpeed_mm_s;
    return formatNumber(flow, 2);
  }, [parsedResult]);

  const volumeDisplay = useMemo(() => formatNumber(volumeModel_mm3, 2), [volumeModel_mm3]);

  return (
    <section
      aria-label="Parâmetros de impressão"
      style={{
        background: 'rgba(15, 23, 42, 0.55)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Parâmetros de fatiamento</h2>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            Ajuste os parâmetros para estimar tempo, material e custos do seu trabalho de impressão.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.layerHeight_mm, preset.printSpeed_mm_s)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                border: '1px solid rgba(148, 163, 184, 0.4)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#e2e8f0',
                cursor: 'pointer',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <Field label="Material" error={fieldErrors.material}>
          <select
            value={formValues.material}
            onChange={(event) => handleFieldChange('material', event.target.value as Material)}
            style={selectStyle}
          >
            {MATERIAL_OPTIONS.map((materialOption) => (
              <option key={materialOption} value={materialOption}>
                {materialOption}
              </option>
            ))}
          </select>
        </Field>
        <NumberField
          label="Altura de camada (mm)"
          value={formValues.layerHeight_mm}
          onChange={(value) => handleFieldChange('layerHeight_mm', value)}
          error={fieldErrors.layerHeight_mm}
          min={0}
          step={0.01}
        />
        <NumberField
          label="Largura de bico (mm)"
          value={formValues.nozzleWidth_mm}
          onChange={(value) => handleFieldChange('nozzleWidth_mm', value)}
          error={fieldErrors.nozzleWidth_mm}
          min={0}
          step={0.01}
        />
        <NumberField
          label="Velocidade de impressão (mm/s)"
          value={formValues.printSpeed_mm_s}
          onChange={(value) => handleFieldChange('printSpeed_mm_s', value)}
          error={fieldErrors.printSpeed_mm_s}
          min={0}
          step={1}
        />
        <NumberField
          label="Infill"
          value={formValues.infill}
          onChange={(value) => handleFieldChange('infill', value)}
          error={fieldErrors.infill}
          min={0}
          max={1}
          step={0.05}
        />
        <NumberField
          label="Paredes"
          value={formValues.wallFactor}
          onChange={(value) => handleFieldChange('wallFactor', value)}
          error={fieldErrors.wallFactor}
          min={0}
          max={1}
          step={0.05}
        />
        <NumberField
          label="Topos e bases"
          value={formValues.topBottomFactor}
          onChange={(value) => handleFieldChange('topBottomFactor', value)}
          error={fieldErrors.topBottomFactor}
          min={0}
          max={1}
          step={0.05}
        />
        <NumberField
          label="Fluxo volumétrico máximo (mm³/s)"
          value={formValues.mvf_mm3_s}
          onChange={(value) => handleFieldChange('mvf_mm3_s', value)}
          error={fieldErrors.mvf_mm3_s}
          min={0}
          step={1}
        />
        <NumberField
          label="Overhead"
          value={formValues.overhead}
          onChange={(value) => handleFieldChange('overhead', value)}
          error={fieldErrors.overhead}
          min={0}
          max={1}
          step={0.05}
        />
        <NumberField
          label="Preço do filamento (R$/kg)"
          value={formValues.pricePerKg}
          onChange={(value) => handleFieldChange('pricePerKg', value)}
          error={fieldErrors.pricePerKg}
          min={0}
          step={1}
        />
        <NumberField
          label="Potência da impressora (W)"
          value={formValues.powerW}
          onChange={(value) => handleFieldChange('powerW', value)}
          error={fieldErrors.powerW}
          min={0}
          step={10}
        />
        <NumberField
          label="Preço kWh (R$)"
          value={formValues.kwhPrice}
          onChange={(value) => handleFieldChange('kwhPrice', value)}
          error={fieldErrors.kwhPrice}
          min={0}
          step={0.01}
        />
        <NumberField
          label="Manutenção (R$/h)"
          value={formValues.maintPerHour}
          onChange={(value) => handleFieldChange('maintPerHour', value)}
          error={fieldErrors.maintPerHour}
          min={0}
          step={1}
        />
        <NumberField
          label="Margem"
          value={formValues.margin}
          onChange={(value) => handleFieldChange('margin', value)}
          error={fieldErrors.margin}
          min={0}
          max={1}
          step={0.05}
        />
        <NumberField
          label="Diâmetro do filamento (mm)"
          value={formValues.filamentDiameter_mm}
          onChange={(value) => handleFieldChange('filamentDiameter_mm', value)}
          error={fieldErrors.filamentDiameter_mm}
          min={0}
          step={0.01}
        />
      </div>

      <footer style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            color: '#cbd5f5',
          }}
        >
          <div>
            <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Volume do modelo
            </strong>
            <span style={{ fontSize: '1.125rem' }}>{volumeDisplay} mm³</span>
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Fluxo alvo estimado
            </strong>
            <span style={{ fontSize: '1.125rem' }}>{targetFlowDisplay} mm³/s</span>
          </div>
        </div>
        {(gcodeError ?? generalError) ? (
          <p style={{ color: '#f87171', margin: 0 }}>{gcodeError ?? generalError}</p>
        ) : (
          <p style={{ color: '#94a3b8', margin: 0 }}>
            As estimativas são atualizadas automaticamente sempre que um campo é alterado.
          </p>
        )}
      </footer>
    </section>
  );
}

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
}

function NumberField({ label, value, onChange, error, min, max, step }: NumberFieldProps) {
  return (
    <Field label={label} error={error}>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        max={max}
        step={step}
        style={inputStyle}
      />
    </Field>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
  error?: string;
}

function Field({ label, children, error }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#e2e8f0' }}>
      <span style={{ fontSize: '0.85rem' }}>{label}</span>
      {children}
      {error ? <span style={{ color: '#f87171', fontSize: '0.75rem' }}>{error}</span> : null}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.7)',
  border: '1px solid rgba(148, 163, 184, 0.4)',
  borderRadius: '0.75rem',
  padding: '0.5rem 0.75rem',
  color: '#f8fafc',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
};

function parseNumber(raw: string): number {
  if (raw.trim() === '') {
    return Number.NaN;
  }
  return Number(raw);
}
