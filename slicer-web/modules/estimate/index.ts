import { BufferGeometry, Vector3 } from 'three';

import { SliceSummary, sliceGeometry } from '../geometry';

export interface EstimateParameters {
  layerHeight: number; // millimetres
  resinDensity: number; // g/ml
  resinCostPerLiter: number; // currency per litre
  exposureTimeSeconds: number;
  liftDistance: number; // mm
  liftSpeed: number; // mm/min
}

export interface LayerEstimate extends SliceSummary {
  elevation: number;
  circumference: number;
}

export interface EstimateSummary {
  layers: LayerEstimate[];
  volume: number; // cubic millimetres
  mass: number; // grams
  resinCost: number; // currency
  durationMinutes: number;
}

export const DEFAULT_PARAMETERS: EstimateParameters = {
  layerHeight: 0.05,
  resinDensity: 1.1,
  resinCostPerLiter: 70,
  exposureTimeSeconds: 2.5,
  liftDistance: 6,
  liftSpeed: 180
};

export function integrateLayers(layers: LayerEstimate[], parameters = DEFAULT_PARAMETERS): EstimateSummary {
  const volume = layers.reduce((acc, layer) => acc + layer.area * parameters.layerHeight, 0);
  const volumeMl = volume * 0.001;
  const mass = volumeMl * parameters.resinDensity;
  const resinCost = (volumeMl / 1000) * parameters.resinCostPerLiter;

  const liftDurationPerLayer = parameters.liftDistance / parameters.liftSpeed;
  const durationMinutes =
    (layers.length * (parameters.exposureTimeSeconds / 60 + liftDurationPerLayer)) || 0;

  return {
    layers,
    volume,
    mass,
    resinCost,
    durationMinutes
  };
}

export interface LayerGenerationOptions {
  orientation?: Vector3;
  parameters?: EstimateParameters;
}

export function generateLayers(
  geometry: BufferGeometry,
  options: LayerGenerationOptions = {}
): LayerEstimate[] {
  const parameters = options.parameters ?? DEFAULT_PARAMETERS;
  const orientation = options.orientation?.clone().normalize() ?? new Vector3(0, 0, 1);

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) {
    return [];
  }

  const min = bounds.min.clone();
  const max = bounds.max.clone();
  const heightVector = max.clone().sub(min);
  const totalHeight = Math.abs(heightVector.dot(orientation));

  const layerCount = Math.max(1, Math.ceil(totalHeight / parameters.layerHeight));
  const origin = new Vector3();
  const normal = orientation.clone();

  const layers: LayerEstimate[] = [];

  for (let index = 0; index < layerCount; index++) {
    const distance = parameters.layerHeight * index;
    origin.copy(min).addScaledVector(orientation, distance);
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

  return layers;
}

export function estimatePrint(
  geometry: BufferGeometry,
  options: LayerGenerationOptions = {}
): EstimateSummary {
  const layers = generateLayers(geometry, options);
  return integrateLayers(layers, options.parameters);
}
