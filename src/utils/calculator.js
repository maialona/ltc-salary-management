export const SERVICE_TYPES = {
  B: 'B',
  G: 'G',
  S: 'S',
  MISSED: 'Missed',
  UNKNOWN: 'Unknown'
};

export const helperParseServiceType = (code, name = '') => {
  const c = code?.toUpperCase() || '';
  const n = name || '';

  if (n.includes('未遇') || c.includes('未遇')) return SERVICE_TYPES.MISSED;
  if (c.startsWith('B')) return SERVICE_TYPES.B;
  if (c.startsWith('G')) return SERVICE_TYPES.G;
  if (c.startsWith('S')) return SERVICE_TYPES.S;

  return SERVICE_TYPES.UNKNOWN;
};

const emptyBreakdownType = () => ({
  count: 0,
  rawSum: 0,
  splitSum: 0,
  selfPayRaw: 0,
  selfPaySplit: 0,
  items: [],
});

export const processSalaryCalculation = (records, employees) => {
  const results = {};
  const warnings = [];

  if (!records || records.length === 0) return { results: [], warnings: ['No records to process'] };

  const findEmployee = (name) => employees.find(e => e.name.trim() === name.trim());

  records.forEach(row => {
    const empName = String(row['服務員'] || row['服務人員'] || '').trim();
    if (!empName) return;

    const employee = findEmployee(empName);
    if (!employee) {
      if (!warnings.includes(`Employee "${empName}" not found in system.`)) {
        warnings.push(`Employee "${empName}" not found in system.`);
      }
      return;
    }

    if (!results[employee.id]) {
      results[employee.id] = {
        employee,
        breakdown: {
          [SERVICE_TYPES.B]: emptyBreakdownType(),
          [SERVICE_TYPES.G]: emptyBreakdownType(),
          [SERVICE_TYPES.S]: emptyBreakdownType(),
          [SERVICE_TYPES.MISSED]: emptyBreakdownType(),
        },
      };
    }

    const serviceCode = String(row['服務項目'] || row['代碼'] || '').trim();
    const type = helperParseServiceType(serviceCode, serviceCode);
    if (type === SERVICE_TYPES.UNKNOWN) return;

    // 申請金額 = 補助小計 (政府補助單價 × 補助數量)
    const govAmount = parseFloat(row['補助小計'] || 0);
    const selfPayAmount = parseFloat(row['自費小計'] || 0);
    const count = type === SERVICE_TYPES.MISSED
      ? parseFloat(row['總數量'] || row['補助數量'] || 0)
      : parseFloat(row['補助數量'] || row['數量'] || 0);
    const clientName = String(row['Client'] || row['個案'] || '').trim();

    const ratio = employee.splits[type.toLowerCase()] || 0;
    // 拆帳: 不做自動進位
    const splitAmount = govAmount * (ratio / 100);
    const selfPaySplitAmount = selfPayAmount * (ratio / 100);

    // 自費拆帳依碼別直接合入 split；未遇類型的 amount 也一併合入
    const isMissed = type === SERVICE_TYPES.MISSED;
    results[employee.id].breakdown[type].items.push({
      client: clientName,
      code: serviceCode,
      count,
      unitPrice: parseFloat(row['政府補助單價'] || 0),
      amount: isMissed ? govAmount + selfPayAmount : govAmount,
      split: splitAmount + selfPaySplitAmount,
      selfPayAmount: isMissed ? 0 : selfPayAmount,
      selfPaySplit: 0,
    });
  });

  const finalOutput = Object.values(results).map(res => {
    let totalSplit = 0;

    [SERVICE_TYPES.B, SERVICE_TYPES.G, SERVICE_TYPES.S, SERVICE_TYPES.MISSED].forEach(type => {
      const items = res.breakdown[type].items;

      res.breakdown[type].count = items.length;
      res.breakdown[type].rawSum = items.reduce((acc, item) => acc + item.amount, 0);
      res.breakdown[type].splitSum = items.reduce((acc, item) => acc + item.split, 0);
      res.breakdown[type].selfPayRaw = items.reduce((acc, item) => acc + item.selfPayAmount, 0);
      res.breakdown[type].selfPaySplit = items.reduce((acc, item) => acc + item.selfPaySplit, 0);

      totalSplit += res.breakdown[type].splitSum;
    });

    res.splitTotal = totalSplit;
    res.totalCommission = totalSplit;
    return res;
  }).sort((a, b) => {
    const idA = a.employee.empId || '';
    const idB = b.employee.empId || '';
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
  });

  return { results: finalOutput, warnings };
};
