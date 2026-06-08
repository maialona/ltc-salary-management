import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { getCellValue } from './excel-core';
import { runExcelExport } from './excel-worker-client.js';

const readXls = (buffer, headerRow = 1) => {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { json: [], headers: [] };
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet['!ref']) return { json: [], headers: [] };

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const headerRowIdx = headerRow - 1;
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
    headers[c] = cell ? String(cell.v ?? '').trim() : '';
  }
  const validHeaders = headers.filter(Boolean);

  const json = [];
  for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
    const rowData = {};
    let hasData = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const header = headers[c];
      if (!header) continue;
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      const val = cell != null ? cell.v ?? '' : '';
      rowData[header] = val;
      if (val !== '' && val !== null && val !== undefined) hasData = true;
    }
    if (hasData) json.push(rowData);
  }

  return { json, headers: validHeaders };
};

export const readExcel = async (file, { headerRow = 1 } = {}) => {
  try {
    const buffer = await file.arrayBuffer();

    if (file.name.toLowerCase().endsWith('.xls')) {
      return readXls(buffer, headerRow);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { json: [], headers: [] };

    const headers = [];
    worksheet.getRow(headerRow).eachCell({ includeEmpty: false }, (cell) => {
      headers[cell.col - 1] = String(getCellValue(cell) ?? '');
    });
    const validHeaders = headers.filter(Boolean);

    const json = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      const rowData = {};
      row.eachCell({ includeEmpty: true }, (cell) => {
        const header = headers[cell.col - 1];
        if (header) rowData[header] = getCellValue(cell) ?? '';
      });
      validHeaders.forEach((h) => { if (!(h in rowData)) rowData[h] = ''; });
      json.push(rowData);
    });

    return { json, headers: validHeaders };
  } catch (error) {
    throw new Error('Excel 解析失敗：' + error.message);
  }
};

export const downloadExcel = (calculationResult, summaryResult, errors, debugInfo) =>
  runExcelExport('acodeDownload', { calculationResult, summaryResult, errors, debugInfo });
