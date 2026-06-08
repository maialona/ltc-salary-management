import React, { useState, useEffect, useRef, useMemo } from 'react';
import PizZip from 'pizzip';
import { getEmployees } from '../data/employeeStore';
import { getBonuses } from '../data/bonusStore';
import { getDeductions } from '../data/deductionStore';
import { getRecords } from '../data/recordsStore';
import { getAcodeResults } from '../data/acodeStore';
import { subscribePeriod, getPeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import { getInstitutionFullName, getInstitutionName, INSTITUTIONS } from '../constants/institutions';
import { computeLaborCapAdjustments } from '../utils/laborCap';
import { lookupWithholdingTax } from '../data/withholdingTaxTable';
import { FileText, Printer, FileDown } from 'lucide-react';

// ─── Receipt (領據) helpers ───────────────────────────────────────────────────

// Convert integer to Traditional Chinese financial numerals (大寫)
function toChineseAmount(n) {
  const digits = ['零','壹','貳','參','肆','伍','陸','柒','捌','玖'];
  const units  = ['','拾','佰','仟','萬','拾萬','佰萬','仟萬','億'];
  if (n === 0) return '零元整';
  const str = String(Math.round(n));
  let result = '';
  let hasZero = false;
  for (let i = 0; i < str.length; i++) {
    const d = parseInt(str[i]);
    const pos = str.length - 1 - i;
    if (d === 0) {
      hasZero = true;
    } else {
      if (hasZero && result) result += '零';
      result += digits[d] + units[pos];
      hasZero = false;
    }
  }
  return result + '元整';
}

async function fillDocxTemplate(templateUrl, replacements) {
  const res = await fetch(templateUrl);
  const buf = await res.arrayBuffer();
  const zip = new PizZip(buf);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('Invalid docx template');
  let xml = xmlFile.asText();

  // Word may split placeholder text across multiple <w:r> runs.
  // Match {key} or ｛key｝ where XML tags may be interspersed between characters,
  // strip those tags to recover the key, then replace the whole matched span.
  const replaceWithXmlSplit = (braceOpen, braceClose) => {
    const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `${esc(braceOpen)}((?:[^${esc(braceOpen)}${esc(braceClose)}<>]|<[^>]+>)*)${esc(braceClose)}`,
      'g'
    );
    xml = xml.replace(pattern, (match, inner) => {
      const key = inner.replace(/<[^>]+>/g, '');
      return replacements[key] !== undefined ? String(replacements[key]) : match;
    });
  };

  replaceWithXmlSplit('{', '}');
  replaceWithXmlSplit('｛', '｝');

  zip.file('word/document.xml', xml);
  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Denomination helpers ─────────────────────────────────────────────────────
const DENOMS = [1000, 500, 100, 50, 10, 5, 1];

function calcDenominations(amount) {
  const result = {};
  let remaining = Math.max(0, Math.round(amount));
  for (const d of DENOMS) {
    result[d] = Math.floor(remaining / d);
    remaining %= d;
  }
  return result;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const money = (n) => (n != null && n !== 0) ? `$${Math.round(n).toLocaleString()}` : '–';
const pct   = (n) => n ? `${n}%` : '–';
const today = () => new Date().toLocaleDateString('zh-TW');

// ─── Print style (injected once) ─────────────────────────────────────────────
const PRINT_STYLE = `
  @media print {
    @page { size: A4; margin: 0; }
    html, body, #root, #salary-slip-root {
      height: auto !important; overflow: visible !important;
      position: static !important; display: block !important;
    }
    body { padding: 8mm 0; margin: 0 !important; }
    main { margin-left: 0 !important; padding: 0 !important; }
    #salary-slip-root { display: flex; flex-direction: column; align-items: center; }
    .slip-page { page-break-after: always; break-after: page; }
    .slip-page:last-child { page-break-after: auto; break-after: auto; }
    .print\\:hidden { display: none !important; }
  }
`;

// ─── Shared print-page wrapper ────────────────────────────────────────────────
const SlipPage = ({ isBulk, breakAfter, children }) => (
  <div className={`bg-white text-black mx-auto max-w-[190mm] min-h-[267mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:min-h-0 print:m-0 rounded-sm${isBulk ? ' slip-page mb-8 print:mb-0' : ''}${breakAfter ? ' print:break-after-page' : ''}`}>
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
const ServiceCards = ({ rows, splitTotal, showRaw = true }) => (
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
        rows.map((row, i) => {
          const isFirstOfClient = i === 0 || rows[i - 1].client !== row.client;
          const span = isFirstOfClient ? rows.slice(i).findIndex((r, j) => j > 0 && r.client !== row.client) : -1;
          const rowSpan = isFirstOfClient ? (span === -1 ? rows.length - i : span) : 0;
          return (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              {isFirstOfClient && (
                <td rowSpan={rowSpan} className="py-1 px-2 font-medium align-top border-r border-gray-100">{row.client}</td>
              )}
              <td className="py-1 px-2 font-mono">
                {row.code}
                {row.unitPrice > 0 && (
                  <span className="ml-1 text-gray-400">${row.unitPrice.toLocaleString()}</span>
                )}
              </td>
              <td className="py-1 px-2 text-right font-mono">{Number(row.count ?? row.qty ?? 0).toFixed(2)}</td>
              {showRaw && <td className="py-1 px-2 text-right font-mono">{money(row.rawAmount ?? row.subtotal ?? row.amount)}</td>}
              <td className="py-1 px-2 text-right font-mono font-semibold">{money(row.splitAmount ?? row.split ?? row.amount)}</td>
            </tr>
          );
        })
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

// ─── Always-visible amount row (shows even when value is 0, with optional note) ─
const AlwaysAmountRow = ({ label, value, note, negative = false, className = '' }) => (
  <div className={`flex justify-between items-start py-0.5 text-[10px] ${className}`}>
    <div>
      <span className="text-gray-700">{label}</span>
      {note && <div className="text-[9px] text-gray-400 mt-0.5 italic">{note}</div>}
    </div>
    <span className={`font-mono font-semibold ${negative ? 'text-red-600' : ''}`}>
      {negative ? `–${money(value).replace('$', '')}` : money(value)}
    </span>
  </div>
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
          splitB, splitG, splitS, splitMissed,
          otherSubsidy, otherSubsidyNote, other1, other1Note,
          laborFee, healthFee, pensionFee, otherDeduction1, net } = data;
  const sp = emp.splits || {};
  const splitRate = sp.b || sp.g || sp.s || sp.missed;
  const splitDesc = splitRate ? `${splitRate}%` : null;

  const totalIncome = totalSplit + (otherSubsidy || 0) + (other1 || 0);
  const totalDed = (laborFee || 0) + (healthFee || 0) + (pensionFee || 0) + (otherDeduction1 || 0);

  // Map calculator items to table row shape
  const rows = serviceItems.map(it => ({
    client: it.client,
    code: it.code,
    unitPrice: it.unitPrice,
    count: it.count,
    rawAmount: (it.amount || 0) + (it.selfPayAmount || 0),
    splitAmount: it.split,
  }));

  return (
    <>
      {/* 第一頁：薪資單 */}
      <SlipPage isBulk={isBulk} breakAfter>
        <div className="p-8 space-y-4">
          <SlipHeader title="BGS碼薪資明細表" period={getPeriod()} emp={emp} institutionName={institutionName} />

          {/* 人員基本資料 */}
          <section>
            <SectionLabel>人員基本資料</SectionLabel>
            <InfoGrid cells={[
              { label: '姓名',     value: emp.name },
              { label: '匯款帳號', value: emp.bankAccount ? `${emp.bankCode || ''} ${emp.bankAccount}`.trim() : null },
              { label: 'BGS碼抽成', value: splitDesc || null },
              { label: '勞保費 (級距)', value: emp.laborInsuranceBracket ? `${emp.laborInsuranceBracket.toLocaleString()}` : null },
              { label: '健保費 (級距)', value: emp.healthInsuranceBracket ? `${emp.healthInsuranceBracket.toLocaleString()}` : null },
              { label: '健保眷屬人數', value: emp.healthDependents != null && emp.healthDependents !== '' ? `${emp.healthDependents}` : null },
              { label: '勞退自提率', value: emp.voluntaryPensionRate ? `${emp.voluntaryPensionRate}%` : null },
            ]} />
          </section>

          {/* 應領費用明細 */}
          <section>
            <SectionLabel>應領費用明細</SectionLabel>
            <div className="bg-gray-50 rounded px-3 py-2">
              <AlwaysAmountRow label="B碼拆帳" value={splitB} />
              <AlwaysAmountRow label="G碼拆帳" value={splitG} />
              <AlwaysAmountRow label="S碼拆帳" value={splitS} />
              <AlwaysAmountRow label="服務未遇" value={splitMissed} />
              <AlwaysAmountRow label="其他補貼" value={otherSubsidy} note={otherSubsidyNote || undefined} />
              <AlwaysAmountRow label="其他(1)" value={other1} note={other1Note || undefined} />
              <SubtotalRow label="應領小計" value={totalIncome} />
            </div>
          </section>

          {/* 應扣費用 */}
          <section>
            <SectionLabel>應扣費用明細</SectionLabel>
            <div className="bg-gray-50 rounded px-3 py-2">
              <AmountRow label="勞保費" value={laborFee} negative />
              <AmountRow label="健保費" value={healthFee} negative />
              <AmountRow label={`勞退自提${emp.voluntaryPensionRate ? ` (${emp.voluntaryPensionRate}%)` : ''}`} value={pensionFee} negative />
              <AmountRow label="應扣費用(1)" value={otherDeduction1} negative />
              <SubtotalRow label="應扣小計" value={totalDed} negative />
            </div>
          </section>

          <NetFooter income={totalIncome} deduction={totalDed} net={net} />
        </div>
      </SlipPage>

      {/* 第二頁：服務項目明細 */}
      <SlipPage isBulk={isBulk}>
        <div className="p-8 space-y-4">
          <SlipHeader title="BGS碼服務項目明細" period={getPeriod()} emp={emp} institutionName={institutionName} />
          <section>
            <SectionLabel>BGS碼服務項目明細</SectionLabel>
            <ServiceCards rows={rows} splitTotal={totalSplit} />
          </section>
        </div>
      </SlipPage>
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// A碼及其他獎金 Template
// ════════════════════════════════════════════════════════════════════════════
const AcodeTemplate = ({ data, isBulk }) => {
  const { emp, institutionName, serviceItems, totalSplit,
          fuel, fuelNote, otherSubsidy, otherSubsidyNote, other2, other2Note, bonusItems,
          withholdingTax, otherDeduction2, net } = data;
  const acodeRate = emp.splits?.aa09;
  const otherAcodeRate = emp.splits?.otherAcode;

  const allSubsidyBonus = (fuel || 0) + (otherSubsidy || 0) + (other2 || 0)
    + bonusItems.reduce((s, b) => s + b.value, 0);
  const totalDed = (withholdingTax || 0) + (otherDeduction2 || 0);
  const totalIncome = totalSplit + allSubsidyBonus;

  // A-code items: details have { client, code, qty, subtotal, amount }
  const rows = serviceItems.map(it => ({
    client: it.client,
    code: it.code,
    count: it.qty,
    rawAmount: it.subtotal,
    splitAmount: it.amount,
  }));

  return (
    <>
      {/* 第一頁：薪資單 */}
      <SlipPage isBulk={isBulk} breakAfter>
        <div className="p-8 space-y-4">
          <SlipHeader title="A碼及其他獎金明細表" period={getPeriod()} emp={emp} institutionName={institutionName} />

          {/* 人員基本資料 */}
          <section>
            <SectionLabel>人員基本資料</SectionLabel>
            <InfoGrid cells={[
              { label: '姓名',       value: emp.name },
              { label: 'AA09抽成',   value: acodeRate ? `${acodeRate}%` : null },
              { label: '其餘A碼抽成', value: otherAcodeRate ? `${otherAcodeRate}%` : null },
            ]} />
          </section>

          {/* 應領費用明細 */}
          <section>
            <SectionLabel>應領費用明細</SectionLabel>
            <div className="bg-gray-50 rounded px-3 py-2">
              <AlwaysAmountRow label="A碼拆帳" value={totalSplit} />
              {bonusItems.map((b, i) => <AlwaysAmountRow key={i} label={b.label} value={b.value} note={b.note || undefined} />)}
              <AlwaysAmountRow label="其他補貼" value={otherSubsidy} note={otherSubsidyNote || undefined} />
              <AlwaysAmountRow label="油資補助" value={fuel} note={fuelNote || undefined} />
              <AlwaysAmountRow label="其他(2)" value={other2} note={other2Note || undefined} />
              <SubtotalRow label="應領小計" value={totalIncome} />
            </div>
          </section>

          {/* 應扣費用（不含勞健保，已在 BGS 薪資中扣除） */}
          <section>
            <SectionLabel>應扣費用明細</SectionLabel>
            <div className="bg-gray-50 rounded px-3 py-2">
              <AmountRow label={`扣繳稅額${emp.dependentsCount != null ? ` (扶養 ${emp.dependentsCount} 人)` : ''}`} value={withholdingTax} negative />
              <AmountRow label="應扣費用(2)" value={otherDeduction2} negative />
              {totalDed > 0 && <SubtotalRow label="應扣小計" value={totalDed} negative />}
            </div>
          </section>

          <NetFooter income={totalIncome} deduction={totalDed} net={net} />
        </div>
      </SlipPage>

      {/* 第二頁：服務項目明細 */}
      <SlipPage isBulk={isBulk}>
        <div className="p-8 space-y-4">
          <SlipHeader title="A碼服務項目明細" period={getPeriod()} emp={emp} institutionName={institutionName} />
          <section>
            <SectionLabel>A碼服務項目明細</SectionLabel>
            <ServiceCards rows={rows} splitTotal={totalSplit} />
          </section>
        </div>
      </SlipPage>
    </>
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
          acodeOtherSubsidy, other1, other2, fuel,
          withholdingTax, otherDeduction1, otherDeduction2,
          totalIncome, totalDeduction, net } = data;

  const sp = emp.splits || {};
  const bgsRate = sp.b || sp.g || sp.s || sp.missed;

  // 本薪 = BGS服務拆帳 + BGS其他補貼 + 其他(1)
  const basePay = bgsServiceIncome + (bgsOtherSubsidy || 0) + (other1 || 0);
  // 獎金 = A碼拆帳 + 各項獎金 + A碼其他補貼 + 其他(2)
  const bonusTotal = (splitA || 0) + (crossArea || 0) + (serviceBonus || 0) + (quotaDev || 0)
                   + (certBonus || 0) + (referral || 0) + (mentoring || 0) + (holidayBonus || 0)
                   + (acodeOtherSubsidy || 0) + (other2 || 0);

  return (
    <SlipPage isBulk={isBulk}>
      <div className="p-8 space-y-4">
        <SlipHeader title="薪資總表" period={getPeriod()} emp={emp} institutionName={institutionName} />

        {/* 人員基本資料 */}
        <section>
          <SectionLabel>人員基本資料</SectionLabel>
          <InfoGrid cells={[
            { label: '姓名',       value: emp.name },
            { label: '匯款帳號',   value: emp.bankAccount ? `${emp.bankCode || ''} ${emp.bankAccount}`.trim() : null },
            { label: 'AA09抽成',   value: emp.splits?.aa09 ? `${emp.splits.aa09}%` : null },
            { label: '其餘A碼抽成', value: emp.splits?.otherAcode ? `${emp.splits.otherAcode}%` : null },
            { label: 'BGS碼抽成',  value: bgsRate ? `${bgsRate}%` : null },
            { label: '勞保費 (級距)', value: emp.laborInsuranceBracket ? emp.laborInsuranceBracket.toLocaleString() : null },
            { label: '健保費 (級距)', value: emp.healthInsuranceBracket ? emp.healthInsuranceBracket.toLocaleString() : null },
            { label: '健保眷屬人數', value: emp.healthDependents != null && emp.healthDependents !== '' ? `${emp.healthDependents}` : null },
            { label: '勞退自提率',  value: emp.voluntaryPensionRate ? `${emp.voluntaryPensionRate}%` : null },
            { label: '扶養親屬人數', value: emp.dependentsCount != null && emp.dependentsCount !== '' ? `${emp.dependentsCount}` : null },
          ]} />
        </section>

        {/* 應領費用明細 */}
        <section>
          <SectionLabel>應領費用明細</SectionLabel>
          <div className="bg-gray-50 rounded px-3 py-2">
            <AlwaysAmountRow label="本薪" value={basePay} />
            <AlwaysAmountRow label="獎金" value={bonusTotal} />
            <AmountRow label="油資補助" value={fuel} />
            <SubtotalRow label="應領小計" value={totalIncome} />
          </div>
        </section>

        {/* 應扣費用明細 */}
        <section>
          <SectionLabel>應扣費用明細</SectionLabel>
          <div className="bg-gray-50 rounded px-3 py-2">
            <AlwaysAmountRow label="勞保費" value={laborFee} negative />
            <AlwaysAmountRow label="健保費" value={healthFee} negative />
            <AlwaysAmountRow label={`自繳勞退金${emp.voluntaryPensionRate ? ` (${emp.voluntaryPensionRate}%)` : ''}`} value={pensionFee} negative />
            <AlwaysAmountRow label={`扣繳稅額${emp.dependentsCount != null && emp.dependentsCount !== '' ? ` (扶養 ${emp.dependentsCount} 人)` : ''}`} value={withholdingTax} negative />
            <AmountRow label="應扣費用" value={(otherDeduction1 || 0) + (otherDeduction2 || 0)} negative />
            <SubtotalRow label="應扣小計" value={totalDeduction} negative />
          </div>
        </section>

        <NetFooter income={totalIncome} deduction={totalDeduction} net={net} />
      </div>
    </SlipPage>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// 薪資總表(2) Template — 外帳
// ════════════════════════════════════════════════════════════════════════════
const Summary2Template = ({ data, isBulk }) => {
  const { emp, institutionName,
          baseSalary, crossArea, ot134, ot167, ot267, ot1, ot2,
          withholdingTax, laborFee, healthFee, pensionFee, otherDeduction,
          totalIncome, totalDeduction, net } = data;

  return (
    <SlipPage isBulk={isBulk}>
      <div className="p-8 space-y-4">
        <SlipHeader title="薪資總表(2)" period={getPeriod()} emp={emp} institutionName={institutionName} />

        {/* 人員基本資料 */}
        <section>
          <SectionLabel>人員基本資料</SectionLabel>
          <InfoGrid cells={[
            { label: '姓名',       value: emp.name },
            { label: '匯款帳號',   value: emp.bankAccount ? `${emp.bankCode || ''} ${emp.bankAccount}`.trim() : null },
            { label: '勞保費 (級距)', value: emp.laborInsuranceBracket ? emp.laborInsuranceBracket.toLocaleString() : null },
            { label: '健保費 (級距)', value: emp.healthInsuranceBracket ? emp.healthInsuranceBracket.toLocaleString() : null },
            { label: '健保眷屬人數', value: emp.healthDependents != null && emp.healthDependents !== '' ? `${emp.healthDependents}` : null },
            { label: '勞退自提率',  value: emp.voluntaryPensionRate ? `${emp.voluntaryPensionRate}%` : null },
            { label: '扶養親屬人數', value: emp.dependentsCount != null && emp.dependentsCount !== '' ? `${emp.dependentsCount}` : null },
          ]} />
        </section>

        {/* 應領費用明細 */}
        <section>
          <SectionLabel>應領費用明細</SectionLabel>
          <div className="bg-gray-50 rounded px-3 py-2">
            <AlwaysAmountRow label="本薪" value={baseSalary} />
            <AmountRow label="轉場費" value={crossArea} />
            <AmountRow label="加班費 (×1.34)" value={ot134} />
            <AmountRow label="加班費 (×1.67)" value={ot167} />
            <AmountRow label="加班費 (×2.67)" value={ot267} />
            <AmountRow label="加班費 (×1)" value={ot1} />
            <AmountRow label="加班費 (×2)" value={ot2} />
            <SubtotalRow label="應領小計" value={totalIncome} />
          </div>
        </section>

        {/* 應扣費用明細 */}
        <section>
          <SectionLabel>應扣費用明細</SectionLabel>
          <div className="bg-gray-50 rounded px-3 py-2">
            <AlwaysAmountRow label={`扣繳稅額${emp.dependentsCount != null && emp.dependentsCount !== '' ? ` (扶養 ${emp.dependentsCount} 人)` : ''}`} value={withholdingTax} negative />
            <AlwaysAmountRow label="勞保費" value={laborFee} negative />
            <AlwaysAmountRow label="健保費" value={healthFee} negative />
            <AlwaysAmountRow label={`自繳勞退金${emp.voluntaryPensionRate ? ` (${emp.voluntaryPensionRate}%)` : ''}`} value={pensionFee} negative />
            <AmountRow label="應扣費用" value={otherDeduction} negative />
            <SubtotalRow label="應扣小計" value={totalDeduction} negative />
          </div>
        </section>

        <NetFooter income={totalIncome} deduction={totalDeduction} net={net} />
      </div>
    </SlipPage>
  );
};

// ─── Data processors ──────────────────────────────────────────────────────────

function buildBgsData(emp, bonus, deduction, record, laborAdj) {
  const bd = record.breakdown || {};
  const splitB      = bd['B']?.splitSum      || 0;
  const splitG      = bd['G']?.splitSum      || 0;
  const splitS      = bd['S']?.splitSum      || 0;
  const splitMissed = bd['Missed']?.splitSum || 0;
  const serviceItems = ['B', 'G', 'S', 'Missed'].flatMap(t => bd[t]?.items || []);
  const totalSplit = splitB + splitG + splitS + splitMissed;
  const otherSubsidy     = bonus.bgsOtherSubsidy    || 0;
  const otherSubsidyNote = bonus.bgsOtherSubsidyNote || '';
  const other1           = laborAdj?.bgsOther1       ?? 0;
  const other1Note       = bonus.bgsOtherNote        || '';
  const laborFee       = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
  const healthFee      = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
  const pensionFee     = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
  const otherDeduction1 = deduction.otherDeduction1 || 0;
  const net = Math.round(totalSplit + otherSubsidy + other1 - laborFee - healthFee - pensionFee - otherDeduction1);
  return { type: 'bgs', emp, institutionName: getInstitutionFullName(emp.organization),
           serviceItems, totalSplit, splitB, splitG, splitS, splitMissed,
           otherSubsidy, otherSubsidyNote, other1, other1Note,
           laborFee, healthFee, pensionFee, otherDeduction1, net };
}

function buildAcodeData(emp, bonus, deduction, aCodeResult, laborAdj) {
  const serviceItems  = aCodeResult?.details || [];
  const totalSplit    = aCodeResult?.totalCommission || 0;
  const fuel          = bonus.fuel || 0;
  const fuelNote      = bonus.fuelNote || '';
  const otherSubsidy  = bonus.otherSubsidy || 0;
  const otherSubsidyNote = bonus.otherSubsidyNote || '';
  const other2        = laborAdj?.acodeOther2 ?? 0;
  const other2Note    = bonus.otherNote || '';
  const bonusItems = [
    { label: '跨區補助',   value: bonus.bonusCross   || 0, note: bonus.crossAreaNote    || '' },
    { label: '服務獎金',   value: bonus.bonusOpen    || 0, note: bonus.serviceBonusNote || '' },
    { label: '開發獎金',   value: bonus.bonusDev     || 0, note: bonus.quotaDevNote     || '' },
    { label: '丙證獎金',   value: bonus.bonusC       || 0, note: bonus.certBonusNote    || '' },
    { label: '介紹費',     value: bonus.referral     || 0, note: bonus.referralNote     || '' },
    { label: '帶新人津貼', value: bonus.mentoring    || 0, note: bonus.mentoringNote    || '' },
    { label: '節日獎金',   value: bonus.holidayBonus || 0, note: bonus.holidayBonusNote || '' },
  ];
  const withholdingTax  = deduction.withholdingTax || 0;
  const otherDeduction2 = deduction.otherDeduction2 || 0;
  const allSubsidy = fuel + otherSubsidy + other2 + bonusItems.reduce((s, b) => s + b.value, 0);
  const net = Math.round(totalSplit + allSubsidy - withholdingTax - otherDeduction2);
  return { type: 'acode', emp, institutionName: getInstitutionFullName(emp.organization),
           serviceItems, totalSplit, fuel, fuelNote, otherSubsidy, otherSubsidyNote, other2, other2Note, bonusItems,
           withholdingTax, otherDeduction2, net };
}

function buildSummaryData(emp, bonus, deduction, record, aCodeResult, laborAdj) {
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
  const other1           = laborAdj?.bgsOther1  ?? 0;
  const other2           = laborAdj?.acodeOther2 ?? 0;
  const fuel             = bonus.fuel         || 0;
  const laborFee         = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
  const healthFee        = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
  const pensionFee       = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
  const withholdingTax   = deduction.withholdingTax   || 0;
  const otherDeduction1  = deduction.otherDeduction1  || 0;
  const otherDeduction2  = deduction.otherDeduction2  || 0;
  const totalIncome = bgsServiceIncome + bgsOtherSubsidy + splitA
                    + crossArea + serviceBonus + quotaDev + certBonus
                    + referral + mentoring + holidayBonus + acodeOtherSubsidy + other1 + other2 + fuel;
  const totalDeduction = laborFee + healthFee + pensionFee + withholdingTax + otherDeduction1 + otherDeduction2;
  const net = Math.round(totalIncome - totalDeduction);
  return { type: 'summary', emp, institutionName: getInstitutionFullName(emp.organization),
           splitB, splitG, splitS, splitMissed, bgsServiceIncome, bgsOtherSubsidy,
           laborFee, healthFee, pensionFee,
           splitA, crossArea, serviceBonus, quotaDev, certBonus, referral, mentoring, holidayBonus,
           acodeOtherSubsidy, other1, other2, fuel, withholdingTax, otherDeduction1, otherDeduction2,
           totalIncome, totalDeduction, net };
}

function buildSummary2Data(emp, bonus, deduction, record, aCodeResult, laborAdj, ot) {
  const bd          = record.breakdown || {};
  const splitA      = aCodeResult?.totalCommission || 0;
  const splitB      = bd['B']?.splitSum      || record.b      || 0;
  const splitG      = bd['G']?.splitSum      || record.g      || 0;
  const splitS      = bd['S']?.splitSum      || record.s      || 0;
  const splitMissed = bd['Missed']?.splitSum || record.missed || 0;
  const bgsOtherSubsidy   = bonus.bgsOtherSubsidy || 0;
  const acodeOtherSubsidy = bonus.otherSubsidy    || 0;
  const other1       = laborAdj?.bgsOther1   ?? 0;
  const other2       = laborAdj?.acodeOther2 ?? 0;
  const serviceBonus = bonus.bonusOpen    || 0;
  const quotaDev     = bonus.bonusDev     || 0;
  const certBonus    = bonus.bonusC       || 0;
  const referral     = bonus.referral     || 0;
  const mentoring    = bonus.mentoring    || 0;
  const holidayBonus = bonus.holidayBonus || 0;
  const fuel         = bonus.fuel         || 0;
  const crossArea    = ot.transferFee || 0;
  const ot134 = Math.round((ot.h134 || 0) * 200);
  const ot167 = Math.round((ot.h167 || 0) * 200);
  const ot267 = Math.round((ot.h267 || 0) * 200);
  const ot1   = Math.round((ot.h1   || 0) * 200);
  const ot2   = Math.round((ot.h2   || 0) * 200);
  const overtimeFee = ot134 + ot167 + ot267 + ot1 + ot2;

  const baseSalary = splitA + splitB + splitG + splitS + splitMissed
    + bgsOtherSubsidy + other1 + serviceBonus + quotaDev + certBonus
    + referral + mentoring + holidayBonus + acodeOtherSubsidy + other2 + fuel
    - overtimeFee;

  const laborFee    = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
  const healthFee   = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
  const pensionFee  = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
  const otherDeduction = (deduction.otherDeduction1 || 0) + (deduction.otherDeduction2 || 0);

  const fullPayable = splitA + splitB + splitG + splitS + splitMissed + crossArea
    + serviceBonus + quotaDev + certBonus + referral + mentoring + holidayBonus
    + bgsOtherSubsidy + acodeOtherSubsidy + other1 + other2;
  const withholdingTax = lookupWithholdingTax(fullPayable, emp.dependentsCount ?? 0);

  const totalIncome    = baseSalary + crossArea + overtimeFee;
  const totalDeduction = withholdingTax + laborFee + healthFee + pensionFee + otherDeduction;
  const net = Math.round(totalIncome - totalDeduction);

  return { type: 'summary2', emp, institutionName: getInstitutionFullName(emp.organization),
           baseSalary, crossArea, ot134, ot167, ot267, ot1, ot2,
           withholdingTax, laborFee, healthFee, pensionFee, otherDeduction,
           totalIncome, totalDeduction, net };
}

// ─── Template dispatcher ──────────────────────────────────────────────────────
const SLIP_TYPES = [
  { key: 'bgs',      label: 'BGS碼薪資' },
  { key: 'acode',    label: 'A碼及其他獎金' },
  { key: 'summary',  label: '薪資總表' },
  { key: 'summary2', label: '薪資總表(2)' },
];

const SlipRenderer = ({ slipType, data, isBulk }) => {
  if (!data || data.type !== slipType) return null;
  if (slipType === 'bgs')      return <BgsTemplate      data={data} isBulk={isBulk} />;
  if (slipType === 'acode')    return <AcodeTemplate     data={data} isBulk={isBulk} />;
  if (slipType === 'summary')  return <SummaryTemplate   data={data} isBulk={isBulk} />;
  if (slipType === 'summary2') return <Summary2Template  data={data} isBulk={isBulk} />;
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
  const [showDenomination, setShowDenomination] = useState(false);
  const [denominationRows, setDenominationRows] = useState([]);
  const [customReceiptOpen, setCustomReceiptOpen] = useState(false);
  const [customReceiptForm, setCustomReceiptForm] = useState({
    type: 'labor', name: '', idNumber: '', institution: 'fucheng', rocYear: '', month: '', salary: '',
  });

  const employeesRef    = useRef([]);
  const acodeResultsRef = useRef(null);
  const laborAdjRef     = useRef({});
  const bonusMapRef     = useRef(new Map());
  const deductionMapRef = useRef(new Map());
  const recordMapRef    = useRef(new Map());
  const empMapRef       = useRef(new Map());
  const aCodeByEmpIdRef = useRef(new Map());
  const aCodeByNameRef  = useRef(new Map());
  const overtimeMapRef  = useRef(new Map());

  const loadAllData = async () => {
    const [emps, bonuses, deductions, records, acodeData] = await Promise.all([
      getEmployees(), getBonuses(), getDeductions(), getRecords(), getAcodeResults(),
    ]);
    const aCodeResults = acodeData?.finalSummary ?? [];
    setEmployees(emps);
    employeesRef.current    = emps;
    acodeResultsRef.current = acodeData;
    laborAdjRef.current     = computeLaborCapAdjustments(emps, bonuses, records, aCodeResults);
    bonusMapRef.current     = new Map(bonuses.map(b => [b.empId, b]));
    deductionMapRef.current = new Map(deductions.map(d => [d.empId, d]));
    recordMapRef.current    = new Map(records.map(r => [r.empId, r]));
    empMapRef.current       = new Map(emps.map(e => [e.empId, e]));
    aCodeByEmpIdRef.current = new Map(aCodeResults.map(r => [r.id, r]));
    aCodeByNameRef.current  = new Map(aCodeResults.map(r => [r.name, r]));
    try {
      const s = localStorage.getItem(`overtime_rows_${currentInstitution}_${getPeriod()}`);
      const overtimeData = s ? JSON.parse(s) : [];
      overtimeMapRef.current = new Map(overtimeData.map(o => [o.name, o]));
    } catch {
      overtimeMapRef.current = new Map();
    }
  };

  useEffect(() => { loadAllData(); }, [currentInstitution]);

  const buildSlipData = (empId, type) => {
    const emp       = empMapRef.current.get(empId);
    if (!emp) return null;
    const bonus     = bonusMapRef.current.get(empId) || {};
    const deduction = deductionMapRef.current.get(empId) || {};
    const record    = recordMapRef.current.get(empId) || {};
    const aCodeResult = aCodeByEmpIdRef.current.get(empId) ?? aCodeByNameRef.current.get(emp.name) ?? null;
    const laborAdj  = laborAdjRef.current[empId] || { bgsOther1: 0, acodeOther2: 0 };
    const ot        = overtimeMapRef.current.get(emp.name) || {};

    if (type === 'bgs')      return buildBgsData(emp, bonus, deduction, record, laborAdj);
    if (type === 'acode')    return buildAcodeData(emp, bonus, deduction, aCodeResult, laborAdj);
    if (type === 'summary')  return buildSummaryData(emp, bonus, deduction, record, aCodeResult, laborAdj);
    if (type === 'summary2') return buildSummary2Data(emp, bonus, deduction, record, aCodeResult, laborAdj, ot);
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

  // ── 面額計算（在 effect 中存取 refs，避免 render 中讀取 refs 的 lint 警告）───
  useEffect(() => {
    const rows = employees
      .filter(e => slipType === 'acode' || e.paymentMethod === '領現')
      .map(emp => {
        const data = buildSlipData(emp.empId, slipType);
        const net = Math.max(0, data?.net ?? 0);
        return { emp, net, denoms: calcDenominations(net) };
      })
      .filter(r => r.net > 0);
    setDenominationRows(rows);
  }, [employees, slipType]); // eslint-disable-line react-hooks/exhaustive-deps

  const denominationTotals = useMemo(() => {
    const totals = { net: 0 };
    DENOMS.forEach(d => { totals[d] = 0; });
    denominationRows.forEach(r => {
      totals.net += r.net;
      DENOMS.forEach(d => { totals[d] += r.denoms[d]; });
    });
    return totals;
  }, [denominationRows]);

  const buildReceiptReplacements = (emp, net) => {
    const [yearStr, monthStr] = getPeriod().split('-');
    const rocYear = String(parseInt(yearStr) - 1911);
    const month = String(parseInt(monthStr));
    const roundedNet = Math.round(net);
    return {
      '姓名': emp.name || '',
      '機構': getInstitutionFullName(emp.organization) || '',
      '民國年': rocYear,
      '月': month,
      '薪資': roundedNet.toLocaleString(),
      '薪資數字大寫': toChineseAmount(roundedNet),
      '身分證字號': emp.idNumber || '',
      '身份證字號': emp.idNumber || '',
    };
  };

  const handleReceiptDownload = async (receiptType) => {
    const isLabor = receiptType === 'labor';
    const templateUrl = isLabor
      ? '/templates/勞務所得(B+G+S).docx'
      : '/templates/預支獎金.docx';
    const receiptLabel = isLabor ? '勞務所得領據' : '預支獎金領據';
    const slipKey = isLabor ? 'bgs' : 'acode';

    if (isBulkMode) {
      for (const emp of employeesRef.current) {
        const data = buildSlipData(emp.empId, slipKey);
        if (!data || data.net <= 0) continue;
        const replacements = buildReceiptReplacements(emp, data.net);
        const blob = await fillDocxTemplate(templateUrl, replacements);
        triggerDownload(blob, `${emp.empId}_${emp.name}_${receiptLabel}.docx`);
        await new Promise(r => setTimeout(r, 200));
      }
    } else if (selectedEmpId) {
      const data = buildSlipData(selectedEmpId, slipKey);
      if (!data) return;
      const emp = empMapRef.current.get(selectedEmpId);
      const replacements = buildReceiptReplacements(emp, data.net);
      const blob = await fillDocxTemplate(templateUrl, replacements);
      triggerDownload(blob, `${emp.empId}_${emp.name}_${receiptLabel}.docx`);
    }
  };

  const openCustomReceipt = () => {
    const [yearStr, monthStr] = getPeriod().split('-');
    setCustomReceiptForm(f => ({
      ...f,
      rocYear: String(parseInt(yearStr) - 1911),
      month: String(parseInt(monthStr)),
    }));
    setCustomReceiptOpen(true);
  };

  const handleCustomReceiptSubmit = async () => {
    const { type, name, idNumber, institution, rocYear, month, salary } = customReceiptForm;
    const net = Math.round(parseFloat(salary) || 0);
    const templateUrl = type === 'labor' ? '/templates/勞務所得(B+G+S).docx' : '/templates/預支獎金.docx';
    const receiptLabel = type === 'labor' ? '勞務所得領據' : '預支獎金領據';
    const replacements = {
      '姓名': name,
      '機構': getInstitutionFullName(institution),
      '民國年': rocYear,
      '月': month,
      '薪資': net.toLocaleString(),
      '薪資數字大寫': toChineseAmount(net),
      '身分證字號': idNumber,
      '身份證字號': idNumber,
    };
    const blob = await fillDocxTemplate(templateUrl, replacements);
    triggerDownload(blob, `${name}_${receiptLabel}.docx`);
    setCustomReceiptOpen(false);
  };

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
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>薪資表下載</h2>
              <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>{getInstitutionName(currentInstitution)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}>{getPeriod()}</span>
            </div>
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

        {/* Receipt download */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>領據產出</div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleReceiptDownload('labor')}
              disabled={!isBulkMode && !selectedEmpId}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10 glass-panel"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
            >
              <FileDown size={14} />
              <span>勞務所得領據</span>
            </button>
            <button
              onClick={() => handleReceiptDownload('acode')}
              disabled={!isBulkMode && !selectedEmpId}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10 glass-panel"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
            >
              <FileDown size={14} />
              <span>預支獎金領據</span>
            </button>
            <button
              onClick={openCustomReceipt}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all border cursor-pointer hover:bg-white/10 glass-panel"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
            >
              <FileDown size={14} />
              <span>自訂領據</span>
            </button>
          </div>
        </div>

        {/* Denomination calculation */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>面額計算</div>
            <button
              onClick={() => setShowDenomination(v => !v)}
              className="text-xs px-3 py-1 rounded border cursor-pointer hover:bg-white/10 glass-panel"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              {showDenomination ? '收合' : '展開'}
            </button>
          </div>
          {showDenomination && (
            denominationRows.length === 0
              ? <div className="text-sm py-3 text-center" style={{ color: 'var(--text-secondary)' }}>目前無領現員工資料</div>
              : <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--glass-border)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--glass-border)' }}>
                        <th className="px-3 py-2 text-left font-bold" style={{ color: 'var(--text-primary)' }}>姓名</th>
                        <th className="px-3 py-2 text-right font-bold" style={{ color: 'var(--text-primary)' }}>實領</th>
                        {DENOMS.map(d => (
                          <th key={d} className="px-2 py-2 text-right font-bold" style={{ color: 'var(--text-primary)' }}>${d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {denominationRows.map(({ emp, net, denoms }) => (
                        <tr key={emp.empId} className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                          <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>{emp.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{net.toLocaleString()}</td>
                          {DENOMS.map(d => (
                            <td key={d} className="px-2 py-1.5 text-right font-mono" style={{ color: denoms[d] === 0 ? 'var(--text-secondary)' : 'var(--text-primary)', opacity: denoms[d] === 0 ? 0.35 : 1 }}>
                              {denoms[d]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2" style={{ borderColor: 'var(--text-secondary)', background: 'var(--glass-bg)' }}>
                        <td className="px-3 py-2 font-black" style={{ color: 'var(--text-primary)' }}>總計</td>
                        <td className="px-3 py-2 text-right font-black font-mono" style={{ color: 'var(--text-primary)' }}>{denominationTotals.net.toLocaleString()}</td>
                        {DENOMS.map(d => (
                          <td key={d} className="px-2 py-2 text-right font-black font-mono" style={{ color: 'var(--text-primary)' }}>{denominationTotals[d]}</td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
          )}
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

      {/* 自訂領據 Modal */}
      {customReceiptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setCustomReceiptOpen(false)}
        >
          <div
            className="glass-panel rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>自訂領據</h3>

            {/* 領據類型 */}
            <div className="flex gap-2">
              {[{ value: 'labor', label: '勞務所得(B+G+S)' }, { value: 'acode', label: '預支獎金' }].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCustomReceiptForm(f => ({ ...f, type: opt.value }))}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-all cursor-pointer border"
                  style={customReceiptForm.type === opt.value
                    ? { background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)', borderColor: 'var(--btn-primary-bg)' }
                    : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 姓名 */}
            <label className="block space-y-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>姓名</span>
              <input
                type="text"
                value={customReceiptForm.name}
                onChange={e => setCustomReceiptForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm outline-none glass-panel"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              />
            </label>

            {/* 身份證字號 */}
            <label className="block space-y-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>身份證字號</span>
              <input
                type="text"
                value={customReceiptForm.idNumber}
                onChange={e => setCustomReceiptForm(f => ({ ...f, idNumber: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm outline-none glass-panel"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              />
            </label>

            {/* 機構 */}
            <label className="block space-y-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>機構</span>
              <select
                value={customReceiptForm.institution}
                onChange={e => setCustomReceiptForm(f => ({ ...f, institution: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm outline-none appearance-none cursor-pointer glass-panel"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              >
                {INSTITUTIONS.map(inst => (
                  <option key={inst.code} value={inst.code} style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </label>

            {/* 民國年 / 月 */}
            <div className="flex gap-3">
              <label className="flex-1 space-y-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>民國年</span>
                <input
                  type="number"
                  value={customReceiptForm.rocYear}
                  onChange={e => setCustomReceiptForm(f => ({ ...f, rocYear: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none glass-panel"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                />
              </label>
              <label className="flex-1 space-y-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>月</span>
                <input
                  type="number"
                  min="1" max="12"
                  value={customReceiptForm.month}
                  onChange={e => setCustomReceiptForm(f => ({ ...f, month: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none glass-panel"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                />
              </label>
            </div>

            {/* 薪資 */}
            <label className="block space-y-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>薪資（元）</span>
              <input
                type="number"
                value={customReceiptForm.salary}
                onChange={e => setCustomReceiptForm(f => ({ ...f, salary: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm outline-none glass-panel"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              />
            </label>

            {/* 薪資數字大寫（唯讀） */}
            {customReceiptForm.salary && (
              <div className="text-xs px-3 py-2 rounded-md" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                大寫：{toChineseAmount(Math.round(parseFloat(customReceiptForm.salary) || 0))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setCustomReceiptOpen(false)}
                className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                取消
              </button>
              <button
                onClick={handleCustomReceiptSubmit}
                disabled={!customReceiptForm.name || !customReceiptForm.salary}
                className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
              >
                產出領據
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipDownload;
