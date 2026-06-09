import { apiGet } from '../lib/apiClient';

// Returns { periods, employees } where:
//   periods: ["2025-01", "2025-02", ...]
//   employees: [{ empId, name, periods: { "2025-01": { bgs, acode } } }]
export const getSalaryTrend = () => apiGet('/api/analytics/salary-trend');

// Format "2025-06" → "114年06月" (Republic of China calendar)
export function periodToLabel(period) {
  const [year, month] = period.split('-').map(Number);
  return `${year - 1911}年${String(month).padStart(2, '0')}月`;
}
