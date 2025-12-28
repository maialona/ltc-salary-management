export const SERVICE_TYPES = {
  B: 'B',
  G: 'G',
  S: 'S',
  MISSED: 'Missed',
  UNKNOWN: 'Unknown'
};

/**
 * Determines the service type based on the code.
 * BA.. => B
 * GA.. => G
 * SA.. => S
 * "未遇" in name/code => Missed
 */
export const helperParseServiceType = (code, name = '') => {
  const c = code?.toUpperCase() || '';
  const n = name || '';

  if (n.includes('未遇') || c.includes('未遇')) return SERVICE_TYPES.MISSED;
  if (c.startsWith('BA')) return SERVICE_TYPES.B;
  if (c.startsWith('GA')) return SERVICE_TYPES.G;
  if (c.startsWith('SA')) return SERVICE_TYPES.S;

  return SERVICE_TYPES.UNKNOWN;
};

/**
 * Main calculation entry point.
 * @param {Array} records - Array of raw records from Excel
 * @param {Array} employees - Array of employee objects
 */
export const processSalaryCalculation = (records, employees) => {
  const results = {};
  const warnings = [];

  // 1. Group records by Employee Name
  // We match by Name mainly, as per PRD "Service List" usually has Name.
  // Ideally match by Emp ID if available, but PRD says "Records Processing... match 'Service Items'". 
  // Wait, PRD 2.2 says "Display 'Employee Name'". 
  // We assume the Excel has an Employee Name column.
  
  if (!records || records.length === 0) return { results: [], warnings: ['No records to process'] };

  // Helper to find Employee
  const findEmployee = (name) => {
    return employees.find(e => e.name.trim() === name.trim());
  };

  records.forEach(row => {
    // Detect columns again roughly
    const findKey = (keys) => Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
    
    // Employee Name Column
    const empNameKey = findKey(['服務員', '服務員姓名', 'employee', 'name']);
    const empName = row[empNameKey];

    // Case Name / ID (Optional for display)
    const clientNameKey = findKey(['案主', '個案', '個案姓名', 'client']);
    const clientName = row[clientNameKey] || 'Unknown';

    // Service Code
    const codeKey = findKey(['代碼', 'code']);
    const code = row[codeKey] || '';

    // Service Name (distinct from Code if possible)
    const serviceNameKey = findKey(['服務項目', '項目', 'service', 'item']);
    const serviceName = row[serviceNameKey] || '';

    // Amount
    const amountKey = findKey(['總金額', '金額', 'amount', 'total']); // "總金額" per PRD
    let amount = parseFloat(row[amountKey] || 0);

    // Quantity / Count (Required for Missed service calculation)
    const countKey = findKey(['數量', '組數', 'count', 'qty']);
    const count = parseFloat(row[countKey] || 0);

    if (!empName) return; // Skip invalid rows without employee name

    const employee = findEmployee(empName);
    if (!employee) {
      if (!warnings.includes(`Employee "${empName}" not found in system.`)) {
         warnings.push(`Employee "${empName}" not found in system.`);
      }
      return; 
    }

    if (!results[employee.id]) {
      results[employee.id] = {
        employee: employee,
        rawTotal: 0,
        splitTotal: 0,
        details: [],
        breakdown: {
          [SERVICE_TYPES.B]: { count: 0, rawSum: 0, splitSum: 0, items: [] },
          [SERVICE_TYPES.G]: { count: 0, rawSum: 0, splitSum: 0, items: [] },
          [SERVICE_TYPES.S]: { count: 0, rawSum: 0, splitSum: 0, items: [] },
          [SERVICE_TYPES.MISSED]: { count: 0, rawSum: 0, splitSum: 0, items: [] }
        }
      };
    }

    const type = helperParseServiceType(code, serviceName);
    // Note: parsed type might be "Unknown". If unknown, we might ignore or classify as B? 
    // PRD only defines B, G, S, Missed. Let's assume others are ignored or warned.
    
    if (type === SERVICE_TYPES.UNKNOWN) {
        // console.warn('Unknown service type:', code);
        return;
    }

    // Special handling for Missed
    let finalAmount = amount;
    if (type === SERVICE_TYPES.MISSED) {
      finalAmount = 200 * count; // Fixed 200 * quantity
    }

    // Single item split calculation (No Rounding yet)
    // Formula: Amount * Ratio
    const ratio = employee.splits[type.toLowerCase()] || 0;
    const splitAmount = finalAmount * (ratio / 100);

    results[employee.id].rawTotal += finalAmount;
    
    // Add to breakdown
    results[employee.id].breakdown[type].items.push({
      client: clientName,
      code: code,
      count: count,
      amount: finalAmount,
      split: splitAmount // Keep precise
    });
  });

  // 2. Finalize Calculation (Sum and Round)
  const finalOutput = Object.values(results).map(res => {
    let totalSplit = 0;

    [SERVICE_TYPES.B, SERVICE_TYPES.G, SERVICE_TYPES.S, SERVICE_TYPES.MISSED].forEach(type => {
      const items = res.breakdown[type].items;
      // Sum all split amounts for this category
      const sumSplit = items.reduce((acc, item) => acc + item.split, 0);
      // Round the sum
      const roundedSplit = Math.round(sumSplit);
      
      res.breakdown[type].count = items.length;
      res.breakdown[type].rawSum = items.reduce((acc, item) => acc + item.amount, 0); // Display purpose
      res.breakdown[type].splitSum = roundedSplit; // Final rounded value
      
      totalSplit += roundedSplit;
    });

    res.splitTotal = totalSplit;
    return res;
  }).sort((a, b) => {
    const idA = a.employee.empId || '';
    const idB = b.employee.empId || '';
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
  });

  return { results: finalOutput, warnings };
};
