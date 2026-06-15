const getCodeType = (serviceCode) => {
  const code = String(serviceCode || '').toUpperCase().split(/\s+/)[0];
  if (code.startsWith('BA')) return 'B碼';
  if (code.startsWith('GA') || code.startsWith('GB')) return 'G碼';
  if (code.startsWith('SA') || code.startsWith('SB') || code.startsWith('SC')) return 'S碼';
  if (code.startsWith('AA')) return 'A碼';
  return '';
};

const getFineItem = (category, codeType) => {
  if (codeType === 'A碼') {
    if (category === '居服') return '居服A碼';
    if (category === '喘息') return '喘息A碼';
    if (category === '短照') return '短照A碼';
    return `${category}A碼`;
  }
  if (codeType === 'B碼') return '居服B碼';
  if (codeType === 'G碼') return '喘息G碼';
  if (codeType === 'S碼') return '短照S碼';
  return '';
};

const firstServiceMonth = (dateStr) => {
  if (!dateStr) return '';
  const first = String(dateStr).split(',')[0].trim();
  const parts = first.split('/');
  if (parts.length >= 2) {
    const year = String(parts[0]).replace(/\D/g, '');
    const month = String(parts[1]).replace(/\D/g, '').padStart(2, '0');
    return `${year}${month}`;
  }
  return '';
};

export const periodToApplyMonth = (period) => {
  if (!period) return '';
  const [yearStr, monthStr] = period.split('-');
  if (!yearStr || !monthStr) return period;
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + 1;
  if (month > 12) { month = 1; year += 1; }
  const minguo = year - 1911;
  return `${minguo}${String(month).padStart(2, '0')}`;
};

export const buildRevenueRows = (welfareRows, acodeRows, selfPayRows, supervisorMap, institutionName, period) => {
  const applyMonth = periodToApplyMonth(period);
  const rows = [];

  // Build supervisor fallback from welfare rows (衛福部清冊 has 個案主責督導)
  const welfareSupMap = {};
  for (const r of (welfareRows || [])) {
    if (r.個案姓名 && r.個案主責督導 && !welfareSupMap[r.個案姓名])
      welfareSupMap[r.個案姓名] = r.個案主責督導;
  }
  const getSup = (name) => supervisorMap?.[name] || welfareSupMap[name] || '';

  for (const r of (welfareRows || [])) {
    const serviceItemName = String(r.服務項目類別 || '');
    const isMissed = serviceItemName.includes('服務未遇');
    const codeType = isMissed ? 'B碼' : getCodeType(r.服務項目類別);
    const category = r.序號 || '';
    const fineItem = isMissed ? '居服B碼' : getFineItem(category, codeType);
    rows.push({
      所屬機構: institutionName,
      申報年月: applyMonth,
      服務年月: firstServiceMonth(r.服務日期),
      類別: category,
      細項: fineItem,
      身分證號: r.身分證號,
      個案姓名: r.個案姓名,
      採用計畫: r.採用計畫,
      CMS等級: r.CMS等級,
      福利身分別: r.福利身分別,
      服務項目類別: r.服務項目類別,
      服務日期: r.服務日期,
      給付價格: r.給付價格,
      原民區支付價格: r.原民區支付價格,
      次數: r.次數,
      申報費用: r.申報費用,
      部分負擔比率: r.部分負擔比率,
      部分負擔費用: r.部分負擔費用,
      補助比率: r.補助比率,
      申請補助費用: r.申請補助費用,
      原民區申請費用: r.原民區申請費用,
      實際補助金額: r.實際補助金額,
      服務當下居住縣市: r.服務當下居住縣市,
      目前居住縣市: r.目前居住縣市,
      個案主責督導: r.個案主責督導 || getSup(r.個案姓名),
      目前居住行政區: r.目前居住行政區,
      照管專員: r.照管專員,
      服務人員: r.服務人員,
      碼別: codeType,
    });
  }

  for (const r of (acodeRows || [])) {
    const category = r.序號 || '';
    rows.push({
      所屬機構: institutionName,
      申報年月: applyMonth,
      服務年月: firstServiceMonth(r.服務日期),
      類別: category,
      細項: getFineItem(category, 'A碼'),
      身分證號: r.身分證號,
      個案姓名: r.個案姓名,
      採用計畫: r.採用計畫,
      CMS等級: r.CMS等級,
      福利身分別: '',
      服務項目類別: r.服務代碼,
      服務日期: r.服務日期,
      給付價格: r.給付價格,
      原民區支付價格: '',
      次數: r.數量,
      申報費用: r.小計,
      部分負擔比率: '',
      部分負擔費用: '',
      補助比率: '',
      申請補助費用: '',
      原民區申請費用: '',
      實際補助金額: '',
      服務當下居住縣市: '',
      目前居住縣市: r.目前居住縣市,
      個案主責督導: getSup(r.個案姓名),
      目前居住行政區: r.目前居住行政區,
      照管專員: r.照管專員,
      服務人員: r.服務人員,
      碼別: 'A碼',
    });
  }

  for (const r of (selfPayRows || [])) {
    const selfPayItemName = String(r.服務項目 || '');
    const isSelfMissed = selfPayItemName.includes('服務未遇');
    const codeType = isSelfMissed ? 'B碼' : getCodeType(r.服務項目);
    rows.push({
      所屬機構: institutionName,
      申報年月: applyMonth,
      服務年月: firstServiceMonth(r.服務日期),
      類別: '全自費',
      細項: isSelfMissed ? '居服B碼' : getFineItem('全自費', codeType),
      身分證號: '',
      個案姓名: r.個案,
      採用計畫: '',
      CMS等級: '',
      福利身分別: '',
      服務項目類別: r.服務項目,
      服務日期: r.服務日期 || '',
      給付價格: r.自費單價 ?? '',
      原民區支付價格: '',
      次數: r.自費數量,
      申報費用: r.自費小計,
      部分負擔比率: '',
      部分負擔費用: '',
      補助比率: '',
      申請補助費用: '',
      原民區申請費用: '',
      實際補助金額: '',
      服務當下居住縣市: '',
      目前居住縣市: '',
      個案主責督導: getSup(r.個案),
      目前居住行政區: r.目前居住行政區 || '',
      照管專員: '',
      服務人員: r.服務員 ?? '',
      碼別: codeType,
    });
  }

  return rows;
};
