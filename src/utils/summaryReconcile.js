const groupRows = (rows) => {
  const map = new Map();
  for (const row of rows) {
    const k = `${row.case}||${row.code}`;
    if (!map.has(k)) {
      map.set(k, {
        case: row.case,
        code: row.code,
        codeFullName: row.codeFullName ?? row.code,
        quantity: 0,
        govAmount: 0,
        selfPayRatio: row.selfPayRatio,
        selfPayAmount: 0,
        selfPayQuantity: 0,
        selfPaySubtotal: 0,
        serviceMonths: new Set(),
      });
    }
    const entry = map.get(k);
    entry.quantity += row.quantity ?? 0;
    entry.govAmount += row.govAmount ?? 0;
    entry.selfPayAmount += row.selfPayAmount ?? 0;
    entry.selfPayQuantity += row.selfPayQuantity ?? 0;
    entry.selfPaySubtotal += row.selfPaySubtotal ?? 0;
    if (row.serviceMonth) entry.serviceMonths.add(row.serviceMonth);
    if (!entry.selfPayRatio && row.selfPayRatio) entry.selfPayRatio = row.selfPayRatio;
    if (!entry.codeFullName || entry.codeFullName === entry.code) {
      entry.codeFullName = row.codeFullName ?? row.code;
    }
  }
  return map;
};

const numEq = (a, b) => Math.round(a ?? 0) === Math.round(b ?? 0);
const ratioEq = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

export const reconcileSummaries = (caseQuantityRows, welfareRows) => {
  const recMap = groupRows(caseQuantityRows);
  const welMap = groupRows(welfareRows);

  const allKeys = new Set([...recMap.keys(), ...welMap.keys()]);

  const rows = [];
  for (const k of allKeys) {
    const rec = recMap.get(k) ?? null;
    const wel = welMap.get(k) ?? null;

    const diffs = [];
    if (rec && wel) {
      if (!numEq(rec.quantity, wel.quantity)) diffs.push('quantity');
      if (!numEq(rec.govAmount, wel.govAmount)) diffs.push('govAmount');
      if (!ratioEq(rec.selfPayRatio, wel.selfPayRatio)) diffs.push('selfPayRatio');
      if (!numEq(rec.selfPayAmount, wel.selfPayAmount)) diffs.push('selfPayAmount');
    }

    let status;
    if (!rec) status = 'welfareOnly';
    else if (!wel) status = 'recordOnly';
    else if (diffs.length > 0) status = 'mismatch';
    else status = 'match';

    rows.push({
      case: rec?.case ?? wel?.case,
      code: rec?.code ?? wel?.code,
      codeFullName: wel?.codeFullName ?? rec?.codeFullName ?? rec?.code ?? wel?.code,
      record: rec ? {
        quantity: rec.quantity,
        govAmount: rec.govAmount,
        selfPayRatio: rec.selfPayRatio,
        selfPayAmount: rec.selfPayAmount,
        selfPayQuantity: rec.selfPayQuantity,
        selfPaySubtotal: rec.selfPaySubtotal,
      } : null,
      welfare: wel ? {
        serviceMonths: [...wel.serviceMonths].sort(),
        quantity: wel.quantity,
        govAmount: wel.govAmount,
        selfPayRatio: wel.selfPayRatio,
        selfPayAmount: wel.selfPayAmount,
      } : null,
      diffs,
      status,
    });
  }

  rows.sort((a, b) => {
    const cmp = a.case.localeCompare(b.case, 'zh-TW');
    return cmp !== 0 ? cmp : a.code.localeCompare(b.code);
  });

  return rows;
};
