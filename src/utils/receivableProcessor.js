const getCodeType = (code) => {
  const raw = String(code || '');
  if (raw.includes('服務未遇')) return 'B';
  const c = raw.toUpperCase().split(/\s+/)[0];
  if (c.startsWith('BA')) return 'B';
  if (c.startsWith('GA') || c.startsWith('GB')) return 'G';
  if (c.startsWith('SA') || c.startsWith('SB') || c.startsWith('SC')) return 'S';
  return null;
};

export const buildReceivableRows = (rosterRows, welfareRows, selfPayRows, supervisorMap, districtMap) => {
  // copay lookup: caseName -> { B, G, S }
  const welfareCopay = {};
  for (const r of (welfareRows || [])) {
    const name = String(r.個案姓名 || '').trim();
    if (!name) continue;
    const type = getCodeType(r.服務項目類別);
    if (!type) continue;
    const amt = Number(r.部分負擔費用) || 0;
    if (!welfareCopay[name]) welfareCopay[name] = { B: 0, G: 0, S: 0 };
    welfareCopay[name][type] += amt;
  }

  // self-pay lookup: caseName -> { B, G, S }
  const selfPayMap = {};
  for (const r of (selfPayRows || [])) {
    const name = String(r.個案 || '').trim();
    if (!name) continue;
    const type = getCodeType(r.服務項目);
    if (!type) continue;
    const amt = Number(r.自費小計) || 0;
    if (!selfPayMap[name]) selfPayMap[name] = { B: 0, G: 0, S: 0 };
    selfPayMap[name][type] += amt;
  }

  return rosterRows.map((r) => {
    const name = String(r.個案姓名 || '').trim();
    const copay = welfareCopay[name] || { B: 0, G: 0, S: 0 };
    const sp    = selfPayMap[name]  || { B: 0, G: 0, S: 0 };

    const copayTotal   = copay.B + copay.G + copay.S;
    const spTotal      = sp.B + sp.G + sp.S;
    const accountAmt   = copayTotal + spTotal;
    const receivable   = Number(r.應收金額) || 0;
    const diff         = receivable - accountAmt;

    return {
      項次: r.項次,
      單號: r.單號,
      身分證號: r.身分證號,
      個案姓名: name,
      福利身分別: r.福利身分別,
      送單人: r.送單人,
      繳款方式: r.繳款方式,
      應收金額: receivable,
      備註: r.備註,
      區域: districtMap?.[name] || '',
      個案者主責督導: supervisorMap?.[name] || '',
      衛服部: copayTotal,
      差異: diff,
      記帳金額: accountAmt,
      '居-部分負擔': copay.B,
      '喘-部分負擔': copay.G,
      '短-部分負擔': copay.S,
      '居部+喘部+短部(B)': copayTotal,
      '居-全額自': sp.B,
      '喘-全額自': sp.G,
      '短-全額自': sp.S,
      '居+喘+短全自': spTotal,
      '補申報(申請)': '',
      '補申報B(自付)': '',
      '補申報G(自付)': '',
      '已申報B(自付)': '',
      '已申報G(自付)': '',
      '公司負擔(申請金額)': '',
      繳費方式: '',
      記帳日期: '',
      入帳金額: '',
      '差額(C-D)': '',
      超商繳款日期: '',
    };
  });
};
