import { apiGet, apiPost, apiDelete } from '../lib/apiClient.js';
import { getPeriod } from './periodStore';

export const getDeductions = (period = getPeriod()) =>
  apiGet('/api/deductions', { period });

export const saveDeduction = (deduction, period = getPeriod()) =>
  apiPost('/api/deductions', deduction, { period });

export const importDeductions = (deductions, period = getPeriod()) =>
  apiPost('/api/deductions/import', { deductions }, { period });

export const clearDeductions = (period = getPeriod()) =>
  apiDelete('/api/deductions', { period });

export const deleteDeduction = (id, period = getPeriod()) =>
  apiDelete(`/api/deductions/${id}`, { period });
