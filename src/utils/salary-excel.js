import { runExcelExport } from './excel-worker-client.js';

export const exportBgsExcel     = (items, period) => runExcelExport('bgs',         { items, period });
export const exportAcodeExcel   = (items, period) => runExcelExport('acodeExport',  { items, period });
export const exportSummaryExcel = (items, period) => runExcelExport('summary',      { items, period });
export const exportSummary2Excel = (items, period) => runExcelExport('summary2',    { items, period });
