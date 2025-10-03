import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMETERS } from '../../modules/estimate';
import { DEFAULT_PRINT_PARAMS } from '../../lib/estimate';
import { useViewerStore } from '../../modules/store';

const mocks = vi.hoisted(() => {
  return {
    computeGeometryMock: vi.fn(),
    computeGeometryLayersMock: vi.fn(),
    computeEstimateMock: vi.fn()
  };
});

vi.mock('../../lib/compute', () => ({
  computeGeometry: mocks.computeGeometryMock,
  computeGeometryLayers: mocks.computeGeometryLayersMock,
  computeEstimate: mocks.computeEstimateMock,
  releaseGeometryCompute: vi.fn(),
  releaseEstimateCompute: vi.fn()
}));

describe('useViewerStore worker integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.computeGeometryMock.mockReset();
    mocks.computeGeometryLayersMock.mockReset();
    mocks.computeEstimateMock.mockReset();
    useViewerStore.setState({
      geometry: undefined,
      layers: [],
      summary: undefined,
      parameters: { ...DEFAULT_PARAMETERS },
      loading: false,
      error: undefined,
      fileName: undefined,
      geometryPayload: undefined,
      geometrySource: undefined,
      geometryMetrics: undefined,
      geometryCenter: undefined,
      loadFile: useViewerStore.getState().loadFile,
      setGeometry: useViewerStore.getState().setGeometry,
      setParameters: useViewerStore.getState().setParameters,
      recompute: useViewerStore.getState().recompute,
      reset: useViewerStore.getState().reset,
      disposeWorkers: useViewerStore.getState().disposeWorkers
    });
  });

  it('delegates slicing and estimation to workers on loadFile', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    mocks.computeGeometryMock.mockResolvedValue({
      positions,
      indices: undefined,
      metrics: {
        boundingBox: { min: [-0.5, -0.5, -0.0], max: [0.5, 0.5, 0.0] },
        size: [1, 1, 0],
        triangleCount: 1,
        volume: { signed: 0.5, absolute: 0.5 },
        center: [0, 0, 0]
      }
    });
    mocks.computeGeometryLayersMock.mockResolvedValue({
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
      ],
      volume: 1
    });
    mocks.computeEstimateMock.mockResolvedValue({
      breakdown: {
        volumeModel_mm3: 1,
        extrudedVolume_mm3: 1.5,
        mass_g: 2,
        filamentLen_mm: 3,
        time_s: 120,
        costs: {
          filament: 1,
          energy: 0.5,
          maintenance: 0.25,
          margin: 0.1,
          total: 1.85
        },
        params: DEFAULT_PRINT_PARAMS
      }
    });

    const fileBuffer = new ArrayBuffer(8);
    const file = new File([fileBuffer], 'cube.stl', { type: 'model/stl' });
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = vi
      .fn()
      .mockResolvedValue(fileBuffer.slice(0));

    await useViewerStore.getState().loadFile(file);

    expect(mocks.computeGeometryMock).toHaveBeenCalledTimes(1);
    expect(mocks.computeGeometryLayersMock).toHaveBeenCalledTimes(1);
    const [geometryRequest] = mocks.computeGeometryLayersMock.mock.calls[0];
    expect(geometryRequest.positions).toBeInstanceOf(Float32Array);
    expect(mocks.computeEstimateMock).toHaveBeenCalledTimes(1);
    expect(mocks.computeEstimateMock).toHaveBeenCalledWith(0.5);

    const state = useViewerStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.summary?.volume).toBe(1);
    expect(state.summary?.durationMinutes).toBeCloseTo(2);
  });

});
