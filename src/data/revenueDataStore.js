const key = (type, institution, period) => `revenue_${type}_${institution}_${period}`;

const save = (type, institution, period, data) => {
  try { localStorage.setItem(key(type, institution, period), JSON.stringify(data)); }
  catch (e) { console.warn(`Failed to save revenue ${type}:`, e); }
};

const get = (type, institution, period) => {
  try { return JSON.parse(localStorage.getItem(key(type, institution, period)) ?? 'null'); }
  catch { return null; }
};

const clear = (type, institution, period) => localStorage.removeItem(key(type, institution, period));

export const saveRevenueWelfare = (institution, period, rows) => save('welfare', institution, period, rows);
export const getRevenueWelfare = (institution, period) => get('welfare', institution, period);
export const clearRevenueWelfare = (institution, period) => clear('welfare', institution, period);

export const saveRevenueAcode = (institution, period, rows) => save('acode', institution, period, rows);
export const getRevenueAcode = (institution, period) => get('acode', institution, period);
export const clearRevenueAcode = (institution, period) => clear('acode', institution, period);

export const saveRevenueSelfPay = (institution, period, rows) => save('selfpay', institution, period, rows);
export const getRevenueSelfPay = (institution, period) => get('selfpay', institution, period);
export const clearRevenueSelfPay = (institution, period) => clear('selfpay', institution, period);

export const saveRevenueSupervisor = (institution, period, map) => save('supervisor', institution, period, map);
export const getRevenueSupervisor = (institution, period) => get('supervisor', institution, period);
export const clearRevenueSupervisor = (institution, period) => clear('supervisor', institution, period);
