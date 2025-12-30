import * as XLSX from 'xlsx';

export const parseExcelToJSON = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0]; // Assume first sheet
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};


export const parseEmployeeExcel = async (file) => {
    const jsonData = await parseExcelToJSON(file);
    // Map columns to data model (Reuse previous logic)
    const employees = jsonData.map(row => {
        const findKey = (keys) => Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
        
        const empId = row[findKey(['emp id', 'empid', '員編', '員工編號'])] || '';
        const name = row[findKey(['name', 'full name', '姓名'])] || '';
        const idNumber = row[findKey(['id number', 'idnumber', 'id', '身分證', '身分證字號'])] || '';
        const position = row[findKey(['position', 'position type', '職級'])] || 'Full-time';
        
        const globalSplitRaw = row[findKey(['拆帳比例', 'global split', 'split ratio'])] || 0;
        let globalSplit = parseFloat(globalSplitRaw);
        
        // Convert decimal (e.g. 0.55) to percentage (55)
        if (globalSplit > 0 && globalSplit <= 1) {
            globalSplit = parseFloat((globalSplit * 100).toFixed(1));
        }

        const b = globalSplit || parseFloat(row[findKey(['b', 'b code', 'b碼', 'b拆帳'])] || 0);
        const g = globalSplit || parseFloat(row[findKey(['g', 'g code', 'g碼', 'g拆帳'])] || 0);
        const s = globalSplit || parseFloat(row[findKey(['s', 's code', 's碼', 's拆帳'])] || 0);
        const missed = globalSplit || parseFloat(row[findKey(['missed', 'missed service', 'not found', '未遇', '服務未遇'])] || 0);

        const bankCode = row[findKey(['銀行代碼', 'bank code', 'bank'])] || '';
        const bankAccount = row[findKey(['匯款帳號', 'account number', 'account', '帳號'])] || '';

        if (!empId || !name) return null; 

        return {
             empId: String(empId).trim(),
             name: String(name).trim(),
             idNumber: String(idNumber).trim(),
             position: position.includes('兼') || position.toLowerCase().includes('part') ? 'Part-time' : 'Full-time',
             bankCode: String(bankCode).trim(),
             bankAccount: String(bankAccount).trim(),
             splits: { b, g, s, missed }
        };
    }).filter(Boolean);
    return employees;
};

export const parseServiceRecordExcel = async (file) => {
    const jsonData = await parseExcelToJSON(file);
    
    return jsonData.map(row => {
        const findKey = (keys) => Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));

        // 1. Employee Name
        const empName = row[findKey(['服務人員', '服務員', 'employee'])] || '';
        
        // 2. Client Name
        const clientName = row[findKey(['服務個案', '案主', 'client'])] || '';

        // 3. Service Data
        const code = row[findKey(['服務代碼', 'code'])] || '';
        const serviceName = row[findKey(['服務項目', 'service'])] || '';
        
        // Helper for safe number parsing
        const safeParseFloat = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            // Remove commas and other non-numeric chars (except dot and sign)
            const cleanVal = String(val).replace(/[^\d.-]/g, '');
            const num = parseFloat(cleanVal);
            return isNaN(num) ? 0 : num;
        };

        // 4. Quantity
        const count = safeParseFloat(row[findKey(['使用服務數量', '數量', 'count'])]);

        // 5. Price & Amount Calculation
        // Logic: Check payment type. If "自費", use SelfPay Price, else Govt Price.
        // Handle "自費 / 補助" with varying spaces
        const paymentTypeKey = Object.keys(row).find(k => 
            ['自費/補助', '自費 / 補助', 'payment type', 'type'].includes(k.trim().replace(/\s*[\/\\]\s*/g, '/').toLowerCase()) || 
            ['自費 / 補助'].includes(k.trim()) 
        );
        const paymentType = row[paymentTypeKey] || '';
        
        const priceGovt = safeParseFloat(row[findKey(['政府單價', 'govt price'])]);
        const priceSelf = safeParseFloat(row[findKey(['自費單價', 'self pay price'])]);

        const isSelfPay = paymentType.includes('自費');
        const unitPrice = isSelfPay ? priceSelf : priceGovt;
        
        // Calculate Total Amount
        const totalAmount = unitPrice * count;

        if (!empName) return null;

        // Return normalized object matching calculator.js expectation
        return {
            '服務員': empName.trim(),
            'Client': clientName.trim(),
            '代碼': code.trim(),
            '服務項目': serviceName.trim(),
            '總金額': totalAmount, // This is the calculated key calculator.js looks for
            '數量': count,
            '自費/補助': paymentType // Optional, for debug
        };
    }).filter(Boolean);
};

export const parseDeductionExcel = async (file) => {
    const jsonData = await parseExcelToJSON(file);
    
    return jsonData.map(row => {
        const findKey = (keys) => Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));

        const empId = row[findKey(['員編', 'emp id', 'id'])] || '';
        const name = row[findKey(['姓名', 'name'])] || '';
        
        // Deduction Fields
        const withholdingTax = parseFloat(row[findKey(['扣繳稅額', 'tax', 'withholding'])] || 0);
        
        const laborLevel = parseFloat(row[findKey(['勞保級距', 'labor level', 'li level'])] || 0);
        const laborFee = parseFloat(row[findKey(['勞保費用', 'labor fee', 'li fee'])] || 0);
        
        const healthLevel = parseFloat(row[findKey(['健保級距', 'health level', 'hi level'])] || 0);
        const healthFee = parseFloat(row[findKey(['健保費用', 'health fee', 'hi fee'])] || 0);
        
        const pensionRate = parseFloat(row[findKey(['自提比例', '自提比例(%)', 'pension rate'])] || 0);
        const pensionFee = parseFloat(row[findKey(['自提金額', 'pension fee', 'pension amount'])] || 0);

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
            pensionFee
        };
    }).filter(Boolean);
};

export const parseBonusExcel = async (file) => {
    const jsonData = await parseExcelToJSON(file);
    
    return jsonData.map(row => {
        const findKey = (keys) => Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));

        const empId = row[findKey(['員編', 'emp id', 'id'])] || '';
        const name = row[findKey(['姓名', 'name'])] || '';
        
        // Bonus Fields
        const bonusA = parseFloat(row[findKey(['a碼獎金', 'a bonus', 'bonus a'])] || 0);
        const bonusC = parseFloat(row[findKey(['丙證獎金', 'c license', 'license c'])] || 0);
        const bonusOpen = parseFloat(row[findKey(['開案獎金', 'open case', 'opening bonus'])] || 0);
        const bonusDev = parseFloat(row[findKey(['開發獎金', 'development bonus'])] || 0);
        const bonusCross = parseFloat(row[findKey(['跨區獎金', 'cross district'])] || 0);
        const referral = parseFloat(row[findKey(['介紹費', 'referral fee'])] || 0);
        const mentoring = parseFloat(row[findKey(['帶新人津貼', 'mentoring', 'mentor'])] || 0);
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
            other
        };
    }).filter(Boolean);
};
