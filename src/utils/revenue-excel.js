import ExcelJS from 'exceljs';

const COLUMNS = [
  { key: '所屬機構',       header: '所屬機構' },
  { key: '申報年月',       header: '申報年月' },
  { key: '服務年月',       header: '服務年月' },
  { key: '類別',           header: '類別' },
  { key: '細項',           header: '細項' },
  { key: '身分證號',       header: '身分證號' },
  { key: '個案姓名',       header: '個案姓名' },
  { key: '採用計畫',       header: '採用計畫' },
  { key: 'CMS等級',        header: 'CMS\r\n等級' },
  { key: '福利身分別',     header: '福利身分別' },
  { key: '服務項目類別',   header: '服務項目\r\n類別' },
  { key: '服務日期',       header: '服務日期' },
  { key: '給付價格',       header: '給(支)付\r\n價格' },
  { key: '原民區支付價格', header: '原民區或離島支付價格' },
  { key: '次數',           header: '次數' },
  { key: '申報費用',       header: '申報費用' },
  { key: '部分負擔比率',   header: '部分負擔比率' },
  { key: '部分負擔費用',   header: '部分負擔\r\n費用' },
  { key: '補助比率',       header: '補助比率' },
  { key: '申請補助費用',   header: '申請(補助)費用' },
  { key: '原民區申請費用', header: '原民區或離島申請(補助)費用' },
  { key: '實際補助金額',   header: '實際補助\r\n金額' },
  { key: '服務當下居住縣市', header: '服務當下\r\n居住縣市' },
  { key: '目前居住縣市',   header: '目前居住縣市' },
  { key: '個案主責督導',   header: '個案主責督導' },
  { key: '目前居住行政區', header: '目前居住行政區' },
  { key: '照管專員',       header: '照管專員' },
  { key: '服務人員',       header: '服務人員' },
  { key: '碼別',           header: '碼別' },
];

export const exportRevenueExcel = async (rows, institutionFullName, period) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('照顧組合服務費用項目清冊');

  ws.addRow(['照顧組合服務費用項目清冊']);
  ws.addRow([]);
  ws.addRow([`服務單位：${institutionFullName || ''}`]);
  ws.addRow([]);
  ws.addRow(COLUMNS.map(c => c.header));

  for (const row of rows) {
    ws.addRow(COLUMNS.map(c => {
      const v = row[c.key];
      return v === '' || v === null || v === undefined ? '' : v;
    }));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `營業額_${period || ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
