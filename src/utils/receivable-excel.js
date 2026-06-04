import { runExcelExport } from './excel-worker-client.js';

export const exportReceivableExcel = (rows, institutionFullName, period) =>
  runExcelExport('receivable', { rows, institutionFullName, period });
