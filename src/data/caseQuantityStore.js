const key = (period) => `case_quantity_${period}`;

export const saveCaseQuantity = (period, rows) => {
  try {
    localStorage.setItem(key(period), JSON.stringify(rows));
  } catch (e) {
    console.warn('Failed to cache case quantity:', e);
  }
};

export const getCaseQuantity = (period) => {
  try {
    return JSON.parse(localStorage.getItem(key(period)) ?? 'null');
  } catch {
    return null;
  }
};

export const clearCaseQuantity = (period) => localStorage.removeItem(key(period));
