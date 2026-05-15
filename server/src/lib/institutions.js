export const INSTITUTIONS = [
  { code: 'fucheng', name: '府城' },
  { code: 'hongkang', name: '鴻康' },
  { code: 'qianyi', name: '謙益' },
  { code: 'kuanze', name: '寬澤' },
];

export const INSTITUTION_CODES = new Set(INSTITUTIONS.map(i => i.code));

export function isValidInstitutionCode(code) {
  return INSTITUTION_CODES.has(code);
}
