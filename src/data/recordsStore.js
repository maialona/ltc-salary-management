import { apiGet, apiPost, apiDelete } from '../lib/apiClient.js';
import { getPeriod } from './periodStore';

export const getRecords = (period = getPeriod()) =>
  apiGet('/api/records', { period });

export const saveRecords = (records, period = getPeriod()) =>
  apiPost('/api/records', { period, records });

export const clearRecords = (period = getPeriod()) =>
  apiDelete('/api/records', { period });

export const getSupportMainBgs = (period = getPeriod()) =>
  apiGet('/api/records/support-bgs', { period });
