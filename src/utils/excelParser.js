import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { getCellValue } from './excel-core';
import { INSTITUTION_NAME_TO_CODE } from '../constants/institutions.js';

const parseExcelBuffer = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    headers[cell.col - 1] = String(getCellValue(cell) ?? '');
  });

  const jsonData = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData = {};
    let hasData = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
      const header = headers[cell.col - 1];
      if (header !== undefined) {
        const val = getCellValue(cell);
        rowData[header] = val;
        if (val !== '' && val !== null && val !== undefined) hasData = true;
      }
    });
    headers.forEach((h) => { if (h && !(h in rowData)) rowData[h] = ''; });
    if (hasData) jsonData.push(rowData);
  });

  return jsonData;
};

const parseExcelBufferWithOptions = async (buffer, { sheetMatcher, headerRow = 1 } = {}) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let worksheet;
  if (sheetMatcher) {
    worksheet = workbook.worksheets.find((ws) => sheetMatcher(ws.name));
  }
  if (!worksheet) worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  worksheet.getRow(headerRow).eachCell({ includeEmpty: false }, (cell) => {
    headers[cell.col - 1] = String(getCellValue(cell) ?? '').trim();
  });

  const jsonData = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const rowData = {};
    let hasData = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
      const header = headers[cell.col - 1];
      if (header) {
        const val = getCellValue(cell);
        rowData[header] = val;
        if (val !== '' && val !== null && val !== undefined) hasData = true;
      }
    });
    headers.forEach((h) => { if (h && !(h in rowData)) rowData[h] = ''; });
    if (hasData) jsonData.push(rowData);
  });

  return jsonData;
};

export const parseExcelToJSON = async (file) => {
  const buffer = await file.arrayBuffer();
  return parseExcelBuffer(buffer);
};

export const parseEmployeeExcel = async (file) => {
  const jsonData = await parseExcelToJSON(file);
  const employees = jsonData.map((row) => {
    const findKey = (keys) =>
      Object.keys(row).find((k) => keys.includes(k.trim().toLowerCase()));

    const empId = row[findKey(['emp id', 'empid', '員編', '員工編號'])] || '';
    const name = row[findKey(['name', 'full name', '姓名'])] || '';
    const idNumber =
      row[findKey(['id number', 'idnumber', 'id', '身分證', '身分證字號'])] || '';
    const position = row[findKey(['position', 'position type', '職級'])] || 'Full-time';
    const orgRaw = String(row[findKey(['所屬機構', 'organization', 'org'])] || '').trim();
    // 中文名 → institution code；若已是 code 則直接用
    const organization = INSTITUTION_NAME_TO_CODE[orgRaw] ?? orgRaw;
    const paymentMethodRaw = String(row[findKey(['薪資領取方式', 'payment method', 'payment'])] || '匯款').trim();
    const paymentMethod = paymentMethodRaw.includes('現') ? '領現' : '匯款';

    const parsePct = (raw) => {
      const v = parseFloat(raw) || 0;
      return v > 0 && v <= 1 ? parseFloat((v * 100).toFixed(1)) : v;
    };

    const bgsSplit = parsePct(row[findKey(['bgs碼抽成', 'bgs split', 'bgs抽成', '拆帳比例', 'global split', 'split ratio'])] || 0);
    const aa09Split = parsePct(row[findKey(['aa09抽成', 'aa09 split', 'aa09'])] || 0);
    const otherAcodeSplit = parsePct(row[findKey(['其餘a碼抽成', '其餘a碼', '其他a碼抽成', 'other acode split', 'other a split'])] || 0);

    const b = bgsSplit || parseFloat(row[findKey(['b', 'b code', 'b碼', 'b拆帳'])] || 0);
    const g = bgsSplit || parseFloat(row[findKey(['g', 'g code', 'g碼', 'g拆帳'])] || 0);
    const s = bgsSplit || parseFloat(row[findKey(['s', 's code', 's碼', 's拆帳'])] || 0);
    const missed = bgsSplit || parseFloat(row[findKey(['missed', 'missed service', 'not found', '未遇', '服務未遇'])] || 0);

    const bankCode = row[findKey(['銀行代碼', 'bank code', 'bank'])] || '';
    const bankAccount =
      row[findKey(['匯款帳號', 'account number', 'account', '帳號'])] || '';

    const laborInsuranceBracket = parseFloat(row[findKey(['勞(就)保級距', '勞就保級距', 'labor insurance bracket'])] || 0);
    const laborInsuranceSelfPay = parseFloat(row[findKey(['勞保+職災+就保(自付)', '勞保職災就保自付', 'labor insurance self pay'])] || 0);
    const healthInsuranceBracket = parseFloat(row[findKey(['健保級距', 'health insurance bracket'])] || 0);
    const healthDependents = parseFloat(row[findKey(['健保眷屬人數', 'health dependents'])] || 0);
    const healthInsuranceSelfPay = parseFloat(row[findKey(['健保費(自付)', '健保費自付', 'health insurance self pay'])] || 0);
    const voluntaryPensionRate = parsePct(row[findKey(['勞退自提(%)', '勞退自提', 'voluntary pension rate'])] || 0);
    const voluntaryPensionDeduction = parseFloat(row[findKey(['應扣勞退自提', 'voluntary pension deduction'])] || 0);
    const dependentsCount = parseFloat(row[findKey(['扶養親屬人數', 'dependents count', 'dependents'])] || 0);

    if (!empId || !name) return null;

    return {
      empId: String(empId).trim(),
      name: String(name).trim(),
      idNumber: String(idNumber).trim(),
      position:
        position.includes('兼') || position.toLowerCase().includes('part')
          ? 'Part-time'
          : 'Full-time',
      organization: String(organization).trim(),
      paymentMethod,
      bankCode: String(bankCode).trim(),
      bankAccount: String(bankAccount).trim(),
      splits: { b, g, s, missed, aa09: aa09Split, otherAcode: otherAcodeSplit },
      laborInsuranceBracket,
      laborInsuranceSelfPay,
      healthInsuranceBracket,
      healthDependents,
      healthInsuranceSelfPay,
      voluntaryPensionRate,
      voluntaryPensionDeduction,
      dependentsCount,
    };
  }).filter(Boolean);
  return employees;
};

const parseXlsBufferWithOptions = (uint8Array, { sheetMatcher, headerRow = 1 } = {}) => {
  const workbook = XLSX.read(uint8Array, { type: 'array' });

  let sheetName;
  if (sheetMatcher) sheetName = workbook.SheetNames.find(sheetMatcher);
  if (!sheetName) sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet['!ref']) return [];

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const headerRowIdx = headerRow - 1;

  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIdx, c })];
    headers[c] = cell ? String(cell.v ?? '').trim() : '';
  }

  const jsonData = [];
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
    if (hasData) jsonData.push(rowData);
  }

  return jsonData;
};

export const parseServiceRecordExcel = async (file) => {
  const buffer = await file.arrayBuffer();
  const isXls = file.name.toLowerCase().endsWith('.xls');

  const options = {
    sheetMatcher: (name) => name.includes('服務員服務個案計算'),
    headerRow: 3,
  };

  const jsonData = isXls
    ? parseXlsBufferWithOptions(new Uint8Array(buffer), options)
    : await parseExcelBufferWithOptions(buffer, options);

  const safeParseFloat = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanVal = String(val).replace(/[^\d.-]/g, '');
    const num = parseFloat(cleanVal);
    return isNaN(num) ? 0 : num;
  };

  return jsonData
    .map((row) => {
      const serviceCode = String(row['服務項目'] || '').trim();
      if (serviceCode.toUpperCase().startsWith('AA')) return null;

      const empName = String(row['服務員'] || '').trim();
      if (!empName) return null;

      return {
        服務員: empName,
        Client: String(row['個案'] || '').trim(),
        服務項目: serviceCode,
        代碼: serviceCode,
        政府補助單價: safeParseFloat(row['政府補助單價']),
        補助數量: safeParseFloat(row['補助數量']),
        補助小計: safeParseFloat(row['補助小計']),
        自費單價: safeParseFloat(row['自費單價']),
        自費數量: safeParseFloat(row['自費數量']),
        自費小計: safeParseFloat(row['自費小計']),
        總數量: safeParseFloat(row['總數量']),
      };
    })
    .filter(Boolean);
};

export const parseDeductionExcel = async (file) => {
  const jsonData = await parseExcelToJSON(file);

  return jsonData
    .map((row) => {
      const findKey = (keys) =>
        Object.keys(row).find((k) => keys.includes(k.trim().toLowerCase()));

      const empId = row[findKey(['員編', 'emp id', 'id'])] || '';
      const name = row[findKey(['姓名', 'name'])] || '';

      const withholdingTax = parseFloat(
        row[findKey(['扣繳稅額', 'tax', 'withholding'])] || 0
      );
      const laborLevel = parseFloat(
        row[findKey(['勞保級距', 'labor level', 'li level'])] || 0
      );
      const laborFee = parseFloat(
        row[findKey(['勞保費用', 'labor fee', 'li fee'])] || 0
      );
      const healthLevel = parseFloat(
        row[findKey(['健保級距', 'health level', 'hi level'])] || 0
      );
      const healthFee = parseFloat(
        row[findKey(['健保費用', 'health fee', 'hi fee'])] || 0
      );
      const pensionRate = parseFloat(
        row[findKey(['自提比例', '自提比例(%)', 'pension rate'])] || 0
      );
      const pensionFee = parseFloat(
        row[findKey(['自提金額', 'pension fee', 'pension amount'])] || 0
      );
      const otherDeduction = parseFloat(
        row[findKey(['應扣費用', 'other deduction', 'deduction fee'])] || 0
      );

      if (!empId && !name) return null;

      return {
        empId: String(empId).trim(),
        name: String(name).trim(),
        withholdingTax,
        laborLevel,
        laborFee,
        healthLevel,
        healthFee,
        pensionRate,
        pensionFee,
        otherDeduction,
      };
    })
    .filter(Boolean);
};

export const parseBonusExcel = async (file) => {
  const jsonData = await parseExcelToJSON(file);

  return jsonData
    .map((row) => {
      const findKey = (keys) =>
        Object.keys(row).find((k) => keys.includes(k.trim().toLowerCase()));

      const empId = row[findKey(['員編', 'emp id', 'id'])] || '';
      const name = row[findKey(['姓名', 'name'])] || '';

      const bonusA = parseFloat(row[findKey(['a碼獎金', 'a bonus', 'bonus a'])] || 0);
      const bonusC = parseFloat(
        row[findKey(['丙證獎金', 'c license', 'license c'])] || 0
      );
      const bonusOpen = parseFloat(
        row[findKey(['服務獎金', 'open case', 'opening bonus'])] || 0
      );
      const bonusDev = parseFloat(
        row[findKey(['開發獎金', 'development bonus'])] || 0
      );
      const bonusCross = parseFloat(
        row[findKey(['跨區獎金', 'cross district'])] || 0
      );
      const referral = parseFloat(row[findKey(['介紹費', 'referral fee'])] || 0);
      const mentoring = parseFloat(
        row[findKey(['帶新人津貼', 'mentoring', 'mentor'])] || 0
      );
      const fuel = parseFloat(row[findKey(['油資補助', 'fuel subsidy', 'fuel'])] || 0);
      const other = parseFloat(row[findKey(['其他', 'other', 'others'])] || 0);

      if (!empId && !name) return null;

      return {
        empId: String(empId).trim(),
        name: String(name).trim(),
        bonusA,
        bonusC,
        bonusOpen,
        bonusDev,
        bonusCross,
        referral,
        mentoring,
        fuel,
        other,
      };
    })
    .filter(Boolean);
};
