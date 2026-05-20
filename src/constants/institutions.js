export const INSTITUTIONS = [
  { code: 'fucheng',  name: '府城', fullName: '有限責任臺南市府城照顧服務勞動合作社附設臺南市私立府城居家長照機構' },
  { code: 'hongkang', name: '鴻康', fullName: '府城長照有限公司附設臺南市私立鴻康居家長照機構' },
  { code: 'qianyi',   name: '謙益', fullName: '府城長照有限公司附設臺南市私立謙益居家長照機構' },
  { code: 'kuanze',   name: '寬澤', fullName: '府城長照有限公司附設臺南市私立寬澤居家長照機構' },
];

export const INSTITUTION_CODES = new Set(INSTITUTIONS.map(i => i.code));

// 中文名 → code 的對照（用於 Excel 匯入驗證）
export const INSTITUTION_NAME_TO_CODE = Object.fromEntries(
  INSTITUTIONS.map(i => [i.name, i.code])
);

export function getInstitutionName(code) {
  return INSTITUTIONS.find(i => i.code === code)?.name ?? code;
}

export function getInstitutionFullName(code) {
  return INSTITUTIONS.find(i => i.code === code)?.fullName ?? getInstitutionName(code);
}
