import { expose } from 'comlink';

import { estimateAll, type EstimateBreakdown, type PrintParams } from '../lib/estimate';

export interface EstimateWorkerRequest {
  volumeModel_mm3: number;
  params?: Partial<PrintParams>;
}

export interface EstimateWorkerResponse {
  breakdown: EstimateBreakdown;
}

const api = {
  estimate({ volumeModel_mm3, params }: EstimateWorkerRequest): EstimateWorkerResponse {
    const breakdown = estimateAll(volumeModel_mm3, params);
    return { breakdown };
  },
};

export type EstimateWorkerApi = typeof api;

expose(api);
