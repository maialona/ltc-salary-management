import { apiGet, apiPut, apiDelete } from '../lib/apiClient.js';
import { getPeriod } from './periodStore';

export const getAcodeResults = async (period = getPeriod()) => {
  try {
    return await apiGet('/api/acode-results', { period });
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
};

export const saveAcodeResults = (data, period = getPeriod()) =>
  apiPut('/api/acode-results', data, { period });

export const deleteAcodeResults = (period = getPeriod()) =>
  apiDelete('/api/acode-results', { period });
