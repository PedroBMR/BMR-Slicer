import { BufferGeometry, Vector3 } from 'three';
import { z } from 'zod';

import { sliceGeometry } from '../geometry';

const Vector3Schema = z.instanceof(Vector3);

export interface SliceSegment {
  start: Vector3;
  end: Vector3;
}

const SliceSegmentSchema = z.object({
  start: Vector3Schema,
  end: Vector3Schema
});

export interface SliceSummary {
  segments: SliceSegment[];
  centroid: Vector3;
  area: number;
  boundingRadius: number;
}

const SliceSummarySchema = z.object({
  segments: z.array(SliceSegmentSchema),
  centroid: Vector3Schema,
  area: z.number().nonnegative(),
  boundingRadius: z.number().nonnegative()
});

export const EstimateParametersSchema = z.object({
  layerHeight: z.number().positive(),
  resinDensity: z.number().positive(),
  resinCostPerLiter: z.number().nonnegative(),
  exposureTimeSeconds: z.number().nonnegative(),
  liftDistance: z.number().nonnegative(),
  liftSpeed: z.number().positive()
});

export interface LayerEstimate extends SliceSummary {
  elevation: number;
  circumference: number;
}

export const LayerEstimateSchema = SliceSummarySchema.extend({
  elevation: z.number().nonnegative(),
  circumference: z.number().nonnegative()
});

export interface EstimateSummary {
  layers: LayerEstimate[];
  volume: number;
  mass: number;
  resinCost: number;
  durationMinutes: number;
}

export const EstimateSummarySchema = z.object({
  layers: z.array(LayerEstimateSchema),
  volume: z.number().nonnegative(),
  mass: z.number().nonnegative(),
  resinCost: z.number().nonnegative(),
  durationMinutes: z.number().nonnegative()
});

const LayerEstimateArraySchema = z.array(LayerEstimateSchema);

export type EstimateParameters = z.infer<typeof EstimateParametersSchema>;

export const DEFAULT_PARAMETERS: EstimateParameters = {
  layerHeight: 0.05,
  resinDensity: 1.1,
  resinCostPerLiter: 70,
  exposureTimeSeconds: 2.5,
  liftDistance: 6,
  liftSpeed: 180
};

export function integrateLayers(layers: LayerEstimate[], parameters = DEFAULT_PARAMETERS): EstimateSummary {
  const safeParameters = EstimateParametersSchema.parse(parameters);
  const safeLayers = LayerEstimateArraySchema.parse(layers) as LayerEstimate[];

  const volume = safeLayers.reduce(
    (acc, layer) => acc + layer.area * safeParameters.layerHeight,
    0
  );
  const volumeMl = volume * 0.001;
  const mass = volumeMl * safeParameters.resinDensity;
  const resinCost = (volumeMl / 1000) * safeParameters.resinCostPerLiter;

  const liftDurationPerLayer = safeParameters.liftDistance / safeParameters.liftSpeed;
  const durationMinutes =
    (safeLayers.length * (safeParameters.exposureTimeSeconds / 60 + liftDurationPerLayer)) || 0;

  return EstimateSummarySchema.parse({
    layers: safeLayers,
    volume,
    mass,
    resinCost,
    durationMinutes
  }) as EstimateSummary;
}

export interface LayerGenerationOptions {
  orientation?: Vector3;
  parameters?: EstimateParameters;
}

export function generateLayers(
  geometry: BufferGeometry,
  options: LayerGenerationOptions = {}
): LayerEstimate[] {
  const parameters = EstimateParametersSchema.parse(options.parameters ?? DEFAULT_PARAMETERS);
  const orientation = options.orientation?.clone().normalize() ?? new Vector3(0, 0, 1);

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) {
    return [];
  }

  const min = bounds.min.clone();
  const max = bounds.max.clone();
  const extents = max.clone().sub(min);
  const orientationAbs = new Vector3(Math.abs(orientation.x), Math.abs(orientation.y), Math.abs(orientation.z));
  const totalHeight = orientationAbs.dot(extents);

  const layerCount = Math.max(1, Math.ceil(totalHeight / parameters.layerHeight));
  const origin = new Vector3();
  const startCorner = new Vector3(
    orientation.x >= 0 ? min.x : max.x,
    orientation.y >= 0 ? min.y : max.y,
    orientation.z >= 0 ? min.z : max.z
  );
  const normal = orientation.clone();

  const layers: LayerEstimate[] = [];

  for (let index = 0; index < layerCount; index++) {
    const distance = parameters.layerHeight * index;
    origin.copy(startCorner).addScaledVector(normal, distance);
    const summary = sliceGeometry(geometry, { origin, normal, thickness: parameters.layerHeight });
    const circumference = summary.segments.reduce((acc, segment) => {
      return acc + segment.start.distanceTo(segment.end);
    }, 0);

    layers.push({
      ...summary,
      circumference,
      elevation: distance
    });
  }

  return LayerEstimateArraySchema.parse(layers) as LayerEstimate[];
}

export function estimatePrint(
  geometry: BufferGeometry,
  options: LayerGenerationOptions = {}
): EstimateSummary {
  const parameters = options.parameters ?? DEFAULT_PARAMETERS;
  const layers = generateLayers(geometry, { ...options, parameters });
  return integrateLayers(layers, parameters);
}
