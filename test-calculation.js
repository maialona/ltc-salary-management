import { processSalaryCalculation } from './src/utils/calculator.js';

// Mock Employees
const employees = [
  {
    id: 'emp1',
    name: 'Alice',
    splits: { b: 60, g: 60, s: 60, missed: 100 } // 60% split, 100% for missed? PRD says missed has independent ratio. Let's assume 100 for now or whatever user sets.
  }
];

// Mock Records
// Case 1: Simple B code
// Amount: 1000, Split: 60% => 600.
// Case 2: Rounding check
// Amount: 1005, Split: 60% => 603.0
// Case 3: Rounding accumulation
// Item 1: 100, 60% => 60.0
// Item 2: 101, 60% => 60.6
// Sum => 120.6 => Round => 121.
// If we rounded individually: 60 + 61 = 121.
// Let's try 100.5 case?
// Item 1: 1, 60% => 0.6
// Item 2: 1, 60% => 0.6
// Sum => 1.2 => Round => 1.
// Individual Round: 1 + 1 = 2.
// PRD: "Sum then Round". So result should be 1.

const records = [
  // Employee: Alice
  { '服務員姓名': 'Alice', '此欄位忽略': '...', '代碼': 'BA01', '總金額': 1000, '數量': 1 },
  { '服務員姓名': 'Alice', '此欄位忽略': '...', '代碼': 'BA02', '總金額': 1, '數量': 1 }, 
  { '服務員姓名': 'Alice', '此欄位忽略': '...', '代碼': 'BA03', '總金額': 1, '數量': 1 },
  // 1000 * 0.6 = 600
  // 1 * 0.6 = 0.6
  // 1 * 0.6 = 0.6
  // Total Split = 601.2 => Round => 601.

  // Missed Case
  { '服務員姓名': 'Alice', '此欄位忽略': '...', '代碼': 'BA04', '服務項目': '服務未遇', '總金額': 0, '數量': 3 },
  // Missed: 200 * 3 = 600.
  // Split: 600 * 1.0 (if ratio is 100) = 600.
];

console.log('Testing Calculation Logic...');

const { results } = processSalaryCalculation(records, employees);
const alice = results.find(r => r.employee.name === 'Alice');

if (!alice) {
  console.error('Alice not found!');
  process.exit(1);
}

// Check B
const bStats = alice.breakdown['B'];
console.log('B Stats:', bStats);
// Expected: splitSum should be 601.
if (bStats.splitSum === 601) {
  console.log('PASS: B Code Sum-then-Round Logic covers (600 + 0.6 + 0.6 = 601.2 -> 601)');
} else {
  console.error(`FAIL: B Code Split Sum. Expected 601, Got ${bStats.splitSum}`);
}

// Check Missed
const mStats = alice.breakdown['Missed'];
console.log('Missed Stats:', mStats);
// Expected: 200 * 3 = 600 amount. Split 100% = 600.
if (mStats.rawSum === 600) {
     console.log('PASS: Missed Code Amount Logic covers (200 * 3 = 600)');
     // Assuming split is 100%
     if (mStats.splitSum === 600) {
        console.log('PASS: Missed Split Logic');
     } else {
        console.error(`FAIL: Missed Split. Expected 600, Got ${mStats.splitSum}`);
     }
} else {
  console.error(`FAIL: Missed Raw Sum. Expected 600, Got ${mStats.rawSum}`);
}
