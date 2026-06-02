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

export const parseCaseQuantityExcel = async (file) => {
  const buffer = await file.arrayBuffer();
  const isXls = file.name.toLowerCase().endsWith('.xls');

  const options = {
    sheetMatcher: (name) => name.includes('個案服務數量'),
    headerRow: 3,
  };

  const jsonData = isXls
    ? parseXlsBufferWithOptions(new Uint8Array(buffer), options)
    : await parseExcelBufferWithOptions(buffer, options);

  const safeNum = (val) => {
    if (typeof val === 'number') return val;
    const n = parseFloat(String(val ?? '').replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  return jsonData
    .map((row) => {
      const caseName = String(row['個案'] || '').trim();
      if (!caseName) return null;
      const code = String(row['服務項目'] || '').trim();
      if (!code || code.toUpperCase().startsWith('AA')) return null;
      return {
        case: caseName,
        code,
        quantity: safeNum(row['使用服務數量']),
        govAmount: safeNum(row['政府額度']),
        selfPayRatio: String(row['民眾自費比例'] ?? '').trim(),
        selfPayAmount: safeNum(row['民眾部份負擔額度']),
        selfPayQuantity: safeNum(row['自費數量']),
        selfPaySubtotal: safeNum(row['自費小計']),
      };
    })
    .filter(Boolean);
};

export const parseWelfareSummaryExcel = async (file) => {
  const buffer = await file.arrayBuffer();
  const isXls = file.name.toLowerCase().endsWith('.xls');

  const options = { headerRow: 5 };

  const jsonData = isXls
    ? parseXlsBufferWithOptions(new Uint8Array(buffer), options)
    : await parseExcelBufferWithOptions(buffer, options);

  const safeNum = (val) => {
    if (typeof val === 'number') return val;
    const n = parseFloat(String(val ?? '').replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  return jsonData
    .map((row) => {
      const caseName = String(row['個案姓名'] || '').trim();
      if (!caseName) return null;
      const codeFullName = String(row['服務項目\r\n類別'] || row['服務項目類別'] || row['服務項目\n類別'] || '').trim();
      const code = codeFullName.split(/\s+/)[0];
      if (!code || code.toUpperCase().startsWith('AA')) return null;
      const dateRaw = String(row['服務日期'] ?? '').trim();
      const serviceMonth = dateRaw
        ? dateRaw.split(',')[0].trim().split('/').slice(0, 2).join('/')
        : '';
      return {
        case: caseName,
        code,
        codeFullName,
        serviceMonth,
        quantity: safeNum(row['次數']),
        govAmount: safeNum(row['申報費用']),
        selfPayRatio: String(row['部分負擔比率'] ?? '').trim(),
        selfPayAmount: safeNum(row['部分負擔\r\n費用'] || row['部分負擔費用'] || row['部分負擔\n費用'] || 0),
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
      const otherDeduction1 = parseFloat(
        row[findKey(['應扣費用(1)', 'other deduction 1', 'other deduction(1)'])]
        ?? row[findKey(['應扣費用', 'other deduction', 'deduction fee'])]
        ?? 0
      );
      const otherDeduction2 = parseFloat(
        row[findKey(['應扣費用(2)', 'other deduction 2', 'other deduction(2)'])] || 0
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
        otherDeduction1,
        otherDeduction2,
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
      const other1 = parseFloat(
        row[findKey(['其他(1)', 'other1', 'other (1)'])]
        ?? row[findKey(['其他', 'other', 'others'])]
        ?? 0
      );
      const other2 = parseFloat(
        row[findKey(['其他(2)', 'other2', 'other (2)'])] || 0
      );

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
        other1,
        other2,
      };
    })
    .filter(Boolean);
};

// --- Revenue parsers ---

const getRowVal = (row, keys) => {
  for (const k of keys) {
    if (k in row) return row[k];
    const found = Object.keys(row).find(rk => rk.replace(/[\r\n]/g, '') === k.replace(/[\r\n]/g, ''));
    if (found !== undefined) return row[found];
  }
  return '';
};

export const parseWelfareRawRows = async (file) => {
  const buffer = await file.arrayBuffer();
  const isXls = file.name.toLowerCase().endsWith('.xls');
  const options = {
    sheetMatcher: (name) => name.includes('照顧組合服務費用項目清冊'),
    headerRow: 5,
  };
  const jsonData = isXls
    ? parseXlsBufferWithOptions(new Uint8Array(buffer), options)
    : await parseExcelBufferWithOptions(buffer, options);

  return jsonData
    .map((row) => {
      const caseName = String(getRowVal(row, ['個案姓名']) || '').trim();
      if (!caseName) return null;
      const serviceItem = String(getRowVal(row, ['服務項目\r\n類別', '服務項目類別', '服務項目\n類別']) || '').trim();
      const code = serviceItem.split(/\s+/)[0];
      if (!code || code.toUpperCase().startsWith('AA')) return null;
      return {
        序號: String(getRowVal(row, ['序號']) || '').trim(),
        身分證號: String(getRowVal(row, ['身分證號']) || '').trim(),
        個案姓名: caseName,
        採用計畫: String(getRowVal(row, ['採用計畫']) || '').trim(),
        CMS等級: String(getRowVal(row, ['CMS\r\n等級', 'CMS等級', 'CMS\n等級']) || '').trim(),
        福利身分別: String(getRowVal(row, ['福利身分別']) || '').trim(),
        服務項目類別: serviceItem,
        服務日期: String(getRowVal(row, ['服務日期']) || '').trim(),
        給付價格: getRowVal(row, ['給(支)付\r\n價格', '給(支)付價格', '給付價格']) ?? '',
        原民區支付價格: getRowVal(row, ['原民區或離島支付價格']) ?? '',
        次數: getRowVal(row, ['次數']) ?? 0,
        申報費用: getRowVal(row, ['申報費用']) ?? 0,
        部分負擔比率: String(getRowVal(row, ['部分負擔比率']) || '').trim(),
        部分負擔費用: getRowVal(row, ['部分負擔\r\n費用', '部分負擔費用', '部分負擔\n費用']) ?? 0,
        補助比率: String(getRowVal(row, ['補助比率']) || '').trim(),
        申請補助費用: getRowVal(row, ['申請(補助)費用']) ?? 0,
        原民區申請費用: getRowVal(row, ['原民區或離島申請(補助)費用']) ?? '',
        實際補助金額: getRowVal(row, ['實際補助\r\n金額', '實際補助金額', '實際補助\n金額']) ?? 0,
        服務當下居住縣市: String(getRowVal(row, ['服務當下\r\n居住縣市', '服務當下居住縣市', '服務當下\n居住縣市']) || '').trim(),
        目前居住縣市: String(getRowVal(row, ['目前居住縣市']) || '').trim(),
        目前居住行政區: String(getRowVal(row, ['目前居住行政區']) || '').trim(),
        照管專員: String(getRowVal(row, ['照管專員']) || '').trim(),
        服務人員: String(getRowVal(row, ['服務人員']) || '').trim(),
      };
    })
    .filter(Boolean);
};

export const parseSupervisorMap = async (file) => {
  const buffer = await file.arrayBuffer();
  const isXls = file.name.toLowerCase().endsWith('.xls');
  const options = {
    sheetMatcher: (name) => name.includes('服務明細'),
    headerRow: 1,
  };
  const jsonData = isXls
    ? parseXlsBufferWithOptions(new Uint8Array(buffer), options)
    : await parseExcelBufferWithOptions(buffer, options);

  const supervisorMap = {};
  const districtMap = {};
  const serviceDateSetMap = {};
  for (const row of jsonData) {
    const caseName = String(getRowVal(row, ['服務個案', '個案', '個案姓名']) || '').trim();
    if (!caseName) continue;
    const supervisor = String(getRowVal(row, ['居督', '居服督導', '督導']) || '').trim();
    if (supervisor && !supervisorMap[caseName]) supervisorMap[caseName] = supervisor;
    const district = String(getRowVal(row, ['居住區', '行政區']) || '').trim();
    if (district && !districtMap[caseName]) districtMap[caseName] = district;
    const date = String(getRowVal(row, ['服務日期']) || '').trim();
    if (date) {
      if (!serviceDateSetMap[caseName]) serviceDateSetMap[caseName] = new Set();
      const parts = date.split('/');
      const y = parts.length >= 3 ? parseInt(parts[0], 10) : 0;
      const minguo = y > 1911 ? `${y - 1911}/${parts.slice(1).join('/')}` : date;
      serviceDateSetMap[caseName].add(minguo);
    }
  }
  const serviceDateMap = Object.fromEntries(
    Object.entries(serviceDateSetMap).map(([k, v]) => [k, [...v].join(',')])
  );
  return { supervisorMap, districtMap, serviceDateMap };
};

export const parseReceivableRoster = async (file) => {
  const buffer = await file.arrayBuffer();
  const isXls = file.name.toLowerCase().endsWith('.xls');
  const options = { headerRow: 2 };

  const jsonData = isXls
    ? parseXlsBufferWithOptions(new Uint8Array(buffer), options)
    : await parseExcelBufferWithOptions(buffer, options);

  const safeNum = (val) => {
    if (typeof val === 'number') return val;
    const n = parseFloat(String(val ?? '').replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  return jsonData
    .map((row) => {
      const caseName = String(row['個案姓名'] || '').trim();
      if (!caseName) return null;
      return {
        項次: row['項次'] ?? '',
        單號: String(row['單號'] || '').trim(),
        身分證號: String(row['身分證號'] || '').trim(),
        個案姓名: caseName,
        福利身分別: String(row['福利身分別'] || '').trim(),
        送單人: String(row['送單人'] || '').trim(),
        繳款方式: String(row['繳款方式'] || '').trim(),
        應收金額: safeNum(row['應收金額']),
        備註: String(row['備註'] || '').trim(),
      };
    })
    .filter(Boolean);
};

export const parseAcodeRawRows = async (file) => {
  const buffer = await file.arrayBuffer();
  const isXls = file.name.toLowerCase().endsWith('.xls');
  const options = {
    sheetMatcher: (name) => name.includes('A碼項目清冊'),
    headerRow: 1,
  };
  const jsonData = isXls
    ? parseXlsBufferWithOptions(new Uint8Array(buffer), options)
    : await parseExcelBufferWithOptions(buffer, options);

  return jsonData
    .map((row) => {
      const caseName = String(row['個案姓名'] || '').trim();
      const code = String(row['服務代碼'] || '').trim();
      if (!caseName || !code) return null;
      return {
        序號: String(row['序號'] || '').trim(),
        服務代碼: code,
        採用計畫: String(row['採用計畫'] || '').trim(),
        CMS等級: String(row['CMS等級'] || '').trim(),
        服務項目類別: String(row['服務項目類別'] || '').trim(),
        身分證號: String(row['身分證號'] || '').trim(),
        個案姓名: caseName,
        給付價格: String(row['給付價格'] || '').trim(),
        數量: row['數量'] ?? 0,
        小計: row['小計'] ?? 0,
        服務日期: String(row['服務日期'] || '').trim(),
        目前居住縣市: String(row['目前居住縣市'] || '').trim(),
        目前居住行政區: String(row['目前居住行政區'] || '').trim(),
        照管專員: String(row['照管專員'] || '').trim(),
        服務人員: String(row['服務人員'] || '').trim(),
      };
    })
    .filter(Boolean);
};
