import ExcelJS from 'exceljs';

const COLUMNS = [
  { key: '項次',            header: '項次' },
  { key: '單號',            header: '單號' },
  { key: '身分證號',        header: '身分證號' },
  { key: '個案姓名',        header: '個案姓名' },
  { key: '福利身分別',      header: '福利身分別' },
  { key: '送單人',          header: '送單人' },
  { key: '繳款方式',        header: '繳款方式' },
  { key: '應收金額',        header: '應收金額' },
  { key: '備註',            header: '備註' },
  { key: '區域',            header: '區域' },
  { key: '個案者主責督導',  header: '個案者主責督導' },
  { key: '衛服部',          header: '衛服部' },
  { key: '差異',            header: '差異' },
  { key: '記帳金額',        header: '記帳金額' },
  { key: '居-部分負擔',     header: '居-部分負擔' },
  { key: '喘-部分負擔',     header: '喘-部分負擔' },
  { key: '短-部分負擔',     header: '短-部分負擔' },
  { key: '居部+喘部+短部(B)', header: '居部+喘部+短部(B)' },
  { key: '居-全額自',       header: '居-全額自' },
  { key: '喘-全額自',       header: '喘-全額自' },
  { key: '短-全額自',       header: '短-全額自' },
  { key: '居+喘+短全自',    header: '居+喘+短全自' },
  { key: '補申報(申請)',     header: '補申報(申請)' },
  { key: '補申報B(自付)',    header: '補申報B(自付)' },
  { key: '補申報G(自付)',    header: '補申報G(自付)' },
  { key: '已申報B(自付)',    header: '已申報B(自付)' },
  { key: '已申報G(自付)',    header: '已申報G(自付)' },
  { key: '公司負擔(申請金額)', header: '公司負擔(申請金額)' },
  { key: '繳費方式',        header: '繳費方式' },
  { key: '記帳日期',        header: '記帳日期' },
  { key: '入帳金額',        header: '入帳金額' },
  { key: '差額(C-D)',       header: '差額(C-D)' },
  { key: '超商繳款日期',    header: '超商繳款日期' },
];

const AMT_KEYS = new Set([
  '應收金額', '衛服部', '差異', '記帳金額',
  '居-部分負擔', '喘-部分負擔', '短-部分負擔', '居部+喘部+短部(B)',
  '居-全額自', '喘-全額自', '短-全額自', '居+喘+短全自',
  '補申報(申請)', '補申報B(自付)', '補申報G(自付)', '已申報B(自付)', '已申報G(自付)',
  '公司負擔(申請金額)', '入帳金額', '差額(C-D)',
]);

export const exportReceivableExcel = async (rows, institutionFullName, period) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('收據對照表');

  ws.addRow([`${institutionFullName || ''} ${period || ''} 應收清冊`]);
  ws.addRow([]);
  ws.addRow(COLUMNS.map(c => c.header));

  const headerRow = ws.getRow(3);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  };

  for (const row of rows) {
    ws.addRow(COLUMNS.map(c => {
      const v = row[c.key];
      if (v === '' || v === null || v === undefined) return '';
      if (AMT_KEYS.has(c.key) && typeof v === 'number') return v;
      return v;
    }));
  }

  // Auto-width
  COLUMNS.forEach((col, i) => {
    const colObj = ws.getColumn(i + 1);
    colObj.width = Math.max(col.header.length * 2 + 2, 10);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `收據對照表_${period || ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
