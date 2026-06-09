import { getRevenueWelfare, getRevenueAcode, getRevenueSelfPay, getRevenueSupervisor } from '../data/revenueDataStore';
import { buildRevenueRows } from './revenueProcessor';
import { getInstitutionName } from '../constants/institutions';

// Scan localStorage for all periods that have welfare data for the given institution
function getAvailablePeriods(institution) {
  const prefix = `revenue_welfare_${institution}_`;
  const periods = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) {
      periods.push(k.slice(prefix.length));
    }
  }
  return periods.sort();
}

function summariseRows(rows) {
  const byCode = { 'B碼': 0, 'G碼': 0, 'S碼': 0, 'A碼': 0 };
  let total = 0;
  for (const r of rows) {
    const amt = Number(r.申報費用) || 0;
    total += amt;
    if (r.碼別 in byCode) {
      // For B碼/G碼/S碼, only count the non-selfpay rows to match the summary cards logic
      if (r.碼別 === 'B碼' && r.類別 === '居服' && r.細項 === '居服B碼') byCode['B碼'] += amt;
      else if (r.碼別 === 'G碼' && r.類別 === '喘息' && r.細項 === '喘息G碼') byCode['G碼'] += amt;
      else if (r.碼別 === 'S碼' && r.類別 === '短照' && r.細項 === '短照S碼') byCode['S碼'] += amt;
      else if (r.碼別 === 'A碼') byCode['A碼'] += amt;
    }
  }
  return { total, ...byCode };
}

// Returns [{period, label, total, B碼, G碼, S碼, A碼}, ...] sorted by period ascending
export function getRevenueHistory(institution) {
  const periods = getAvailablePeriods(institution);
  const institutionName = getInstitutionName(institution);
  return periods.map(period => {
    const welfare    = getRevenueWelfare(institution, period);
    const acode      = getRevenueAcode(institution, period);
    const selfpay    = getRevenueSelfPay(institution, period);
    const supervisor = getRevenueSupervisor(institution, period);
    const rows = buildRevenueRows(welfare, acode, selfpay, supervisor, institutionName, period);
    const summary = summariseRows(rows);
    // period format is e.g. "11306" → "113年06月"
    const label = period.length >= 5
      ? `${period.slice(0, -2)}年${period.slice(-2)}月`
      : period;
    return { period, label, ...summary };
  });
}
