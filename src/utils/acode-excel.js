import * as XLSX from 'xlsx';

export const readExcel = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
                const headers = json.length > 0 ? Object.keys(json[0]) : [];
                resolve({ json, headers });
            } catch (error) {
                reject(new Error("Excel 解析失敗：" + error.message));
            }
        };
        reader.onerror = (e) => reject(new Error("檔案讀取錯誤"));
        reader.readAsArrayBuffer(file);
    });
};

export const downloadExcel = (calculationResult, summaryResult, errors, debugInfo) => {
    const wb = XLSX.utils.book_new();
    const detailData = calculationResult.map(r => ({
        序號: r.serialNum,
        服務日期: r.date,
        個案姓名: r.client,
        督導: r.supervisor,
        A碼代號: r.code,
        居服員: r.workerId ? (r.workerId + r.worker) : r.worker,
        身分: r.role,
        分得數量: r.qty, 
        分配營收: r.revenueAllocated,
        抽成率: r.commissionRate,
        拆帳金額: r.amount, 
        備註: r.note
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, "詳細拆帳紀錄");
    
    // Summary Sheet needs to be flattened for Excel
    const summaryRows = [];
    summaryResult.forEach(s => {
        s.details.forEach(d => {
            summaryRows.push({
                服務人員: s.name,
                員編: s.id,
                服務個案: d.client,
                督導: d.supervisor,
                服務代碼: d.code,
                數量: d.qty,
                小計: d.subtotal,
                拆帳金額: d.amount
            });
        });
    });
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "人員薪資統計");

    if (errors.length > 0) {
        const wsErrors = XLSX.utils.json_to_sheet(errors.map(e => ({ 錯誤訊息: e })));
        XLSX.utils.book_append_sheet(wb, wsErrors, "無法媒合紀錄");
    }
    
    if (debugInfo) {
        const wsDebug = XLSX.utils.json_to_sheet([
            { 項目: "A碼清冊原始總金額 (Input)", 數值: debugInfo.totalInput },
            { 項目: "成功媒合並分配之營收 (Matched Revenue)", 數值: debugInfo.totalAllocated },
            { 項目: "差異金額 (Diff)", 數值: debugInfo.diff },
            { 項目: "---", 數值: "---" },
            { 項目: "預計發放總薪資 (Total Salary)", 數值: debugInfo.totalCommissionPaid },
            { 項目: "產出結果筆數", 數值: debugInfo.resultCount },
        ]);
        XLSX.utils.book_append_sheet(wb, wsDebug, "系統診斷報告");
    }
    XLSX.writeFile(wb, `拆A碼結果_${new Date().toISOString().slice(0,10)}.xlsx`);
};
