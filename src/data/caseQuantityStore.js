const key = (institution, period) => `case_quantity_${institution}_${period}`;

export const saveCaseQuantity = (institution, period, rows) => {
  try {
    localStorage.setItem(key(institution, period), JSON.stringify(rows));
  } catch (e) {
    console.warn('Failed to cache case quantity:', e);
  }
};

export const getCaseQuantity = (institution, period) => {
  try {
    return JSON.parse(localStorage.getItem(key(institution, period)) ?? 'null');
  } catch {
    return null;
  }
};

export const clearCaseQuantity = (institution, period) => localStorage.removeItem(key(institution, period));
