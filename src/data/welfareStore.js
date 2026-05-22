const key = (period) => `welfare_summary_${period}`;

export const saveWelfare = (period, rows) => {
  try { localStorage.setItem(key(period), JSON.stringify(rows)); }
  catch (e) { console.warn('Failed to cache welfare summary:', e); }
};

export const getWelfare = (period) => {
  try { return JSON.parse(localStorage.getItem(key(period)) ?? 'null'); }
  catch { return null; }
};

export const clearWelfare = (period) => localStorage.removeItem(key(period));
