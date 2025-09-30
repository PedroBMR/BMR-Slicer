export const APP_NAME = 'BMR Slicer';
export const DEFAULT_SLICE_THICKNESS = 0.05;

export const FEATURE_FLAGS = {
  enableWorkers: typeof window !== 'undefined',
  debugLogging: process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true'
} as const;
