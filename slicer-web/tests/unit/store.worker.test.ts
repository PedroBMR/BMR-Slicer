import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMETERS } from '../../modules/estimate';
import { DEFAULT_PRINT_PARAMS } from '../../lib/estimate';
import { FILE_TOO_LARGE_ERROR, MAX_FILE_SIZE_BYTES, useViewerStore } from '../../modules/store';

const mocks = vi.hoisted(() => {
  return {
    computeGeometryMock: vi.fn(),
    computeGeometryLayersMock: vi.fn(),
    computeEstimateMock: vi.fn(),
    parseAndEstimateMock: vi.fn()
  };
});

vi.mock('../../lib/compute', () => ({
  computeGeometry: mocks.computeGeometryMock,
  computeGeometryLayers: mocks.computeGeometryLayersMock,
  computeEstimate: mocks.computeEstimateMock,
  releaseGeometryCompute: vi.fn(),
  releaseEstimateCompute: vi.fn()
}));

vi.mock('../../lib/gcode', () => ({
  parseAndEstimate: mocks.parseAndEstimateMock
}));

describe('useViewerStore worker integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.computeGeometryMock.mockReset();
    mocks.computeGeometryLayersMock.mockReset();
    mocks.computeEstimateMock.mockReset();
    mocks.parseAndEstimateMock.mockReset();
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
      estimateBreakdown: undefined,
      effectiveBreakdown: undefined,
      gcodeOverride: undefined,
      gcodeLoading: false,
      gcodeError: undefined,
      loadFile: useViewerStore.getState().loadFile,
      setGeometry: useViewerStore.getState().setGeometry,
      setParameters: useViewerStore.getState().setParameters,
      recompute: useViewerStore.getState().recompute,
      loadGcode: useViewerStore.getState().loadGcode,
      clearGcodeOverride: useViewerStore.getState().clearGcodeOverride,
      reset: useViewerStore.getState().reset,
      disposeWorkers: useViewerStore.getState().disposeWorkers
    });
  });

  it('delegates slicing and estimation to workers on loadFile', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    mocks.computeGeometryMock.mockResolvedValue({
      positions,
      positionsBuffer: positions.buffer,
      indices: undefined,
      indicesBuffer: undefined,
      metrics: {
        boundingBox: { min: [-0.5, -0.5, -0.0], max: [0.5, 0.5, 0.0] },
        size: [1, 1, 0],
        triangleCount: 1,
        volume: { signed: 0.5, absolute: 0.5 },
        center: [0, 0, 0]
      }
    });
    mocks.computeGeometryLayersMock.mockImplementation(async (request) => ({
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
      volume: 1,
      positions: request.positions,
      positionsBuffer: request.positionsBuffer ?? request.positions.buffer,
      indices: request.indices,
      indicesBuffer: request.indicesBuffer ?? request.indices?.buffer
    }));
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
    expect(geometryRequest.positionsBuffer).toBeInstanceOf(ArrayBuffer);
    expect(mocks.computeEstimateMock).toHaveBeenCalledTimes(1);
    expect(mocks.computeEstimateMock).toHaveBeenCalledWith(0.5);

    const state = useViewerStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.summary?.volume).toBe(1);
    expect(state.summary?.durationMinutes).toBeCloseTo(2);
  });

  it('prevents loading files larger than the maximum size', async () => {
    const file = new File(['dummy'], 'too-large.stl', { type: 'model/stl' });
    Object.defineProperty(file, 'size', {
      get: () => MAX_FILE_SIZE_BYTES + 1
    });

    await useViewerStore.getState().loadFile(file);

    expect(mocks.computeGeometryMock).not.toHaveBeenCalled();
    const state = useViewerStore.getState();
    expect(state.error).toBe(FILE_TOO_LARGE_ERROR);
    expect(state.loading).toBe(false);
  });

  it('applies G-code overrides and clears them correctly', async () => {
    const baseBreakdown = {
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
    };

    useViewerStore.setState({
      summary: {
        layers: [],
        volume: baseBreakdown.volumeModel_mm3,
        mass: baseBreakdown.mass_g,
        resinCost: baseBreakdown.costs.total,
        durationMinutes: baseBreakdown.time_s / 60
      },
      estimateBreakdown: baseBreakdown,
      effectiveBreakdown: baseBreakdown
    });

    const file = new File(['G1 X1 Y1 F1200'], 'override.gcode', { type: 'text/plain' });
    (file as unknown as { text: () => Promise<string> }).text = vi
      .fn()
      .mockResolvedValue('G1 X1 Y1 F1200');
    mocks.parseAndEstimateMock.mockReturnValue({ time_s: 600, filamentLen_mm: 12 });

    await useViewerStore.getState().loadGcode(file);

    const stateAfterLoad = useViewerStore.getState();
    expect(stateAfterLoad.gcodeOverride?.fileName).toBe('override.gcode');
    expect(stateAfterLoad.summary?.durationMinutes).toBeCloseTo(10);
    expect(stateAfterLoad.effectiveBreakdown?.time_s).toBe(600);
    expect(stateAfterLoad.effectiveBreakdown?.filamentLen_mm).toBe(12);

    useViewerStore.getState().clearGcodeOverride();

    const stateAfterClear = useViewerStore.getState();
    expect(stateAfterClear.gcodeOverride).toBeUndefined();
    expect(stateAfterClear.summary?.durationMinutes).toBeCloseTo(2);
    expect(stateAfterClear.effectiveBreakdown?.time_s).toBe(120);
    expect(stateAfterClear.effectiveBreakdown?.filamentLen_mm).toBe(3);
  });

  it('debounces recompute when parameters change rapidly', async () => {
    vi.useFakeTimers();

    try {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

      mocks.computeGeometryLayersMock.mockResolvedValue({
        layers: [],
        volume: 1,
        positions,
        positionsBuffer: positions.buffer,
        indices: undefined,
        indicesBuffer: undefined
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

      useViewerStore.setState({
        geometryPayload: {
          positions,
          positionsBuffer: positions.buffer,
          indices: undefined,
          indicesBuffer: undefined
        }
      });

      const promise1 = useViewerStore.getState().setParameters({ layerHeight_mm: 0.1 });
      const promise2 = useViewerStore.getState().setParameters({ layerHeight_mm: 0.2 });
      const promise3 = useViewerStore.getState().setParameters({ layerHeight_mm: 0.3 });

      await vi.runAllTimersAsync();
      await Promise.all([promise1, promise2, promise3]);

      expect(mocks.computeGeometryLayersMock).toHaveBeenCalledTimes(1);
      expect(mocks.computeEstimateMock).toHaveBeenCalledTimes(1);
      expect(useViewerStore.getState().parameters.layerHeight_mm).toBeCloseTo(0.3);
    } finally {
      vi.useRealTimers();
    }
  });
});
