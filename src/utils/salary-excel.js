import ExcelJS from 'exceljs';

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

const styleHeader = (row) => {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
  row.height = 22;
};

const styleDataRow = (row, isEven) => {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
    };
    cell.border = {
      bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
    };
  });
};

const num = (v) => (v && v !== 0) ? v : 0;

export const exportBgsExcel = async (items, period) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BGS碼薪資');

  const headers = [
    '員編', '姓名', '領款方式',
    'B碼申請金額', 'G碼申請金額', 'S碼申請金額', '服務未遇',
    'B碼拆帳金額', 'G碼拆帳金額', 'S碼拆帳金額', '服務未遇拆帳', '服務所得總額',
    '其他補貼', '其他(1)', '應領金額',
    '勞保級距', '勞保費用', '健保級距', '健保眷屬人數', '健保費用',
    '勞退自提%', '應扣勞退自提', '應扣費用(1)', '總額', '實領金額',
  ];

  sheet.columns = headers.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: i < 3 ? 12 : 14,
  }));

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

    // format money columns; col 19=健保眷屬人數, col 21=勞退自提% are excluded
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum >= 4 && colNum !== 19 && colNum !== 21) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
    // pension rate column (col 21, 1-based)
    const pensionCell = row.getCell(21);
    pensionCell.numFmt = '0.00%';
    pensionCell.alignment = { horizontal: 'right' };
  });

  // totals row
  if (items.length > 0) {
    const totalsRow = sheet.addRow([
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
      '', // 勞保級距
      items.reduce((s, r) => s + num(r.laborFee), 0),
      '', // 健保級距
      '', // 眷屬人數
      items.reduce((s, r) => s + num(r.healthFee), 0),
      '', // 勞退%
      items.reduce((s, r) => s + num(r.pensionFee), 0),
      items.reduce((s, r) => s + num(r.otherDeduction1), 0),
      items.reduce((s, r) => s + num(r.total), 0),
      items.reduce((s, r) => s + r.netSalary, 0),
    ]);
    totalsRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    });
    totalsRow.getCell(1).alignment = { horizontal: 'left' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `BGS碼薪資_${period}.xlsx`);
};

export const exportAcodeExcel = async (items, period) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('A碼及其他獎金');

  const headers = [
    '員編', '姓名', '領款方式',
    'A碼申請金額', 'A碼拆帳金額', '服務所得總額',
    '跨區補助', '服務獎金', '額度開發', '丙證獎金', '介紹費', '帶新人津貼', '節日獎金',
    '其他補貼', '其他(2)', '應領金額',
    '扣繳稅額', '油資補貼', '應扣費用(2)', '總額', '實領金額',
  ];

  sheet.columns = headers.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: i < 3 ? 12 : 14,
  }));

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
      if (colNum >= 4) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  if (items.length > 0) {
    const totalsRow = sheet.addRow([
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
    ]);
    totalsRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    });
    totalsRow.getCell(1).alignment = { horizontal: 'left' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `A碼及其他獎金_${period}.xlsx`);
};

export const exportSummaryExcel = async (items, period) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('薪資總表');

  const headers = [
    '員編', '姓名',
    'A碼申請金額', 'B碼申請金額', 'G碼申請金額', 'S碼申請金額', '服務未遇',
    'A碼拆帳金額', 'B碼拆帳金額', 'G碼拆帳金額', 'S碼拆帳金額', '服務未遇拆帳', '服務所得總額',
    '跨區補助', '服務獎金', '額度開發', '丙證獎金', '介紹費', '帶新人津貼', '節日獎金',
    '其他補貼', '其他(1)', '其他(2)', '應領金額',
    '扣繳稅額', '扶養親屬人數', '油資補貼',
    '勞保級距', '勞保費用', '健保級距', '健保眷屬人數', '健保費用',
    '勞退自提%', '應扣勞退自提', '應扣費用(1)', '應扣費用(2)', '總額', '實領金額',
  ];

  sheet.columns = headers.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: i < 2 ? 12 : 14,
  }));

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
      if (colNum >= 3) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
    // pension rate col = 33 (1-based)
    const pensionCell = row.getCell(33);
    pensionCell.numFmt = '0.00%';
    pensionCell.alignment = { horizontal: 'right' };
  });

  if (items.length > 0) {
    const totalsRow = sheet.addRow([
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
      '', // 扶養人數不加總
      items.reduce((s, r) => s + num(r.fuel), 0),
      '', // 勞保級距
      items.reduce((s, r) => s + num(r.laborFee), 0),
      '', // 健保級距
      '', // 眷屬人數
      items.reduce((s, r) => s + num(r.healthFee), 0),
      '', // 勞退%
      items.reduce((s, r) => s + num(r.pensionFee), 0),
      items.reduce((s, r) => s + num(r.otherDeduction1), 0),
      items.reduce((s, r) => s + num(r.otherDeduction2), 0),
      items.reduce((s, r) => s + num(r.total), 0),
      items.reduce((s, r) => s + r.netSalary, 0),
    ]);
    totalsRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    });
    totalsRow.getCell(1).alignment = { horizontal: 'left' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `薪資總表_${period}.xlsx`);
};

export const exportSummary2Excel = async (items, period) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('薪資總表(2)');

  const headers = [
    '員編', '姓名',
    '本薪', '轉場費', '加班費(x1.34)', '加班費(x1.67)', '加班費(x2.67)', '加班費(x1)', '加班費(x2)',
    '扣繳稅額', '勞保費', '健保費', '自繳勞退金', '應扣費用',
    '實領金額',
  ];

  sheet.columns = headers.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: i < 2 ? 12 : 14,
  }));

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
      if (colNum >= 3) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  if (items.length > 0) {
    const totalsRow = sheet.addRow([
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
    ]);
    totalsRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    });
    totalsRow.getCell(1).alignment = { horizontal: 'left' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `薪資總表2_${period}.xlsx`);
};
