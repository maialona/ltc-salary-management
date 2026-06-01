import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { getCellValue } from './excel-core';

const readXls = (buffer) => {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { json: [], headers: [] };
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet['!ref']) return { json: [], headers: [] };

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
    headers[c] = cell ? String(cell.v ?? '').trim() : '';
  }
  const validHeaders = headers.filter(Boolean);

  const json = [];
  for (let r = 1; r <= range.e.r; r++) {
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

export const readExcel = async (file) => {
  try {
    const buffer = await file.arrayBuffer();

    if (file.name.toLowerCase().endsWith('.xls')) {
      return readXls(buffer);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { json: [], headers: [] };

    const headers = [];
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
      headers[cell.col - 1] = String(getCellValue(cell) ?? '');
    });
    const validHeaders = headers.filter(Boolean);

    const json = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
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

const triggerDownload = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const toMinGuoMonth = (dateStr) => {
  if (!dateStr) return '';
  const parts = String(dateStr).split('/');
  if (parts.length < 2) return '';
  const year = parseInt(parts[0], 10);
  if (isNaN(year)) return '';
  const month = parts[1].padStart(2, '0');
  return `${year - 1911}${month}`;
};

const rateLabel = (rateNum) => {
  const pct = Math.round(rateNum * 100);
  if (pct >= 70) return '七三';
  return '六四';
};

const buildRatio = (code, rateNum, role) => {
  if (!rateNum) return '';
  const label = code === 'AA09' ? 'AA09' : '其餘A碼';
  return `${label}${rateLabel(rateNum)}(${role})`;
};

export const downloadExcel = async (calculationResult, summaryResult, errors, debugInfo) => {
  const workbook = new ExcelJS.Workbook();

  const detailSheet = workbook.addWorksheet('詳細拆帳紀錄');
  detailSheet.addRow([
    '序號', '月份', '服務日期', '個案姓名', '個案主責督導', 'A碼代號',
    '財報用欄位', '細項', '居服員', '身分', '分得數量', '分配營收',
    '居服員抽成', '公司抽成', '拆帳金額', '目前居住行政區', '比例', '備註',
  ]);
  calculationResult.forEach((r) => {
    const rateNum = r.commissionRateNum || 0;
    const companyRate = rateNum > 0 ? `${Math.round((1 - rateNum) * 100)}%` : '';
    detailSheet.addRow([
      r.serialNum,
      toMinGuoMonth(r.date),
      r.date,
      r.client,
      r.supervisor,
      r.code,
      r.serialNum ? `${r.serialNum}${r.code}` : '',
      r.serialNum ? `${r.serialNum}A碼` : '',
      r.workerId ? r.workerId + r.worker : r.worker,
      r.role,
      r.qty,
      r.revenueAllocated,
      r.commissionRate,
      companyRate,
      r.amount,
      r.district || '',
      buildRatio(r.code, rateNum, r.role),
      r.note,
    ]);
  });

  const summarySheet = workbook.addWorksheet('人員薪資統計');
  summarySheet.addRow(['服務人員', '員編', '服務個案', '督導', '服務代碼', '數量', '小計', '拆帳金額']);
  summaryResult.forEach((s) => {
    s.details.forEach((d) => {
      summarySheet.addRow([
        s.name, s.id, d.client, d.supervisor, d.code, d.qty, d.subtotal, d.amount,
      ]);
    });
  });

  if (errors.length > 0) {
    const errSheet = workbook.addWorksheet('無法媒合紀錄');
    errSheet.addRow(['錯誤訊息']);
    errors.forEach((e) => errSheet.addRow([e]));
  }

  if (debugInfo) {
    const dbgSheet = workbook.addWorksheet('系統診斷報告');
    dbgSheet.addRow(['項目', '數值']);
    [
      ['A碼清冊原始總金額 (Input)', debugInfo.totalInput],
      ['成功媒合並分配之營收 (Matched Revenue)', debugInfo.totalAllocated],
      ['差異金額 (Diff)', debugInfo.diff],
      ['---', '---'],
      ['預計發放總薪資 (Total Salary)', debugInfo.totalCommissionPaid],
      ['產出結果筆數', debugInfo.resultCount],
    ].forEach((row) => dbgSheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `拆A碼結果_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
