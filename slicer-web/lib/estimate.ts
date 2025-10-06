import { z } from 'zod';

export const MATERIAL_DENSITIES = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  TPU: 1.21,
  NYLON: 1.14,
} as const;

export type Material = keyof typeof MATERIAL_DENSITIES;

const MATERIAL_ENUM = z.enum(Object.keys(MATERIAL_DENSITIES) as [Material, ...Material[]]);

export const PrintParamsSchema = z.object({
  material: MATERIAL_ENUM,
  infill: z.number().min(0).max(1),
  wallFactor: z.number().min(0).max(1),
  topBottomFactor: z.number().min(0).max(1),
  mvf: z.number().positive(),
  targetFlow_mm3_s: z.number().positive(),
  overhead: z.number().min(0).max(1),
  pricePerKg: z.number().positive(),
  powerW: z.number().positive(),
  kwhPrice: z.number().min(0),
  maintPerHour: z.number().min(0),
  margin: z.number().min(0).max(1),
  filamentDiameter_mm: z.number().positive(),
});

export type PrintParams = z.infer<typeof PrintParamsSchema>;

const DEFAULT_PRINT_PARAMS_RAW: PrintParams = {
  material: 'PLA',
  infill: 0.2,
  wallFactor: 0.25,
  topBottomFactor: 0.15,
  mvf: 12,
  targetFlow_mm3_s: 10,
  overhead: 0.15,
  pricePerKg: 25,
  powerW: 120,
  kwhPrice: 0.12,
  maintPerHour: 2,
  margin: 0.2,
  filamentDiameter_mm: 1.75,
};

export const DEFAULT_PRINT_PARAMS: PrintParams = PrintParamsSchema.parse(DEFAULT_PRINT_PARAMS_RAW);

export interface EstimateBreakdown {
  volumeModel_mm3: number;
  mass_g: number;
  filamentLen_mm: number;
  time_s: number;
  extrudedVolume_mm3: number;
  costs: {
    filament: number;
    energy: number;
    maintenance: number;
    margin: number;
    total: number;
  };
  params: PrintParams;
}

export function estimateAll(
  volumeModel_mm3: number,
  params: Partial<PrintParams> = {},
): EstimateBreakdown {
  const materialCandidate = (params.material ?? DEFAULT_PRINT_PARAMS.material) as string;
  const normalizedMaterial = materialCandidate.toUpperCase() as Material;

  if (!(normalizedMaterial in MATERIAL_DENSITIES)) {
    throw new Error(`Unsupported material: ${materialCandidate}`);
  }

  const normalized = PrintParamsSchema.parse({
    ...DEFAULT_PRINT_PARAMS,
    ...params,
    material: normalizedMaterial,
  });

  const density = MATERIAL_DENSITIES[normalized.material];
  const volumeFactors = normalized.infill + normalized.wallFactor + normalized.topBottomFactor;
  const extrudedVolume_mm3 = Math.max(0, volumeModel_mm3 * volumeFactors);
  const volumeExtruded_cm3 = extrudedVolume_mm3 / 1000;
  const mass_g = volumeExtruded_cm3 * density;

  const filamentRadius_mm = normalized.filamentDiameter_mm / 2;
  const filamentArea_mm2 = Math.PI * filamentRadius_mm * filamentRadius_mm;
  const filamentLen_mm = filamentArea_mm2 > 0 ? extrudedVolume_mm3 / filamentArea_mm2 : 0;

  const effectiveFlow = Math.min(normalized.targetFlow_mm3_s, normalized.mvf);
  const baseTime_s = effectiveFlow > 0 ? extrudedVolume_mm3 / effectiveFlow : 0;
  const time_s = baseTime_s * (1 + normalized.overhead);

  const filamentCost = (mass_g / 1000) * normalized.pricePerKg;
  const time_h = time_s / 3600;
  const energyKwh = (normalized.powerW / 1000) * time_h;
  const energyCost = energyKwh * normalized.kwhPrice;
  const maintenanceCost = time_h * normalized.maintPerHour;

  const subtotal = filamentCost + energyCost + maintenanceCost;
  const marginCost = subtotal * normalized.margin;
  const totalCost = subtotal + marginCost;

  return {
    volumeModel_mm3,
    extrudedVolume_mm3,
    mass_g,
    filamentLen_mm,
    time_s,
    costs: {
      filament: filamentCost,
      energy: energyCost,
      maintenance: maintenanceCost,
      margin: marginCost,
      total: totalCost,
    },
    params: normalized,
  };
}
