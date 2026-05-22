export const LABOR_CAP = 45800;

export const computeLaborCapAdjustments = (employees, bonuses, records, aCodeResults) => {
  const result = {};
  employees.forEach(emp => {
    const bonus       = bonuses.find(b => b.empId === emp.empId) || {};
    const record      = records.find(r => r.empId === emp.empId) || {};
    const aCodeResult = aCodeResults.find(r => r.id === emp.empId || r.name === emp.name);

    const bgsBase =
      (record.b || 0) + (record.g || 0) + (record.s || 0) + (record.missed || 0) +
      (bonus.bgsOtherSubsidy || 0);

    const splitA    = aCodeResult ? aCodeResult.totalCommission : (bonus.bonusA || 0);
    const acodeBase = splitA + (bonus.bonusCross || 0) + (bonus.bonusOpen || 0) +
      (bonus.bonusDev || 0) + (bonus.bonusC || 0) + (bonus.referral || 0) +
      (bonus.mentoring || 0) + (bonus.holidayBonus || 0) + (bonus.otherSubsidy || 0);

    let bgsOther1  = 0;
    let acodeOther2 = 0;

    if (bgsBase > LABOR_CAP) {
      const excess = bgsBase - LABOR_CAP;
      bgsOther1   = -excess;
      acodeOther2 =  excess;
    } else if (bgsBase < LABOR_CAP) {
      const transfer = Math.min(LABOR_CAP - bgsBase, Math.max(0, acodeBase));
      bgsOther1   =  transfer;
      acodeOther2 = -transfer;
    }

    result[emp.empId] = { bgsOther1, acodeOther2 };
  });
  return result;
};
