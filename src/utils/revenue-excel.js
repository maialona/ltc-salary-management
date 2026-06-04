import { runExcelExport } from './excel-worker-client.js';

export const exportRevenueExcel = (rows, institutionFullName, period) =>
  runExcelExport('revenue', { rows, institutionFullName, period });
