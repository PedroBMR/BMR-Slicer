import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { ZodError } from 'zod';

import { DEFAULT_PARAMETERS } from '../../modules/estimate';
import { useViewerStore } from '../../modules/store';

const generateLayersMock = vi.fn();
const estimateMock = vi.fn();
var loadGeometryFromFileMock: ReturnType<typeof vi.fn>;

vi.mock('../../modules/geometry/workerClient', () => ({
  getGeometryWorkerHandle: () => ({
    proxy: { generateLayers: generateLayersMock },
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

vi.mock('../../modules/geometry', async () => {
  loadGeometryFromFileMock = vi.fn();
  const actual = await vi.importActual<typeof import('../../modules/geometry')>(
    '../../modules/geometry'
  );
  return {
    ...actual,
    loadGeometryFromFile: loadGeometryFromFileMock
  };
});

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
    loadGeometryFromFileMock?.mockReset();
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
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
    );

    loadGeometryFromFileMock!.mockResolvedValue(geometry);
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

    const file = new File([new ArrayBuffer(8)], 'cube.stl', { type: 'model/stl' });

    await useViewerStore.getState().loadFile(file);

    expect(loadGeometryFromFileMock).toBeDefined();
    expect(loadGeometryFromFileMock).toHaveBeenCalledWith(file);
    expect(generateLayersMock).toHaveBeenCalledTimes(1);
    const [geometryRequest] = generateLayersMock.mock.calls[0];
    expect(geometryRequest.positions).toBeInstanceOf(ArrayBuffer);
    expect(estimateMock).toHaveBeenCalledTimes(1);

    const state = useViewerStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.summary?.volume).toBe(1);
  });

  it('captures validation errors when persistence rejects', async () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
    );

    loadGeometryFromFileMock!.mockResolvedValue(geometry);
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

    const file = new File([new ArrayBuffer(8)], 'cube.stl', { type: 'model/stl' });
    await useViewerStore.getState().loadFile(file);

    await vi.waitFor(() => {
      expect(useViewerStore.getState().error).toContain('Failed to save estimate history');
    });
  });
});
