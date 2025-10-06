export const APP_NAME = 'BMR Slicer';
export const DEFAULT_SLICE_THICKNESS = 0.05;

export const FEATURE_FLAGS = {
  enableWorkers: typeof window !== 'undefined',
  debugLogging: process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true',
  enableGcodeUpload: process.env.NEXT_PUBLIC_ENABLE_GCODE_UPLOAD === 'true',
} as const;
