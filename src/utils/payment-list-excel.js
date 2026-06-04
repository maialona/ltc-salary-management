import { runExcelExport } from './excel-worker-client.js';

export const exportPaymentListExcel = (rows, institutionCode, institutionName, institutionFullName, period) =>
  runExcelExport('paymentList', { rows, institutionCode, institutionName, institutionFullName, period });
