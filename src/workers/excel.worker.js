import ExcelJS from 'exceljs';

// ── Shared helpers ────────────────────────────────────────────────────────────
const num = (v) => (v && v !== 0) ? v : 0;

const styleHeader = (row) => {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
  });
  row.height = 22;
};

const styleDataRow = (row, isEven) => {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
    };
    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
  });
};

const styleTotalsRow = (row) => {
  row.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    cell.numFmt = '#,##0';
    cell.alignment = { horizontal: 'right' };
  });
  row.getCell(1).alignment = { horizontal: 'left' };
};

// ── BGS 薪資表 ────────────────────────────────────────────────────────────────
const buildBgsBuffer = async ({ items, period }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BGS碼薪資');

  sheet.columns = [
    '員編', '姓名', '領款方式',
    'B碼申請金額', 'G碼申請金額', 'S碼申請金額', '服務未遇',
    'B碼拆帳金額', 'G碼拆帳金額', 'S碼拆帳金額', '服務未遇拆帳', '服務所得總額',
    '其他補貼', '其他(1)', '應領金額',
    '勞保級距', '勞保費用', '健保級距', '健保眷屬人數', '健保費用',
    '勞退自提%', '應扣勞退自提', '應扣費用(1)', '總額', '實領金額',
  ].map((h, i) => ({ header: h, key: `c${i}`, width: i < 3 ? 12 : 14 }));

  styleHeader(sheet.getRow(1));

  items.forEach((item, idx) => {
    const row = sheet.addRow([
      item.empId, item.name, item.paymentMethod,
      num(item.rawB), num(item.rawG), num(item.rawS), num(item.rawMissed),
      num(item.splitB), num(item.splitG), num(item.splitS), num(item.splitMissed), num(item.serviceIncome),
      num(item.otherSubsidy), num(item.other1), num(item.payable),
      num(item.laborBracket), num(item.laborFee), num(item.healthBracket), item.healthDependents, num(item.healthFee),
      item.pensionRate ? item.pensionRate / 100 : 0, num(item.pensionFee), num(item.otherDeduction1),
      num(item.total), item.netSalary,
    ]);
    styleDataRow(row, idx % 2 === 1);
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum >= 4 && colNum !== 19 && colNum !== 21) {
        cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' };
      }
    });
    const pensionCell = row.getCell(21);
    pensionCell.numFmt = '0.00%'; pensionCell.alignment = { horizontal: 'right' };
  });

  if (items.length > 0) {
    styleTotalsRow(sheet.addRow([
      '合計', '', '',
      items.reduce((s, r) => s + num(r.rawB), 0),
      items.reduce((s, r) => s + num(r.rawG), 0),
      items.reduce((s, r) => s + num(r.rawS), 0),
      items.reduce((s, r) => s + num(r.rawMissed), 0),
      items.reduce((s, r) => s + num(r.splitB), 0),
      items.reduce((s, r) => s + num(r.splitG), 0),
      items.reduce((s, r) => s + num(r.splitS), 0),
      items.reduce((s, r) => s + num(r.splitMissed), 0),
      items.reduce((s, r) => s + num(r.serviceIncome), 0),
      items.reduce((s, r) => s + num(r.otherSubsidy), 0),
      items.reduce((s, r) => s + num(r.other1), 0),
      items.reduce((s, r) => s + num(r.payable), 0),
      '', items.reduce((s, r) => s + num(r.laborFee), 0),
      '', '',
      items.reduce((s, r) => s + num(r.healthFee), 0),
      '', items.reduce((s, r) => s + num(r.pensionFee), 0),
      items.reduce((s, r) => s + num(r.otherDeduction1), 0),
      items.reduce((s, r) => s + num(r.total), 0),
      items.reduce((s, r) => s + r.netSalary, 0),
    ]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: `BGS碼薪資_${period}.xlsx` };
};

// ── A碼及其他獎金表 ────────────────────────────────────────────────────────────
const buildAcodeExportBuffer = async ({ items, period }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('A碼及其他獎金');

  sheet.columns = [
    '員編', '姓名', '領款方式',
    'A碼申請金額', 'A碼拆帳金額', '服務所得總額',
    '跨區補助', '服務獎金', '額度開發', '丙證獎金', '介紹費', '帶新人津貼', '節日獎金',
    '其他補貼', '其他(2)', '應領金額',
    '扣繳稅額', '油資補貼', '應扣費用(2)', '總額', '實領金額',
  ].map((h, i) => ({ header: h, key: `c${i}`, width: i < 3 ? 12 : 14 }));

  styleHeader(sheet.getRow(1));

  items.forEach((item, idx) => {
    const row = sheet.addRow([
      item.empId, item.name, item.paymentMethod,
      num(item.rawA), num(item.splitA), num(item.serviceIncome),
      num(item.crossArea), num(item.serviceBonus), num(item.quotaDev), num(item.certBonus),
      num(item.referral), num(item.mentoring), num(item.holidayBonus),
      num(item.otherSubsidy), num(item.other2), num(item.payable),
      num(item.withholdingTax), num(item.fuel), num(item.otherDeduction2),
      num(item.total), item.netSalary,
    ]);
    styleDataRow(row, idx % 2 === 1);
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum >= 4) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
    });
  });

  if (items.length > 0) {
    styleTotalsRow(sheet.addRow([
      '合計', '', '',
      items.reduce((s, r) => s + num(r.rawA), 0),
      items.reduce((s, r) => s + num(r.splitA), 0),
      items.reduce((s, r) => s + num(r.serviceIncome), 0),
      items.reduce((s, r) => s + num(r.crossArea), 0),
      items.reduce((s, r) => s + num(r.serviceBonus), 0),
      items.reduce((s, r) => s + num(r.quotaDev), 0),
      items.reduce((s, r) => s + num(r.certBonus), 0),
      items.reduce((s, r) => s + num(r.referral), 0),
      items.reduce((s, r) => s + num(r.mentoring), 0),
      items.reduce((s, r) => s + num(r.holidayBonus), 0),
      items.reduce((s, r) => s + num(r.otherSubsidy), 0),
      items.reduce((s, r) => s + num(r.other2), 0),
      items.reduce((s, r) => s + num(r.payable), 0),
      items.reduce((s, r) => s + num(r.withholdingTax), 0),
      items.reduce((s, r) => s + num(r.fuel), 0),
      items.reduce((s, r) => s + num(r.otherDeduction2), 0),
      items.reduce((s, r) => s + num(r.total), 0),
      items.reduce((s, r) => s + r.netSalary, 0),
    ]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: `A碼及其他獎金_${period}.xlsx` };
};

// ── 薪資總表 ──────────────────────────────────────────────────────────────────
const buildSummaryBuffer = async ({ items, period }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('薪資總表');

  sheet.columns = [
    '員編', '姓名',
    'A碼申請金額', 'B碼申請金額', 'G碼申請金額', 'S碼申請金額', '服務未遇',
    'A碼拆帳金額', 'B碼拆帳金額', 'G碼拆帳金額', 'S碼拆帳金額', '服務未遇拆帳', '服務所得總額',
    '跨區補助', '服務獎金', '額度開發', '丙證獎金', '介紹費', '帶新人津貼', '節日獎金',
    '其他補貼', '其他(1)', '其他(2)', '應領金額',
    '扣繳稅額', '扶養親屬人數', '油資補貼',
    '勞保級距', '勞保費用', '健保級距', '健保眷屬人數', '健保費用',
    '勞退自提%', '應扣勞退自提', '應扣費用(1)', '應扣費用(2)', '總額', '實領金額',
  ].map((h, i) => ({ header: h, key: `c${i}`, width: i < 2 ? 12 : 14 }));

  styleHeader(sheet.getRow(1));

  items.forEach((item, idx) => {
    const row = sheet.addRow([
      item.empId, item.name,
      num(item.rawA), num(item.rawB), num(item.rawG), num(item.rawS), num(item.rawMissed),
      num(item.splitA), num(item.splitB), num(item.splitG), num(item.splitS), num(item.splitMissed), num(item.serviceIncome),
      num(item.crossArea), num(item.serviceBonus), num(item.quotaDev), num(item.certBonus),
      num(item.referral), num(item.mentoring), num(item.holidayBonus),
      num(item.otherSubsidy), num(item.other1), num(item.other2), num(item.payable),
      num(item.withholdingTax), item.dependentsCount, num(item.fuel),
      num(item.laborBracket), num(item.laborFee), num(item.healthBracket), item.healthDependents, num(item.healthFee),
      item.pensionRate ? item.pensionRate / 100 : 0, num(item.pensionFee), num(item.otherDeduction1), num(item.otherDeduction2),
      num(item.total), item.netSalary,
    ]);
    styleDataRow(row, idx % 2 === 1);
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum >= 3) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
    });
    const pensionCell = row.getCell(33);
    pensionCell.numFmt = '0.00%'; pensionCell.alignment = { horizontal: 'right' };
  });

  if (items.length > 0) {
    styleTotalsRow(sheet.addRow([
      '合計', '',
      items.reduce((s, r) => s + num(r.rawA), 0),
      items.reduce((s, r) => s + num(r.rawB), 0),
      items.reduce((s, r) => s + num(r.rawG), 0),
      items.reduce((s, r) => s + num(r.rawS), 0),
      items.reduce((s, r) => s + num(r.rawMissed), 0),
      items.reduce((s, r) => s + num(r.splitA), 0),
      items.reduce((s, r) => s + num(r.splitB), 0),
      items.reduce((s, r) => s + num(r.splitG), 0),
      items.reduce((s, r) => s + num(r.splitS), 0),
      items.reduce((s, r) => s + num(r.splitMissed), 0),
      items.reduce((s, r) => s + num(r.serviceIncome), 0),
      items.reduce((s, r) => s + num(r.crossArea), 0),
      items.reduce((s, r) => s + num(r.serviceBonus), 0),
      items.reduce((s, r) => s + num(r.quotaDev), 0),
      items.reduce((s, r) => s + num(r.certBonus), 0),
      items.reduce((s, r) => s + num(r.referral), 0),
      items.reduce((s, r) => s + num(r.mentoring), 0),
      items.reduce((s, r) => s + num(r.holidayBonus), 0),
      items.reduce((s, r) => s + num(r.otherSubsidy), 0),
      items.reduce((s, r) => s + num(r.other1), 0),
      items.reduce((s, r) => s + num(r.other2), 0),
      items.reduce((s, r) => s + num(r.payable), 0),
      items.reduce((s, r) => s + num(r.withholdingTax), 0),
      '',
      items.reduce((s, r) => s + num(r.fuel), 0),
      '',
      items.reduce((s, r) => s + num(r.laborFee), 0),
      '', '',
      items.reduce((s, r) => s + num(r.healthFee), 0),
      '',
      items.reduce((s, r) => s + num(r.pensionFee), 0),
      items.reduce((s, r) => s + num(r.otherDeduction1), 0),
      items.reduce((s, r) => s + num(r.otherDeduction2), 0),
      items.reduce((s, r) => s + num(r.total), 0),
      items.reduce((s, r) => s + r.netSalary, 0),
    ]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: `薪資總表_${period}.xlsx` };
};

// ── 薪資總表(2) ───────────────────────────────────────────────────────────────
const buildSummary2Buffer = async ({ items, period }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('薪資總表(2)');

  sheet.columns = [
    '員編', '姓名',
    '本薪', '轉場費', '加班費(x1.34)', '加班費(x1.67)', '加班費(x2.67)', '加班費(x1)', '加班費(x2)',
    '扣繳稅額', '勞保費', '健保費', '自繳勞退金', '應扣費用',
    '實領金額',
  ].map((h, i) => ({ header: h, key: `c${i}`, width: i < 2 ? 12 : 14 }));

  styleHeader(sheet.getRow(1));

  items.forEach((item, idx) => {
    const row = sheet.addRow([
      item.empId, item.name,
      num(item.baseSalary), num(item.crossArea),
      num(item.ot134), num(item.ot167), num(item.ot267), num(item.ot1), num(item.ot2),
      num(item.withholdingTax), num(item.laborFee), num(item.healthFee), num(item.pensionFee), num(item.otherDeduction),
      item.netSalary,
    ]);
    styleDataRow(row, idx % 2 === 1);
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum >= 3) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
    });
  });

  if (items.length > 0) {
    styleTotalsRow(sheet.addRow([
      '合計', '',
      items.reduce((s, r) => s + num(r.baseSalary), 0),
      items.reduce((s, r) => s + num(r.crossArea), 0),
      items.reduce((s, r) => s + num(r.ot134), 0),
      items.reduce((s, r) => s + num(r.ot167), 0),
      items.reduce((s, r) => s + num(r.ot267), 0),
      items.reduce((s, r) => s + num(r.ot1), 0),
      items.reduce((s, r) => s + num(r.ot2), 0),
      items.reduce((s, r) => s + num(r.withholdingTax), 0),
      items.reduce((s, r) => s + num(r.laborFee), 0),
      items.reduce((s, r) => s + num(r.healthFee), 0),
      items.reduce((s, r) => s + num(r.pensionFee), 0),
      items.reduce((s, r) => s + num(r.otherDeduction), 0),
      items.reduce((s, r) => s + r.netSalary, 0),
    ]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: `薪資總表2_${period}.xlsx` };
};

// ── A碼拆帳結果下載 ────────────────────────────────────────────────────────────
const toMinGuoMonth = (dateStr) => {
  if (!dateStr) return '';
  const parts = String(dateStr).split('/');
  if (parts.length < 2) return '';
  const year = parseInt(parts[0], 10);
  if (isNaN(year)) return '';
  return `${year - 1911}${parts[1].padStart(2, '0')}`;
};

const rateLabel = (rateNum) => Math.round(rateNum * 100) >= 70 ? '七三' : '六四';

const buildRatio = (code, rateNum, role) => {
  if (!rateNum) return '';
  return `${code === 'AA09' ? 'AA09' : '其餘A碼'}${rateLabel(rateNum)}(${role})`;
};

const CATEGORY_ORDER = { '居服': 0, '喘息': 1, '短照': 2 };
const sortByCategory = (rows) =>
  [...rows].sort((a, b) => (CATEGORY_ORDER[a.serialNum] ?? 99) - (CATEGORY_ORDER[b.serialNum] ?? 99));

const buildAcodeDownloadBuffer = async ({ calculationResult, summaryResult, errors, debugInfo }) => {
  const workbook = new ExcelJS.Workbook();

  const detailSheet = workbook.addWorksheet('詳細拆帳紀錄');
  detailSheet.addRow([
    '序號', '月份', '服務日期', '個案姓名', '個案主責督導', 'A碼代號',
    '財報用欄位', '細項', '居服員', '身分', '分得數量', '分配營收',
    '居服員抽成比', '居服員抽成', '公司抽成比', '公司抽成', '拆帳金額', '目前居住行政區', '比例', '備註',
  ]);
  sortByCategory(calculationResult).forEach((r) => {
    const rateNum = r.commissionRateNum || 0;
    const companyRateNum = rateNum > 0 ? 1 - rateNum : 0;
    const companyRate = companyRateNum > 0 ? `${Math.round(companyRateNum * 100)}%` : '';
    const companyAmount = rateNum > 0 ? parseFloat((r.revenueAllocated * companyRateNum).toFixed(2)) : '';
    detailSheet.addRow([
      r.serialNum, toMinGuoMonth(r.date), r.date, r.client, r.supervisor || '',
      r.code,
      r.serialNum ? `${r.serialNum}${r.code}` : '',
      r.serialNum ? `${r.serialNum}A碼` : '',
      r.workerId ? r.workerId + r.worker : r.worker,
      r.role, r.qty, r.revenueAllocated,
      r.commissionRate, r.amount,
      companyRate, companyAmount, r.amount,
      r.district || '',
      buildRatio(r.code, rateNum, r.role),
      r.note,
    ]);
  });

  const summarySheet = workbook.addWorksheet('人員薪資統計');
  summarySheet.addRow(['服務人員', '員編', '服務個案', '督導', '服務代碼', '數量', '小計', '拆帳金額']);
  summaryResult.forEach((s) => {
    s.details.forEach((d) => {
      summarySheet.addRow([s.name, s.id, d.client, d.supervisor, d.code, d.qty, d.subtotal, d.amount]);
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
  return { buffer, filename: `拆A碼結果_${new Date().toISOString().slice(0, 10)}.xlsx` };
};

// ── 營業額表 ──────────────────────────────────────────────────────────────────
const REVENUE_COLUMNS = [
  '所屬機構','申報年月','服務年月','類別','細項','身分證號','個案姓名','採用計畫',
  'CMS等級','福利身分別','服務項目類別','服務日期','給付價格','原民區支付價格','次數',
  '申報費用','部分負擔比率','部分負擔費用','補助比率','申請補助費用','原民區申請費用',
  '實際補助金額','服務當下居住縣市','目前居住縣市','個案主責督導','目前居住行政區',
  '照管專員','服務人員','碼別',
];

const buildRevenueBuffer = async ({ rows, institutionFullName, period }) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('照顧組合服務費用項目清冊');
  ws.addRow(['照顧組合服務費用項目清冊']);
  ws.addRow([]);
  ws.addRow([`服務單位：${institutionFullName || ''}`]);
  ws.addRow([]);
  ws.addRow(REVENUE_COLUMNS);
  for (const row of rows) {
    ws.addRow(REVENUE_COLUMNS.map(k => {
      const v = row[k];
      return (v === '' || v === null || v === undefined) ? '' : v;
    }));
  }
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, filename: `營業額_${period || ''}.xlsx` };
};

// ── 應收清冊 ──────────────────────────────────────────────────────────────────
const RECEIVABLE_COLUMNS = [
  '項次','單號','身分證號','個案姓名','福利身分別','送單人','繳款方式','應收金額',
  '備註','區域','個案者主責督導','衛服部','差異','記帳金額',
  '居-部分負擔','喘-部分負擔','短-部分負擔','居部+喘部+短部(B)',
  '居-全額自','喘-全額自','短-全額自','居+喘+短全自',
  '補申報(申請)','補申報B(自付)','補申報G(自付)','已申報B(自付)','已申報G(自付)',
  '公司負擔(申請金額)','繳費方式','記帳日期','入帳金額','差額(C-D)','超商繳款日期',
];

const buildReceivableBuffer = async ({ rows, institutionFullName, period }) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('收據對照表');
  ws.addRow([`${institutionFullName || ''} ${period || ''} 應收清冊`]);
  ws.addRow([]);
  ws.addRow(RECEIVABLE_COLUMNS);
  const headerRow = ws.getRow(3);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  for (const row of rows) {
    ws.addRow(RECEIVABLE_COLUMNS.map(k => {
      const v = row[k];
      return (v === '' || v === null || v === undefined) ? '' : v;
    }));
  }

  RECEIVABLE_COLUMNS.forEach((key, i) => {
    ws.getColumn(i + 1).width = Math.max(key.length * 2 + 2, 10);
  });

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, filename: `收據對照表_${period || ''}.xlsx` };
};

// ── Message dispatcher ────────────────────────────────────────────────────────
self.onmessage = async ({ data: { type, payload } }) => {
  try {
    const builders = {
      bgs:           buildBgsBuffer,
      acodeExport:   buildAcodeExportBuffer,
      summary:       buildSummaryBuffer,
      summary2:      buildSummary2Buffer,
      acodeDownload: buildAcodeDownloadBuffer,
      revenue:       buildRevenueBuffer,
      receivable:    buildReceivableBuffer,
    };
    const builder = builders[type];
    if (!builder) throw new Error(`Unknown export type: ${type}`);
    const { buffer: raw, filename } = await builder(payload);
    // ExcelJS writeBuffer() returns Buffer (Uint8Array) in browser, not ArrayBuffer.
    // Extract the underlying ArrayBuffer for zero-copy postMessage transfer.
    const ab = raw instanceof ArrayBuffer
      ? raw
      : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    self.postMessage({ buffer: ab, filename }, [ab]);
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
