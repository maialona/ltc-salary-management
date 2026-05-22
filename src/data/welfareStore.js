const key = (institution, period) => `welfare_summary_${institution}_${period}`;

export const saveWelfare = (institution, period, rows) => {
  try { localStorage.setItem(key(institution, period), JSON.stringify(rows)); }
  catch (e) { console.warn('Failed to cache welfare summary:', e); }
};

export const getWelfare = (institution, period) => {
  try { return JSON.parse(localStorage.getItem(key(institution, period)) ?? 'null'); }
  catch { return null; }
};

export const clearWelfare = (institution, period) => localStorage.removeItem(key(institution, period));
