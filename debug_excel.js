const XLSX = require('xlsx');
const fs = require('fs');

try {
    const buf = fs.readFileSync('居家服務明細.xlsx');
    const workbook = XLSX.read(buf, {type:'buffer'});
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headers = [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for(let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({r:range.s.r, c:C})];
        if(cell && cell.v) headers.push(cell.v);
    }
    console.log("Headers found:", JSON.stringify(headers));
    
    // Also print first row of data to check values
    const data = XLSX.utils.sheet_to_json(sheet);
    if (data.length > 0) {
        console.log("First row sample:", JSON.stringify(data[0], null, 2));
    }
} catch (e) {
    console.error("Error reading file:", e);
}
