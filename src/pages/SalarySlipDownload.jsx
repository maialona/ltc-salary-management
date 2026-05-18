import React, { useState, useEffect, useRef } from 'react';
import { getEmployees } from '../data/employeeStore';
import { getBonuses } from '../data/bonusStore';
import { getDeductions } from '../data/deductionStore';
import { getRecords } from '../data/recordsStore';
import { getAcodeResults } from '../data/acodeStore';
import { subscribePeriod, getPeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import { getInstitutionName } from '../constants/institutions';
import { FileText, Printer } from 'lucide-react';

// ─── Formatters ───────────────────────────────────────────────────────────────
const money = (n) => (n != null && n !== 0) ? `$${Math.round(n).toLocaleString()}` : '–';
const pct   = (n) => n ? `${n}%` : '–';
const today = () => new Date().toLocaleDateString('zh-TW');

// ─── Print style (injected once) ─────────────────────────────────────────────
const PRINT_STYLE = `
  @media print {
    @page { size: A4; margin: 12mm; }
    html, body, #root, #salary-slip-root {
      height: auto !important; overflow: visible !important;
      position: static !important; display: block !important;
    }
    .slip-page { page-break-after: always; break-after: page; }
    .slip-page:last-child { page-break-after: auto; break-after: auto; }
    .print\\:hidden { display: none !important; }
  }
`;

// ─── Shared print-page wrapper ────────────────────────────────────────────────
const SlipPage = ({ isBulk, children }) => (
  <div className={`bg-white text-black mx-auto max-w-[190mm] min-h-[267mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:min-h-0 print:m-0 rounded-sm${isBulk ? ' slip-page mb-8 print:mb-0' : ''}`}>
    {children}
  </div>
);

// ─── Shared section label ─────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500 border-b border-gray-300 pb-0.5 mb-1.5">
    {children}
  </div>
);

// ─── Shared slip header ───────────────────────────────────────────────────────
const SlipHeader = ({ title, period, emp, institutionName }) => (
  <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-end">
    <div>
      <div className="text-[10px] text-gray-500 font-bold tracking-wide mb-0.5">{institutionName}</div>
      <h1 className="text-xl font-black tracking-tight leading-none">{title}</h1>
    </div>
    <div className="text-right text-[10px] text-gray-600 space-y-0.5">
      <div>薪資月份：<span className="font-bold text-black">{period}</span></div>
      <div>員編：{emp.empId}　姓名：<span className="font-bold text-black">{emp.name}</span></div>
      <div>列印日期：{today()}</div>
    </div>
  </div>
);

// ─── Service items table (shared layout) ──────────────────────────────────────
const ServiceTable = ({ rows, splitTotal, showRaw = true }) => (
  <table className="w-full text-[10px] border-collapse">
    <thead>
      <tr className="bg-gray-100 border-b border-gray-300">
        <th className="py-1 px-2 text-left font-bold">個案</th>
        <th className="py-1 px-2 text-left font-bold">服務項目</th>
        <th className="py-1 px-2 text-right font-bold">組數</th>
        {showRaw && <th className="py-1 px-2 text-right font-bold">申請金額</th>}
        <th className="py-1 px-2 text-right font-bold">拆帳金額</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr><td colSpan={showRaw ? 5 : 4} className="py-3 text-center text-gray-400 italic">無服務紀錄</td></tr>
      ) : (
        rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="py-1 px-2 font-medium">{row.client}</td>
            <td className="py-1 px-2 font-mono">{row.code}</td>
            <td className="py-1 px-2 text-right font-mono">{Number(row.count ?? row.qty ?? 0).toFixed(2)}</td>
            {showRaw && <td className="py-1 px-2 text-right font-mono">{money(row.rawAmount ?? row.subtotal ?? row.amount)}</td>}
            <td className="py-1 px-2 text-right font-mono font-semibold">{money(row.splitAmount ?? row.split ?? row.amount)}</td>
          </tr>
        ))
      )}
    </tbody>
    <tfoot>
      <tr className="border-t-2 border-gray-400 bg-gray-50">
        <td colSpan={showRaw ? 4 : 3} className="py-1.5 px-2 font-bold text-right">服務拆帳小計</td>
        <td className="py-1.5 px-2 text-right font-black font-mono">{money(splitTotal)}</td>
      </tr>
    </tfoot>
  </table>
);

// ─── Amount row (label + value, for supplements/deductions) ──────────────────
const AmountRow = ({ label, value, negative = false, className = '' }) => (
  value !== 0 ? (
    <div className={`flex justify-between items-center py-0.5 text-[10px] ${className}`}>
      <span className="text-gray-700">{label}</span>
      <span className={`font-mono font-semibold ${negative ? 'text-red-600' : ''}`}>
        {negative ? `–${money(value).replace('$','')}` : money(value)}
      </span>
    </div>
  ) : null
);

const SubtotalRow = ({ label, value, negative = false }) => (
  <div className="flex justify-between items-center py-1 border-t border-gray-300 mt-1 text-[10px]">
    <span className="font-bold">{label}</span>
    <span className={`font-black font-mono text-sm ${negative ? 'text-red-700' : ''}`}>
      {negative ? `–${money(value).replace('$','')}` : money(value)}
    </span>
  </div>
);

// ─── Info grid for employee basic data ────────────────────────────────────────
const InfoGrid = ({ cells }) => (
  <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[10px]">
    {cells.map(({ label, value }, i) => (
      <div key={i} className="flex flex-col">
        <span className="text-gray-500 text-[9px] leading-none mb-0.5">{label}</span>
        <span className="font-semibold leading-tight">{value || '–'}</span>
      </div>
    ))}
  </div>
);

// ─── Net salary footer ────────────────────────────────────────────────────────
const NetFooter = ({ income, deduction, net }) => (
  <div className="mt-4 border-t-2 border-black pt-3 flex justify-between items-center">
    <div className="text-[9px] text-gray-500 space-y-0.5">
      <div>應領小計 <span className="font-mono font-bold text-black">{money(income)}</span></div>
      <div>應扣小計 <span className="font-mono font-bold text-red-600">–{money(deduction).replace('$','')}</span></div>
    </div>
    <div className="text-right">
      <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">本月實領</div>
      <div className="text-3xl font-black font-mono">{money(net)}</div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// BGS碼薪資 Template
// ════════════════════════════════════════════════════════════════════════════
const BgsTemplate = ({ data, isBulk }) => {
  const { emp, institutionName, serviceItems, totalSplit,
          otherSubsidy, other, laborFee, healthFee, pensionFee, otherDeduction, net } = data;
  const sp = emp.splits || {};
  const splitDesc = [
    sp.b      && `B碼 ${sp.b}%`,
    sp.g      && `G碼 ${sp.g}%`,
    sp.s      && `S碼 ${sp.s}%`,
    sp.missed && `未遇 ${sp.missed}%`,
  ].filter(Boolean).join('　');

  const totalIncome = totalSplit + (otherSubsidy || 0) + (other || 0);
  const totalDed = (laborFee || 0) + (healthFee || 0) + (pensionFee || 0) + (otherDeduction || 0);

  // Map calculator items to table row shape
  const rows = serviceItems.map(it => ({
    client: it.client,
    code: it.code,
    count: it.count,
    rawAmount: (it.amount || 0) + (it.selfPayAmount || 0),
    splitAmount: it.split,
  }));

  return (
    <SlipPage isBulk={isBulk}>
      <div className="p-8 space-y-4">
        <SlipHeader title="BGS碼薪資明細表" period={getPeriod()} emp={emp} institutionName={institutionName} />

        {/* 人員基本資料 */}
        <section>
          <SectionLabel>人員基本資料</SectionLabel>
          <InfoGrid cells={[
            { label: '姓名',     value: emp.name },
            { label: '所屬機構', value: institutionName },
            { label: '匯款帳號', value: emp.bankAccount ? `${emp.bankCode || ''} ${emp.bankAccount}`.trim() : null },
            { label: 'BGS碼抽成', value: splitDesc || null },
            { label: '勞保費 (級距)', value: emp.laborInsuranceBracket ? `$${emp.laborInsuranceBracket.toLocaleString()}` : null },
            { label: '健保費 (級距)', value: emp.healthInsuranceBracket ? `$${emp.healthInsuranceBracket.toLocaleString()}` : null },
            { label: '勞退自提率', value: emp.voluntaryPensionRate ? `${emp.voluntaryPensionRate}%` : null },
          ]} />
        </section>

        {/* 服務項目明細 */}
        <section>
          <SectionLabel>服務項目明細（BGS碼 / 未遇）</SectionLabel>
          <ServiceTable rows={rows} splitTotal={totalSplit} />
        </section>

        {/* 其他收入 */}
        {(otherSubsidy > 0 || other > 0) && (
          <section>
            <SectionLabel>其他收入</SectionLabel>
            <div className="bg-gray-50 rounded px-3 py-2">
              <AmountRow label="其他補貼" value={otherSubsidy} />
              <AmountRow label="其他" value={other} />
              {(otherSubsidy > 0 || other > 0) && (
                <SubtotalRow label="其他收入小計" value={otherSubsidy + other} />
              )}
            </div>
          </section>
        )}

        {/* 應扣費用 */}
        <section>
          <SectionLabel>應扣費用明細</SectionLabel>
          <div className="bg-gray-50 rounded px-3 py-2">
            <AmountRow label={`勞保費${emp.laborInsuranceBracket ? ` (級距 $${emp.laborInsuranceBracket.toLocaleString()})` : ''}`} value={laborFee} negative />
            <AmountRow label={`健保費${emp.healthInsuranceBracket ? ` (級距 $${emp.healthInsuranceBracket.toLocaleString()})` : ''}`} value={healthFee} negative />
            <AmountRow label={`勞退自提${emp.voluntaryPensionRate ? ` (${emp.voluntaryPensionRate}%)` : ''}`} value={pensionFee} negative />
            <AmountRow label="其他扣款" value={otherDeduction} negative />
            <SubtotalRow label="應扣小計" value={totalDed} negative />
          </div>
        </section>

        <NetFooter income={totalIncome} deduction={totalDed} net={net} />
      </div>
    </SlipPage>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// A碼及獎金薪資 Template
// ════════════════════════════════════════════════════════════════════════════
const AcodeTemplate = ({ data, isBulk }) => {
  const { emp, institutionName, serviceItems, totalSplit,
          fuel, otherSubsidy, other, bonusItems,
          withholdingTax, otherDeduction, net } = data;
  const acodeRate = emp.splits?.aa09;

  const allSubsidyBonus = (fuel || 0) + (otherSubsidy || 0) + (other || 0)
    + bonusItems.reduce((s, b) => s + b.value, 0);
  const totalDed = (withholdingTax || 0) + (otherDeduction || 0);

  // A-code items: details have { client, code, qty, subtotal, amount }
  const rows = serviceItems.map(it => ({
    client: it.client,
    code: it.code,
    count: it.qty,
    rawAmount: it.subtotal,
    splitAmount: it.amount,
  }));

  return (
    <SlipPage isBulk={isBulk}>
      <div className="p-8 space-y-4">
        <SlipHeader title="A碼及獎金薪資明細表" period={getPeriod()} emp={emp} institutionName={institutionName} />

        {/* 人員基本資料 */}
        <section>
          <SectionLabel>人員基本資料</SectionLabel>
          <InfoGrid cells={[
            { label: '姓名',     value: emp.name },
            { label: '所屬機構', value: institutionName },
            { label: 'A碼抽成',  value: acodeRate ? `${acodeRate}%` : null },
          ]} />
        </section>

        {/* A碼服務項目明細 */}
        <section>
          <SectionLabel>A碼服務項目明細</SectionLabel>
          <ServiceTable rows={rows} splitTotal={totalSplit} />
        </section>

        {/* 獎金及補貼 */}
        {allSubsidyBonus > 0 && (
          <section>
            <SectionLabel>獎金及補貼</SectionLabel>
            <div className="bg-gray-50 rounded px-3 py-2">
              <AmountRow label="油資補貼" value={fuel} />
              <AmountRow label="其他補貼" value={otherSubsidy} />
              {bonusItems.map((b, i) => <AmountRow key={i} label={b.label} value={b.value} />)}
              <AmountRow label="其他" value={other} />
              <SubtotalRow label="獎金補貼小計" value={allSubsidyBonus} />
            </div>
          </section>
        )}

        {/* 應扣費用（不含勞健保，已在 BGS 薪資中扣除） */}
        <section>
          <SectionLabel>應扣費用明細</SectionLabel>
          <div className="bg-gray-50 rounded px-3 py-2">
            <AmountRow label={`扣繳稅額${emp.dependentsCount != null ? ` (扶養 ${emp.dependentsCount} 人)` : ''}`} value={withholdingTax} negative />
            <AmountRow label="其他扣款" value={otherDeduction} negative />
            {totalDed > 0 && <SubtotalRow label="應扣小計" value={totalDed} negative />}
          </div>
        </section>

        <NetFooter income={totalSplit + allSubsidyBonus} deduction={totalDed} net={net} />
      </div>
    </SlipPage>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// 薪資總表 Template
// ════════════════════════════════════════════════════════════════════════════
const SummaryTemplate = ({ data, isBulk }) => {
  const { emp, institutionName,
          splitB, splitG, splitS, splitMissed, bgsServiceIncome, bgsOtherSubsidy,
          laborFee, healthFee, pensionFee,
          splitA, crossArea, serviceBonus, quotaDev, certBonus, referral, mentoring, holidayBonus,
          acodeOtherSubsidy, other, fuel,
          withholdingTax, otherDeduction,
          totalIncome, totalDeduction, net } = data;

  const hasBgs = bgsServiceIncome > 0 || bgsOtherSubsidy > 0;
  const hasAcode = splitA > 0;

  const acodeSupplements = [
    { label: '油資補貼',   value: fuel },
    { label: '跨區獎金',   value: crossArea },
    { label: '服務獎金',   value: serviceBonus },
    { label: '開發獎金',   value: quotaDev },
    { label: '丙證獎金',   value: certBonus },
    { label: '介紹費',     value: referral },
    { label: '帶新人津貼', value: mentoring },
    { label: '節日獎金',   value: holidayBonus },
    { label: '其他補貼',   value: acodeOtherSubsidy },
    { label: '其他',       value: other },
  ].filter(i => i.value > 0);

  const bgsIncome = bgsServiceIncome + bgsOtherSubsidy;
  const bgsDed = (laborFee || 0) + (healthFee || 0) + (pensionFee || 0);
  const acodeIncome = splitA + acodeSupplements.reduce((s, i) => s + i.value, 0);
  const acodeDed = (withholdingTax || 0) + (otherDeduction || 0);

  return (
    <SlipPage isBulk={isBulk}>
      <div className="p-8 space-y-4">
        <SlipHeader title="薪資總表" period={getPeriod()} emp={emp} institutionName={institutionName} />

        <div className="grid grid-cols-2 gap-6">
          {/* BGS 欄 */}
          <section>
            <SectionLabel>BGS碼薪資</SectionLabel>
            <div className="space-y-0 text-[10px]">
              {splitB > 0 && <AmountRow label="B碼拆帳" value={splitB} />}
              {splitG > 0 && <AmountRow label="G碼拆帳" value={splitG} />}
              {splitS > 0 && <AmountRow label="S碼拆帳" value={splitS} />}
              {splitMissed > 0 && <AmountRow label="未遇拆帳" value={splitMissed} />}
              {bgsServiceIncome > 0 && (
                <div className="flex justify-between py-0.5 border-t border-dashed border-gray-300 mt-1">
                  <span className="font-bold">服務拆帳小計</span>
                  <span className="font-mono font-bold">{money(bgsServiceIncome)}</span>
                </div>
              )}
              {bgsOtherSubsidy > 0 && <AmountRow label="其他補貼" value={bgsOtherSubsidy} className="mt-1" />}
            </div>
            {hasBgs && (
              <div className="mt-2 pt-1 border-t border-gray-200 space-y-0 text-[10px]">
                <SectionLabel>BGS 應扣費用</SectionLabel>
                <AmountRow label={`勞保費${emp.laborInsuranceBracket ? ` ($${emp.laborInsuranceBracket.toLocaleString()})` : ''}`} value={laborFee} negative />
                <AmountRow label={`健保費${emp.healthInsuranceBracket ? ` ($${emp.healthInsuranceBracket.toLocaleString()})` : ''}`} value={healthFee} negative />
                <AmountRow label={`勞退${emp.voluntaryPensionRate ? ` (${emp.voluntaryPensionRate}%)` : ''}`} value={pensionFee} negative />
                {bgsDed > 0 && <SubtotalRow label="BGS應扣小計" value={bgsDed} negative />}
              </div>
            )}
            {hasBgs && (
              <div className="mt-2 pt-1 border-t-2 border-gray-400">
                <div className="flex justify-between text-[10px]">
                  <span className="font-black">BGS實領小計</span>
                  <span className="font-black font-mono">{money(bgsIncome - bgsDed)}</span>
                </div>
              </div>
            )}
          </section>

          {/* A碼 欄 */}
          <section>
            <SectionLabel>A碼及獎金薪資</SectionLabel>
            <div className="space-y-0 text-[10px]">
              {splitA > 0 && <AmountRow label="A碼拆帳" value={splitA} />}
              {acodeSupplements.map((s, i) => <AmountRow key={i} label={s.label} value={s.value} />)}
              {acodeIncome > 0 && (
                <div className="flex justify-between py-0.5 border-t border-dashed border-gray-300 mt-1">
                  <span className="font-bold">A碼收入小計</span>
                  <span className="font-mono font-bold">{money(acodeIncome)}</span>
                </div>
              )}
            </div>
            {hasAcode && (
              <div className="mt-2 pt-1 border-t border-gray-200 space-y-0 text-[10px]">
                <SectionLabel>A碼 應扣費用</SectionLabel>
                <AmountRow label={`扣繳稅額${emp.dependentsCount != null ? ` (扶養 ${emp.dependentsCount} 人)` : ''}`} value={withholdingTax} negative />
                <AmountRow label="其他扣款" value={otherDeduction} negative />
                {acodeDed > 0 && <SubtotalRow label="A碼應扣小計" value={acodeDed} negative />}
              </div>
            )}
            {hasAcode && (
              <div className="mt-2 pt-1 border-t-2 border-gray-400">
                <div className="flex justify-between text-[10px]">
                  <span className="font-black">A碼實領小計</span>
                  <span className="font-black font-mono">{money(acodeIncome - acodeDed)}</span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Combined net */}
        <div className="border-t-4 border-black pt-3 flex justify-between items-center bg-gray-50 px-4 py-3 rounded">
          <div className="text-[10px] text-gray-600 space-y-0.5">
            <div>應領合計 <span className="font-mono font-bold text-black">{money(totalIncome)}</span></div>
            <div>應扣合計 <span className="font-mono font-bold text-red-600">–{money(totalDeduction).replace('$','')}</span></div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">本月合計實領</div>
            <div className="text-3xl font-black font-mono">{money(net)}</div>
          </div>
        </div>
      </div>
    </SlipPage>
  );
};

// ─── Data processors ──────────────────────────────────────────────────────────

function buildBgsData(emp, bonus, deduction, record) {
  const bd = record.breakdown || {};
  const serviceItems = ['B', 'G', 'S', 'Missed'].flatMap(t => bd[t]?.items || []);
  const totalSplit = ['B', 'G', 'S', 'Missed'].reduce((s, t) => s + (bd[t]?.splitSum || 0), 0);
  const otherSubsidy  = bonus.bgsOtherSubsidy || 0;
  const other         = bonus.other || 0;
  const laborFee      = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
  const healthFee     = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
  const pensionFee    = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
  const otherDeduction = deduction.otherDeduction || 0;
  const net = Math.round(totalSplit + otherSubsidy + other - laborFee - healthFee - pensionFee - otherDeduction);
  return { emp, institutionName: getInstitutionName(emp.organization),
           serviceItems, totalSplit, otherSubsidy, other,
           laborFee, healthFee, pensionFee, otherDeduction, net };
}

function buildAcodeData(emp, bonus, deduction, aCodeResult) {
  const serviceItems  = aCodeResult?.details || [];
  const totalSplit    = aCodeResult?.totalCommission || 0;
  const fuel          = bonus.fuel || 0;
  const otherSubsidy  = bonus.otherSubsidy || 0;
  const other         = bonus.other || 0;
  const bonusItems = [
    { label: '跨區獎金',   value: bonus.bonusCross   || 0 },
    { label: '服務獎金',   value: bonus.bonusOpen    || 0 },
    { label: '開發獎金',   value: bonus.bonusDev     || 0 },
    { label: '丙證獎金',   value: bonus.bonusC       || 0 },
    { label: '介紹費',     value: bonus.referral     || 0 },
    { label: '帶新人津貼', value: bonus.mentoring    || 0 },
    { label: '節日獎金',   value: bonus.holidayBonus || 0 },
  ].filter(b => b.value > 0);
  const withholdingTax  = deduction.withholdingTax || 0;
  const otherDeduction  = deduction.otherDeduction || 0;
  const allSubsidy = fuel + otherSubsidy + other + bonusItems.reduce((s, b) => s + b.value, 0);
  const net = Math.round(totalSplit + allSubsidy - withholdingTax - otherDeduction);
  return { emp, institutionName: getInstitutionName(emp.organization),
           serviceItems, totalSplit, fuel, otherSubsidy, other, bonusItems,
           withholdingTax, otherDeduction, net };
}

function buildSummaryData(emp, bonus, deduction, record, aCodeResult) {
  const bd         = record.breakdown || {};
  const splitB     = bd['B']?.splitSum   || record.b      || 0;
  const splitG     = bd['G']?.splitSum   || record.g      || 0;
  const splitS     = bd['S']?.splitSum   || record.s      || 0;
  const splitMissed = bd['Missed']?.splitSum || record.missed || 0;
  const bgsServiceIncome = splitB + splitG + splitS + splitMissed;
  const bgsOtherSubsidy  = bonus.bgsOtherSubsidy || 0;
  const splitA           = aCodeResult?.totalCommission || 0;
  const crossArea        = bonus.bonusCross   || 0;
  const serviceBonus     = bonus.bonusOpen    || 0;
  const quotaDev         = bonus.bonusDev     || 0;
  const certBonus        = bonus.bonusC       || 0;
  const referral         = bonus.referral     || 0;
  const mentoring        = bonus.mentoring    || 0;
  const holidayBonus     = bonus.holidayBonus || 0;
  const acodeOtherSubsidy = bonus.otherSubsidy || 0;
  const other            = bonus.other        || 0;
  const fuel             = bonus.fuel         || 0;
  const laborFee         = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
  const healthFee        = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
  const pensionFee       = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
  const withholdingTax   = deduction.withholdingTax  || 0;
  const otherDeduction   = deduction.otherDeduction  || 0;
  const totalIncome = bgsServiceIncome + bgsOtherSubsidy + splitA
                    + crossArea + serviceBonus + quotaDev + certBonus
                    + referral + mentoring + holidayBonus + acodeOtherSubsidy + other + fuel;
  const totalDeduction = laborFee + healthFee + pensionFee + withholdingTax + otherDeduction;
  const net = Math.round(totalIncome - totalDeduction);
  return { emp, institutionName: getInstitutionName(emp.organization),
           splitB, splitG, splitS, splitMissed, bgsServiceIncome, bgsOtherSubsidy,
           laborFee, healthFee, pensionFee,
           splitA, crossArea, serviceBonus, quotaDev, certBonus, referral, mentoring, holidayBonus,
           acodeOtherSubsidy, other, fuel, withholdingTax, otherDeduction,
           totalIncome, totalDeduction, net };
}

// ─── Template dispatcher ──────────────────────────────────────────────────────
const SLIP_TYPES = [
  { key: 'bgs',     label: 'BGS碼薪資' },
  { key: 'acode',   label: 'A碼及獎金薪資' },
  { key: 'summary', label: '薪資總表' },
];

const SlipRenderer = ({ slipType, data, isBulk }) => {
  if (!data) return null;
  if (slipType === 'bgs')     return <BgsTemplate     data={data} isBulk={isBulk} />;
  if (slipType === 'acode')   return <AcodeTemplate   data={data} isBulk={isBulk} />;
  if (slipType === 'summary') return <SummaryTemplate data={data} isBulk={isBulk} />;
  return null;
};

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
const SalarySlipDownload = () => {
  const { currentInstitution } = useInstitution();
  const [slipType,     setSlipType]     = useState('bgs');
  const [employees,    setEmployees]    = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [singleData,   setSingleData]   = useState(null);
  const [allData,      setAllData]      = useState(null);
  const [isBulkMode,   setIsBulkMode]   = useState(false);

  const employeesRef    = useRef([]);
  const bonusesRef      = useRef([]);
  const deductionsRef   = useRef([]);
  const recordsRef      = useRef([]);
  const acodeResultsRef = useRef(null);

  const loadAllData = async () => {
    const [emps, bonuses, deductions, records, acodeData] = await Promise.all([
      getEmployees(), getBonuses(), getDeductions(), getRecords(), getAcodeResults(),
    ]);
    setEmployees(emps);
    employeesRef.current    = emps;
    bonusesRef.current      = bonuses;
    deductionsRef.current   = deductions;
    recordsRef.current      = records;
    acodeResultsRef.current = acodeData;
  };

  useEffect(() => { loadAllData(); }, [currentInstitution]);

  const buildSlipData = (empId, type) => {
    const emp       = employeesRef.current.find(e => e.empId === empId);
    if (!emp) return null;
    const bonus     = bonusesRef.current.find(b => b.empId === empId) || {};
    const deduction = deductionsRef.current.find(d => d.empId === empId) || {};
    const record    = recordsRef.current.find(r => r.empId === empId) || {};
    const summary   = acodeResultsRef.current?.finalSummary ?? [];
    const aCodeResult = summary.find(r => r.id === empId || r.name === emp.name) || null;

    if (type === 'bgs')     return buildBgsData(emp, bonus, deduction, record);
    if (type === 'acode')   return buildAcodeData(emp, bonus, deduction, aCodeResult);
    if (type === 'summary') return buildSummaryData(emp, bonus, deduction, record, aCodeResult);
    return null;
  };

  // Rebuild preview when employee or type changes
  useEffect(() => {
    if (selectedEmpId) {
      setIsBulkMode(false);
      setSingleData(buildSlipData(selectedEmpId, slipType));
    } else {
      setSingleData(null);
    }
  }, [selectedEmpId, slipType]);

  // Period subscription
  useEffect(() => {
    const unsub = subscribePeriod(async () => {
      await loadAllData();
      if (selectedEmpId) setSingleData(buildSlipData(selectedEmpId, slipType));
      if (isBulkMode)    setAllData(employeesRef.current.map(e => buildSlipData(e.empId, slipType)).filter(Boolean));
    });
    return unsub;
  }, [selectedEmpId, slipType, isBulkMode]);

  // Bulk mode
  useEffect(() => {
    if (isBulkMode) {
      setSelectedEmpId(null);
      setAllData(employeesRef.current.map(e => buildSlipData(e.empId, slipType)).filter(Boolean));
    }
  }, [isBulkMode, slipType]);

  const handlePrint = () => {
    const orig = document.title;
    if (!isBulkMode && singleData) {
      document.title = `${singleData.emp.empId}_${singleData.emp.name}_${SLIP_TYPES.find(t => t.key === slipType)?.label}`;
    } else {
      document.title = `${SLIP_TYPES.find(t => t.key === slipType)?.label}_${getPeriod()}`;
    }
    window.print();
    setTimeout(() => { document.title = orig; }, 500);
  };

  const hasData = singleData || (isBulkMode && allData?.length > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <style>{PRINT_STYLE}</style>

      {/* Controls – hidden on print */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>薪資表下載</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>選擇薪資類型後預覽並列印</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap justify-end">
            <button
              onClick={() => { setIsBulkMode(b => !b); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all border cursor-pointer ${isBulkMode ? 'bg-amber-500 border-amber-500 text-black' : 'hover:bg-white/10 glass-panel'}`}
              style={isBulkMode ? {} : { borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
            >
              <FileText size={14} />
              <span>{isBulkMode ? '切換回單人檢視' : '一鍵全部列印'}</span>
            </button>

            {!isBulkMode && (
              <select
                value={selectedEmpId || ''}
                onChange={e => setSelectedEmpId(e.target.value || null)}
                className="border px-3 py-2 outline-none appearance-none cursor-pointer glass-panel text-sm"
                style={{ background: 'var(--glass-bg)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', color: 'var(--text-primary)' }}
                onFocus={e => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                onBlur={e => e.target.style.boxShadow = 'none'}
              >
                <option value="" style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}>選擇員工…</option>
                {employees.map(e => (
                  <option key={e.id} value={e.empId} style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}>
                    {e.empId} – {e.name}
                  </option>
                ))}
              </select>
            )}

            {hasData && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--btn-primary-bg)'}
              >
                <Printer size={14} />
                <span>{isBulkMode ? `列印全體 (${allData?.length})` : '列印 / 下載 PDF'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Slip type selector */}
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          {SLIP_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSlipType(key)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer"
              style={slipType === key
                ? { background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }
                : { color: 'var(--text-secondary)', background: 'transparent' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Print area */}
      <div id="salary-slip-root">
        {isBulkMode ? (
          allData && allData.length > 0 ? (
            <div>
              {allData.map(d => (
                <SlipRenderer key={d.emp.empId} slipType={slipType} data={d} isBulk />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 print:hidden" style={{ color: 'var(--text-secondary)' }}>
              目前無員工資料可供列印
            </div>
          )
        ) : singleData ? (
          <SlipRenderer slipType={slipType} data={singleData} isBulk={false} />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 rounded-md glass-panel print:hidden"
               style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', border: '1px dashed' }}>
            <FileText size={40} className="mb-3 opacity-40" />
            <p className="font-semibold">選擇薪資類型與員工以預覽薪資表</p>
            <p className="text-xs opacity-50 mt-1">或點擊「一鍵全部列印」批次輸出</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalarySlipDownload;
