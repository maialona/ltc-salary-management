import { invalidateCache } from '../lib/apiClient.js';

let currentPeriod = localStorage.getItem('salary_period') || new Date().toISOString().slice(0, 7); // YYYY-MM
const listeners = new Set();

export const getPeriod = () => currentPeriod;

export const setPeriod = (newPeriod) => {
    if (newPeriod === currentPeriod) return;
    currentPeriod = newPeriod;
    localStorage.setItem('salary_period', currentPeriod);
    invalidateCache(); // 切期間時清快取，避免看到前一期資料
    listeners.forEach(l => l(currentPeriod));
};

export const subscribePeriod = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// Helper for prev/next month
export const offsetPeriod = (months) => {
    const [year, month] = currentPeriod.split('-').map(Number);
    const date = new Date(year, month - 1 + months, 1); // JS months are 0-indexed
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    setPeriod(`${y}-${m}`);
};
