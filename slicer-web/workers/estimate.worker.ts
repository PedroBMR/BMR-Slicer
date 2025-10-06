import { expose } from 'comlink';

import {
  estimateAll as estimateAllFromLib,
  type EstimateBreakdown,
  type PrintParams,
} from '../lib/estimate';

export interface EstimateWorkerApi {
  estimateAll(volumeModel_mm3: number, params?: Partial<PrintParams>): EstimateBreakdown;
}

const api: EstimateWorkerApi = {
  estimateAll(volumeModel_mm3, params) {
    return estimateAllFromLib(volumeModel_mm3, params);
  },
};

expose(api);
