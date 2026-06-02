const key = (institution, period) => `receivable_${institution}_${period}`;

export const saveReceivable = (institution, period, rows) => {
  try { localStorage.setItem(key(institution, period), JSON.stringify(rows)); }
  catch (e) { console.warn('Failed to save receivable:', e); }
};

export const getReceivable = (institution, period) => {
  try { return JSON.parse(localStorage.getItem(key(institution, period)) ?? 'null'); }
  catch { return null; }
};

export const clearReceivable = (institution, period) => localStorage.removeItem(key(institution, period));
