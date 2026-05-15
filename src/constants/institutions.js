export const INSTITUTIONS = [
  { code: 'fucheng', name: '府城' },
  { code: 'hongkang', name: '鴻康' },
  { code: 'qianyi', name: '謙益' },
  { code: 'kuanze', name: '寬澤' },
];

export const INSTITUTION_CODES = new Set(INSTITUTIONS.map(i => i.code));

// 中文名 → code 的對照（用於 Excel 匯入驗證）
export const INSTITUTION_NAME_TO_CODE = Object.fromEntries(
  INSTITUTIONS.map(i => [i.name, i.code])
);

export function getInstitutionName(code) {
  return INSTITUTIONS.find(i => i.code === code)?.name ?? code;
}
