import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { DEFAULT_PARAMETERS } from '../../modules/estimate';
import { useViewerStore } from '../../modules/store';

const generateLayersMock = vi.fn();
const estimateMock = vi.fn();
const analyzeGeometryMock = vi.fn();

vi.mock('../../modules/geometry/workerClient', () => ({
  getGeometryWorkerHandle: () => ({
    proxy: { analyzeGeometry: analyzeGeometryMock, generateLayers: generateLayersMock },
    terminate: vi.fn(),
    worker: {} as unknown as Worker
  }),
  releaseGeometryWorker: vi.fn()
}));

vi.mock('../../modules/estimate/workerClient', () => ({
  getEstimateWorkerHandle: () => ({
    proxy: { estimate: estimateMock },
    terminate: vi.fn(),
    worker: {} as unknown as Worker
  }),
  releaseEstimateWorker: vi.fn()
}));

const { saveEstimateMock, loadRecentEstimatesMock } = vi.hoisted(() => ({
  saveEstimateMock: vi.fn().mockResolvedValue(undefined),
  loadRecentEstimatesMock: vi.fn().mockResolvedValue([])
}));

vi.mock('../../modules/store/persistence', () => ({
  saveEstimate: saveEstimateMock,
  loadRecentEstimates: loadRecentEstimatesMock
}));

describe('useViewerStore worker integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateLayersMock.mockReset();
    estimateMock.mockReset();
    analyzeGeometryMock.mockReset();
    saveEstimateMock.mockReset();
    loadRecentEstimatesMock.mockReset();
    useViewerStore.setState({
      geometry: undefined,
      layers: [],
      summary: undefined,
      parameters: { ...DEFAULT_PARAMETERS },
      loading: false,
      error: undefined,
      fileName: undefined,
      history: [],
      geometryPayload: undefined,
      geometrySource: undefined,
      geometryMetrics: undefined,
      geometryCenter: undefined,
      loadFile: useViewerStore.getState().loadFile,
      setGeometry: useViewerStore.getState().setGeometry,
      setParameters: useViewerStore.getState().setParameters,
      recompute: useViewerStore.getState().recompute,
      reset: useViewerStore.getState().reset,
      refreshHistory: useViewerStore.getState().refreshHistory,
      disposeWorkers: useViewerStore.getState().disposeWorkers
    });
  });

  it('delegates slicing and estimation to workers on loadFile', async () => {
    analyzeGeometryMock.mockImplementation(async () => {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      return {
        positions: positions.buffer,
        indices: undefined,
        metrics: {
          boundingBox: { min: [-0.5, -0.5, -0.0], max: [0.5, 0.5, 0.0] },
          size: [1, 1, 0],
          triangleCount: 1,
          volume: { signed: 0.5, absolute: 0.5 },
          center: [0, 0, 0]
        }
      };
    });
    generateLayersMock.mockResolvedValue({
      layers: [
        {
          elevation: 0,
          area: 1,
          circumference: 2,
          boundingRadius: 3,
          centroid: [0, 0, 0] as [number, number, number],
          segments: [
            {
              start: [0, 0, 0] as [number, number, number],
              end: [1, 0, 0] as [number, number, number]
            }
          ]
        }
      ]
    });
    estimateMock.mockResolvedValue({
      summary: {
        volume: 1,
        mass: 2,
        resinCost: 3,
        durationMinutes: 4,
        layers: 1
      },
      layers: []
    });

    const fileBuffer = new ArrayBuffer(8);
    const file = new File([fileBuffer], 'cube.stl', { type: 'model/stl' });
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = vi
      .fn()
      .mockResolvedValue(fileBuffer.slice(0));

    await useViewerStore.getState().loadFile(file);

    expect(analyzeGeometryMock).toHaveBeenCalledTimes(1);
    expect(generateLayersMock).toHaveBeenCalledTimes(1);
    const [geometryRequest] = generateLayersMock.mock.calls[0];
    expect(geometryRequest.positions).toBeInstanceOf(ArrayBuffer);
    expect(estimateMock).toHaveBeenCalledTimes(1);

    const state = useViewerStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.summary?.volume).toBe(1);
  });

  it('captures validation errors when persistence rejects', async () => {
    analyzeGeometryMock.mockImplementation(async () => {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      return {
        positions: positions.buffer,
        indices: undefined,
        metrics: {
          boundingBox: { min: [-0.5, -0.5, -0.0], max: [0.5, 0.5, 0.0] },
          size: [1, 1, 0],
          triangleCount: 1,
          volume: { signed: 0.5, absolute: 0.5 },
          center: [0, 0, 0]
        }
      };
    });
    generateLayersMock.mockResolvedValue({
      layers: [
        {
          elevation: 0,
          area: 1,
          circumference: 2,
          boundingRadius: 3,
          centroid: [0, 0, 0] as [number, number, number],
          segments: [
            {
              start: [0, 0, 0] as [number, number, number],
              end: [1, 0, 0] as [number, number, number]
            }
          ]
        }
      ]
    });
    estimateMock.mockResolvedValue({
      summary: {
        volume: 1,
        mass: 2,
        resinCost: 3,
        durationMinutes: 4,
        layers: 1
      },
      layers: []
    });

    const error = new ZodError([]);
    saveEstimateMock.mockRejectedValueOnce(error);

    const fileBuffer = new ArrayBuffer(8);
    const file = new File([fileBuffer], 'cube.stl', { type: 'model/stl' });
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = vi
      .fn()
      .mockResolvedValue(fileBuffer.slice(0));
    await useViewerStore.getState().loadFile(file);

    await vi.waitFor(() => {
      expect(useViewerStore.getState().error).toContain('Failed to save estimate history');
    });
  });
});
