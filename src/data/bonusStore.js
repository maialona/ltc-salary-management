import { apiGet, apiPost, apiDelete } from '../lib/apiClient.js';
import { getPeriod } from './periodStore';

export const getBonuses = (period = getPeriod()) =>
  apiGet('/api/bonuses', { period });

export const saveBonus = (bonus, period = getPeriod()) =>
  apiPost('/api/bonuses', bonus, { period });

export const importBonuses = (bonuses, period = getPeriod()) =>
  apiPost('/api/bonuses/import', { bonuses }, { period });

export const clearBonuses = (period = getPeriod()) =>
  apiDelete('/api/bonuses', { period });

export const deleteBonus = (id, period = getPeriod()) =>
  apiDelete(`/api/bonuses/${id}`, { period });
