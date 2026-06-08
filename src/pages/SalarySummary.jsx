import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Edit2, X, Calculator, Download } from 'lucide-react';
import FilledBellIcon from '../components/ui/filled-bell-icon';
import { getEmployees } from '../data/employeeStore';
import { getBonuses, saveBonus } from '../data/bonusStore';
import { getDeductions, saveDeduction } from '../data/deductionStore';
import { getRecords, getSupportMainBgs } from '../data/recordsStore';
import { getAcodeResults } from '../data/acodeStore';
import { subscribePeriod, getPeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import { getInstitutionName } from '../constants/institutions';
import { lookupWithholdingTax } from '../data/withholdingTaxTable';
import { exportBgsExcel, exportAcodeExcel, exportSummaryExcel, exportSummary2Excel } from '../utils/salary-excel';
import { computeLaborCapAdjustments } from '../utils/laborCap';

const money = (val) => (val && val !== 0) ? `$${val.toLocaleString()}` : '-';
const pct   = (val) => (val && val !== 0) ? `${val}%` : '-';

const BGS_NOTE_KEYS     = ['bgsOtherSubsidyNote', 'bgsOtherNote', 'laborFeeNote', 'healthFeeNote', 'pensionFeeNote', 'bgsOtherDeductionNote'];
const ACODE_NOTE_KEYS   = ['crossAreaNote', 'serviceBonusNote', 'quotaDevNote', 'certBonusNote', 'referralNote', 'mentoringNote', 'holidayBonusNote', 'otherSubsidyNote', 'otherNote', 'fuelNote', 'withholdingTaxNote', 'otherDeductionNote'];
const SUMMARY_NOTE_KEYS = [
  'bgsOtherSubsidyNote', 'bgsOtherNote',
  'crossAreaNote', 'serviceBonusNote', 'quotaDevNote', 'certBonusNote',
  'referralNote', 'mentoringNote', 'holidayBonusNote', 'otherSubsidyNote', 'otherNote', 'fuelNote',
  'laborFeeNote', 'healthFeeNote', 'pensionFeeNote', 'bgsOtherDeductionNote',
  'withholdingTaxNote', 'otherDeductionNote',
];

// ─── Number input field ───────────────────────────────────────────────────────
const ModalField = ({ label, fieldKey, formData, onChange, disabled = false }) => (
  <div className="space-y-2">
    <label className="uppercase tracking-widest pl-1 block"
      style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>
      {label}
    </label>
    <div className="relative">
      <input
        type="number"
        disabled={disabled}
        value={formData[fieldKey] ?? 0}
        onChange={e => onChange(fieldKey, e.target.value)}
        className={`w-full pl-8 pr-4 py-3 outline-none transition-all font-mono font-medium${disabled ? ' cursor-not-allowed' : ''}`}
        style={{
          background: disabled ? 'var(--input-bg-disabled)' : 'var(--input-bg)',
          color: disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
          border: 'var(--input-border)',
          borderRadius: 'var(--input-radius)',
        }}
        onFocus={e => { if (!disabled) e.target.style.boxShadow = 'var(--input-focus-ring)'; }}
        onBlur={e => { e.target.style.boxShadow = 'none'; }}
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-secondary)' }}>$</span>
    </div>
  </div>
);

// ─── Note textarea field (shows current amount for context) ───────────────────
const NoteField = ({ label, amount, fieldKey, formData, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between px-0.5">
      <label className="uppercase tracking-widest text-xs"
        style={{ fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>
        {label}
      </label>
      <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
        {amount && amount !== 0 ? `$${Number(amount).toLocaleString()}` : '-'}
      </span>
    </div>
    <textarea
      rows={2}
      value={formData[fieldKey] ?? ''}
      onChange={e => onChange(fieldKey, e.target.value)}
      placeholder="輸入備註…"
      className="w-full px-3 py-2 text-sm resize-none outline-none transition-all"
      style={{
        background: 'var(--input-bg)',
        color: 'var(--text-primary)',
        border: 'var(--input-border)',
        borderRadius: 'var(--input-radius)',
      }}
      onFocus={e => e.target.style.boxShadow = 'var(--input-focus-ring)'}
      onBlur={e => e.target.style.boxShadow = 'none'}
    />
  </div>
);

// ─── Inline note icon with hover tooltip ──────────────────────────────────────
const NoteTooltip = ({ note }) => {
  if (!note) return null;
  return (
    <span className="relative group/tip inline-flex items-center ml-1 shrink-0">
      <FilledBellIcon size={12} color="var(--text-accent)" strokeWidth={1.5} />
      <span
        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
          opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-[200]
          px-2.5 py-1.5 rounded-md text-xs text-left whitespace-normal break-words max-w-[180px]"
        style={{
          background: 'var(--modal-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        {note}
      </span>
    </span>
  );
};

// ─── Section divider ──────────────────────────────────────────────────────────
const Divider = ({ label }) => (
  <div className="col-span-full flex items-center gap-3 mt-2">
    <div className="h-px flex-1" style={{ background: 'var(--glass-border)' }} />
    <span className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <div className="h-px flex-1" style={{ background: 'var(--glass-border)' }} />
  </div>
);

// ─── Shared modal shell ───────────────────────────────────────────────────────
const ModalShell = ({ title, subtitle, onClose, onSave, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div
      className="relative w-full max-w-2xl border overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
      style={{
        background: 'var(--modal-bg)', borderRadius: 'var(--modal-radius)',
        boxShadow: 'var(--modal-shadow)', borderColor: 'var(--glass-border)',
      }}
    >
      <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-md transition-colors cursor-pointer">
          <X size={20} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
      <div className="p-8 overflow-y-auto custom-scrollbar flex-1">{children}</div>
      <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md text-sm font-medium border transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
        >取消</button>
        <button
          onClick={onSave}
          className="px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-primary-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--btn-primary-bg)'}
        >儲存資料</button>
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const SalarySummary = () => {
  const { currentInstitution } = useInstitution();
  const [subTab, setSubTab]             = useState('bgs');
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef    = useRef(null);
  const bgsScrollRef   = useRef(null);
  const acodeScrollRef = useRef(null);
  const summaryScrollRef = useRef(null);
  const salary2ScrollRef = useRef(null);
  const [bgsItems, setBgsItems]         = useState([]);
  const [aItems, setAItems]             = useState([]);
  const [summaryItems, setSummaryItems] = useState([]);
  const [applying, setApplying]         = useState(false);
  const [exporting, setExporting]       = useState(false);
  const [modal, setModal]               = useState({ open: false, type: null, form: {}, raw: {} });
  const [noteModal, setNoteModal]       = useState({ open: false, type: null, form: {}, raw: {} });
  const [detailModal, setDetailModal]   = useState({ open: false, empId: null, name: null });
  const [salary2Items, setSalary2Items] = useState([]);
  const [rawRecords, setRawRecords]     = useState([]);
  const [rawACodeResults, setRawACodeResults] = useState([]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [employees, bonuses, deductions, records, acodeData, supportBgsData] = await Promise.all([
      getEmployees(), getBonuses(), getDeductions(), getRecords(), getAcodeResults(), getSupportMainBgs(),
    ]);

    const aCodeResults = acodeData?.finalSummary ?? [];
    const supportMainBgsMap = Object.fromEntries(
      (supportBgsData || []).map(item => [item.empId, item.mainBgs])
    );
    const laborAdj = computeLaborCapAdjustments(employees, bonuses, records, aCodeResults, supportMainBgsMap);

    const bonusMap      = new Map(bonuses.map(b => [b.empId, b]));
    const deductionMap  = new Map(deductions.map(d => [d.empId, d]));
    const recordMap     = new Map(records.map(r => [r.empId, r]));
    const aCodeByEmpId  = new Map(aCodeResults.map(r => [r.id, r]));
    const aCodeByName   = new Map(aCodeResults.map(r => [r.name, r]));

    // 薪資總表(2) 外帳的加班資料
    let overtimeData = [];
    try {
      const s = localStorage.getItem(`overtime_rows_${currentInstitution}_${getPeriod()}`);
      overtimeData = s ? JSON.parse(s) : [];
    } catch {}
    const otMap = new Map(overtimeData.map(o => [o.name, o]));

    // 四張報表合併為一個 reduce，每位員工只遍歷一次
    const { bgs, aCode, summary, salary2 } = employees.reduce((acc, emp) => {
      // ── 共用查表 ────────────────────────────────────────────────────────
      const bonus       = bonusMap.get(emp.empId) || {};
      const deduction   = deductionMap.get(emp.empId) || {};
      const record      = recordMap.get(emp.empId) || {};
      const aCodeResult = aCodeByEmpId.get(emp.empId) ?? aCodeByName.get(emp.name);
      const ot          = otMap.get(emp.name) || {};
      const { bgsOther1, acodeOther2 } = laborAdj[emp.empId] || { bgsOther1: 0, acodeOther2: 0 };

      // ── 共用收入欄位 ─────────────────────────────────────────────────────
      const splitA      = aCodeResult ? aCodeResult.totalCommission : (bonus.bonusA || 0);
      const rawA        = (aCodeResult?.details || []).reduce((s, d) => s + (d.subtotal || 0), 0);
      const splitB      = record.b || 0;
      const splitG      = record.g || 0;
      const splitS      = record.s || 0;
      const splitMissed = record.missed || 0;
      const rawB        = (record.breakdown?.['B']?.rawSum   || 0) + (record.breakdown?.['B']?.selfPayRaw   || 0);
      const rawG        = (record.breakdown?.['G']?.rawSum   || 0) + (record.breakdown?.['G']?.selfPayRaw   || 0);
      const rawS        = (record.breakdown?.['S']?.rawSum   || 0) + (record.breakdown?.['S']?.selfPayRaw   || 0);
      const rawMissed   = record.breakdown?.['Missed']?.rawSum || 0;

      // ── 共用獎金欄位 ─────────────────────────────────────────────────────
      const crossArea         = bonus.bonusCross      || 0;
      const serviceBonus      = bonus.bonusOpen       || 0;
      const quotaDev          = bonus.bonusDev        || 0;
      const certBonus         = bonus.bonusC          || 0;
      const referral          = bonus.referral        || 0;
      const mentoring         = bonus.mentoring       || 0;
      const holidayBonus      = bonus.holidayBonus    || 0;
      const bgsOtherSubsidy   = bonus.bgsOtherSubsidy || 0;
      const acodeOtherSubsidy = bonus.otherSubsidy    || 0;
      const fuel              = bonus.fuel || 0;

      // ── 共用應扣欄位 ─────────────────────────────────────────────────────
      const laborFee        = deduction.laborFee   ?? emp.laborInsuranceSelfPay     ?? 0;
      const healthFee       = deduction.healthFee  ?? emp.healthInsuranceSelfPay    ?? 0;
      const pensionFee      = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
      const otherDeduction1 = deduction.otherDeduction1 || 0;
      const otherDeduction2 = deduction.otherDeduction2 || 0;
      const dependentsCount = emp.dependentsCount ?? 0;
      const laborBracket    = emp.laborInsuranceBracket || 0;
      const healthBracket   = emp.healthInsuranceBracket || 0;
      const healthDependents = emp.healthDependents ?? 0;
      const pensionRate     = emp.voluntaryPensionRate || 0;

      // ── 共用扣繳稅額（BGS+A 合計基礎，查115年度扣繳稅額表）─────────────
      const taxBase = splitA + splitB + splitG + splitS + splitMissed
                    + crossArea + serviceBonus + quotaDev + certBonus
                    + referral + mentoring + holidayBonus
                    + bgsOtherSubsidy + acodeOtherSubsidy + bgsOther1 + acodeOther2;
      const withholdingTax = lookupWithholdingTax(taxBase, dependentsCount);

      // ── BGS碼薪資 ────────────────────────────────────────────────────────
      const bgsServiceIncome = splitB + splitG + splitS + splitMissed;
      const bgsPayable       = bgsServiceIncome + bgsOtherSubsidy + bgsOther1;
      const bgsTotal         = bgsPayable - laborFee - healthFee - pensionFee - otherDeduction1;
      acc.bgs.push({
        id: emp.id, empId: emp.empId, name: emp.name,
        paymentMethod: emp.paymentMethod || '-',
        rawB, rawG, rawS, rawMissed,
        splitB, splitG, splitS, splitMissed,
        serviceIncome: bgsServiceIncome, otherSubsidy: bgsOtherSubsidy, other1: bgsOther1, other2: acodeOther2, payable: bgsPayable,
        laborBracket, laborFee, healthBracket, healthDependents, healthFee,
        pensionRate, pensionFee, otherDeduction1, otherDeduction2,
        total: bgsTotal, netSalary: Math.round(bgsTotal),
        _bonusId: bonus.id, _deductionId: deduction.id,
        bgsOtherSubsidyNote:   bonus.bgsOtherSubsidyNote      || '',
        bgsOtherNote:          bonus.bgsOtherNote              || '',
        laborFeeNote:          deduction.laborFeeNote          || '',
        healthFeeNote:         deduction.healthFeeNote         || '',
        pensionFeeNote:        deduction.pensionFeeNote        || '',
        bgsOtherDeductionNote: deduction.bgsOtherDeductionNote || '',
      });

      // ── A碼及其他獎金 ─────────────────────────────────────────────────────
      const aPayable = splitA + crossArea + serviceBonus + quotaDev + certBonus
                     + referral + mentoring + holidayBonus + acodeOtherSubsidy + acodeOther2;
      const aTotal   = aPayable - withholdingTax + fuel - otherDeduction2;
      acc.aCode.push({
        id: emp.id, empId: emp.empId, name: emp.name,
        paymentMethod: '領現',
        rawA, splitA, serviceIncome: splitA,
        crossArea, serviceBonus, quotaDev, certBonus,
        referral, mentoring, holidayBonus, otherSubsidy: acodeOtherSubsidy, other1: bgsOther1, other2: acodeOther2,
        payable: aPayable, withholdingTax, fuel, otherDeduction1, otherDeduction2,
        total: aTotal, netSalary: Math.round(aTotal),
        _bonusId: bonus.id, _deductionId: deduction.id,
        crossAreaNote:      bonus.crossAreaNote          || '',
        serviceBonusNote:   bonus.serviceBonusNote       || '',
        quotaDevNote:       bonus.quotaDevNote            || '',
        certBonusNote:      bonus.certBonusNote           || '',
        referralNote:       bonus.referralNote            || '',
        mentoringNote:      bonus.mentoringNote           || '',
        holidayBonusNote:   bonus.holidayBonusNote        || '',
        otherSubsidyNote:   bonus.otherSubsidyNote        || '',
        otherNote:          bonus.otherNote               || '',
        fuelNote:           bonus.fuelNote                || '',
        withholdingTaxNote: deduction.withholdingTaxNote  || '',
        otherDeductionNote: deduction.otherDeductionNote  || '',
      });

      // ── 薪資總表 ──────────────────────────────────────────────────────────
      const summaryServiceIncome = splitA + splitB + splitG + splitS + splitMissed;
      const summaryOtherSubsidy  = bgsOtherSubsidy + acodeOtherSubsidy;
      const summaryOther         = bgsOther1 + acodeOther2;
      const summaryPayable       = summaryServiceIncome + crossArea + serviceBonus + quotaDev + certBonus
                                 + referral + mentoring + holidayBonus + summaryOtherSubsidy + summaryOther;
      const summaryTotal         = summaryPayable - withholdingTax + fuel
                                 - laborFee - healthFee - pensionFee - otherDeduction1 - otherDeduction2;
      acc.summary.push({
        id: emp.id, empId: emp.empId, name: emp.name,
        rawA, rawB, rawG, rawS, rawMissed,
        splitA, splitB, splitG, splitS, splitMissed, serviceIncome: summaryServiceIncome,
        crossArea, serviceBonus, quotaDev, certBonus,
        referral, mentoring, holidayBonus, otherSubsidy: summaryOtherSubsidy,
        other1: bgsOther1, other2: acodeOther2, other: summaryOther, payable: summaryPayable,
        withholdingTax, autoTax: withholdingTax, storedWithholdingTax: deduction.withholdingTax || 0,
        dependentsCount, fuel,
        laborBracket, laborFee, healthBracket, healthDependents, healthFee,
        pensionRate, pensionFee,
        otherDeduction1, otherDeduction2, otherDeduction: otherDeduction1 + otherDeduction2,
        total: summaryTotal, netSalary: Math.round(summaryTotal),
        _bonusId: bonus.id, _deductionId: deduction.id,
        bgsOtherSubsidy, acodeOtherSubsidy,
        bgsOtherSubsidyNote:   bonus.bgsOtherSubsidyNote      || '',
        bgsOtherNote:          bonus.bgsOtherNote              || '',
        crossAreaNote:         bonus.crossAreaNote             || '',
        serviceBonusNote:      bonus.serviceBonusNote          || '',
        quotaDevNote:          bonus.quotaDevNote               || '',
        certBonusNote:         bonus.certBonusNote              || '',
        referralNote:          bonus.referralNote               || '',
        mentoringNote:         bonus.mentoringNote              || '',
        holidayBonusNote:      bonus.holidayBonusNote           || '',
        otherSubsidyNote:      bonus.otherSubsidyNote           || '',
        otherNote:             bonus.otherNote                  || '',
        fuelNote:              bonus.fuelNote                   || '',
        laborFeeNote:          deduction.laborFeeNote           || '',
        healthFeeNote:         deduction.healthFeeNote          || '',
        pensionFeeNote:        deduction.pensionFeeNote         || '',
        bgsOtherDeductionNote: deduction.bgsOtherDeductionNote  || '',
        withholdingTaxNote:    deduction.withholdingTaxNote     || '',
        otherDeductionNote:    deduction.otherDeductionNote     || '',
      });

      // ── 薪資總表(2) 外帳 ──────────────────────────────────────────────────
      const crossAreaOT  = ot.transferFee || 0;
      const h134 = ot.h134 || 0; const h167 = ot.h167 || 0; const h267 = ot.h267 || 0;
      const h1   = ot.h1   || 0; const h2   = ot.h2   || 0;
      const ot134 = Math.round(h134 * 200); const ot167 = Math.round(h167 * 200);
      const ot267 = Math.round(h267 * 200); const ot1   = Math.round(h1   * 200);
      const ot2   = Math.round(h2   * 200);
      const overtimeFee = ot134 + ot167 + ot267 + ot1 + ot2;
      const baseSalary  = splitA + splitB + splitG + splitS + splitMissed
        + bgsOtherSubsidy + bgsOther1 + serviceBonus + quotaDev + certBonus
        + referral + mentoring + holidayBonus + acodeOtherSubsidy + acodeOther2 + fuel
        - overtimeFee;
      const fullPayableOT = splitA + splitB + splitG + splitS + splitMissed + crossAreaOT
        + serviceBonus + quotaDev + certBonus + referral + mentoring + holidayBonus
        + bgsOtherSubsidy + acodeOtherSubsidy + bgsOther1 + acodeOther2;
      const withholdingTaxOT = lookupWithholdingTax(fullPayableOT, dependentsCount);
      const netSalary2 = Math.round(
        baseSalary + crossAreaOT + overtimeFee - withholdingTaxOT - laborFee - healthFee - pensionFee - otherDeduction1 - otherDeduction2
      );
      acc.salary2.push({
        id: emp.id, empId: emp.empId, name: emp.name,
        baseSalary, crossArea: crossAreaOT, overtimeFee,
        ot134, ot167, ot267, ot1, ot2,
        withholdingTax: withholdingTaxOT, laborFee, healthFee, pensionFee,
        otherDeduction: otherDeduction1 + otherDeduction2, netSalary: netSalary2,
      });

      return acc;
    }, { bgs: [], aCode: [], summary: [], salary2: [] });

    setBgsItems(bgs);
    setAItems(aCode);
    setSummaryItems(summary);
    setSalary2Items(salary2);
    setRawRecords(records);
    setRawACodeResults(aCodeResults);
  }, [currentInstitution]);

  useEffect(() => {
    loadData();
    const unsub = subscribePeriod(loadData);
    return unsub;
  }, [loadData]);

  // ── Detail modal ────────────────────────────────────────────────────────────
  const openDetail = (item) => setDetailModal({ open: true, empId: item.empId, name: item.name });

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const openEdit = (type, item) => {
    setModal({ open: true, type, raw: item, form: { ...item } });
  };

  const handleChange = (key, val) => {
    setModal(prev => ({ ...prev, form: { ...prev.form, [key]: parseFloat(val) || 0 } }));
  };

  const handleSave = async () => {
    const { type, raw, form } = modal;
    if (type === 'bgs') {
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bgsOtherSubsidy: form.otherSubsidy,
          bgsOtherSubsidyNote: raw.bgsOtherSubsidyNote, bgsOtherNote: raw.bgsOtherNote,
        }),
        saveDeduction({
          empId: raw.empId,
          laborFee: form.laborFee, healthFee: form.healthFee, pensionFee: form.pensionFee,
          otherDeduction1: form.otherDeduction1, otherDeduction2: raw.otherDeduction2,
          laborFeeNote: raw.laborFeeNote, healthFeeNote: raw.healthFeeNote, pensionFeeNote: raw.pensionFeeNote, bgsOtherDeductionNote: raw.bgsOtherDeductionNote,
        }),
      ]);
    } else if (type === 'acode') {
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bonusCross: form.crossArea, bonusOpen: form.serviceBonus, bonusDev: form.quotaDev,
          bonusC: form.certBonus, referral: form.referral, mentoring: form.mentoring,
          holidayBonus: form.holidayBonus, otherSubsidy: form.otherSubsidy,
          fuel: form.fuel,
          crossAreaNote: raw.crossAreaNote, serviceBonusNote: raw.serviceBonusNote,
          quotaDevNote: raw.quotaDevNote, certBonusNote: raw.certBonusNote,
          referralNote: raw.referralNote, mentoringNote: raw.mentoringNote,
          holidayBonusNote: raw.holidayBonusNote, otherSubsidyNote: raw.otherSubsidyNote,
          otherNote: raw.otherNote, fuelNote: raw.fuelNote,
        }),
        saveDeduction({
          empId: raw.empId,
          withholdingTax: form.withholdingTax,
          otherDeduction1: raw.otherDeduction1, otherDeduction2: form.otherDeduction2,
          withholdingTaxNote: raw.withholdingTaxNote, otherDeductionNote: raw.otherDeductionNote,
        }),
      ]);
    } else {
      // summary
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bonusCross:      form.crossArea,
          bonusOpen:       form.serviceBonus,
          bonusDev:        form.quotaDev,
          bonusC:          form.certBonus,
          referral:        form.referral,
          mentoring:       form.mentoring,
          holidayBonus:    form.holidayBonus,
          bgsOtherSubsidy: form.bgsOtherSubsidy,
          otherSubsidy:    form.acodeOtherSubsidy,
          fuel:            form.fuel,
          bgsOtherSubsidyNote: raw.bgsOtherSubsidyNote, bgsOtherNote:     raw.bgsOtherNote,
          crossAreaNote:       raw.crossAreaNote,        serviceBonusNote: raw.serviceBonusNote,
          quotaDevNote:        raw.quotaDevNote,         certBonusNote:    raw.certBonusNote,
          referralNote:        raw.referralNote,         mentoringNote:    raw.mentoringNote,
          holidayBonusNote:    raw.holidayBonusNote,     otherSubsidyNote: raw.otherSubsidyNote,
          otherNote:           raw.otherNote,            fuelNote:         raw.fuelNote,
        }),
        saveDeduction({
          empId: raw.empId,
          withholdingTax:  form.withholdingTax,
          laborFee:        form.laborFee,
          healthFee:       form.healthFee,
          pensionFee:      form.pensionFee,
          otherDeduction1: form.otherDeduction1,
          otherDeduction2: form.otherDeduction2,
          laborFeeNote:          raw.laborFeeNote,
          healthFeeNote:         raw.healthFeeNote,
          pensionFeeNote:        raw.pensionFeeNote,
          bgsOtherDeductionNote: raw.bgsOtherDeductionNote,
          withholdingTaxNote:    raw.withholdingTaxNote,
          otherDeductionNote:    raw.otherDeductionNote,
        }),
      ]);
    }
    setModal({ open: false, type: null, form: {}, raw: {} });
    loadData();
  };

  // ── Note modal ──────────────────────────────────────────────────────────────
  const openNote = (type, item) => {
    setNoteModal({ open: true, type, raw: item, form: { ...item } });
  };

  const handleNoteChange = (key, val) => {
    setNoteModal(prev => ({ ...prev, form: { ...prev.form, [key]: val } }));
  };

  const handleSaveNote = async () => {
    const { type, raw, form } = noteModal;
    if (type === 'bgs') {
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bgsOtherSubsidy: raw.otherSubsidy,
          bgsOtherSubsidyNote: form.bgsOtherSubsidyNote, bgsOtherNote: form.bgsOtherNote,
        }),
        saveDeduction({
          empId: raw.empId,
          laborFee: raw.laborFee, healthFee: raw.healthFee, pensionFee: raw.pensionFee,
          otherDeduction1: raw.otherDeduction1, otherDeduction2: raw.otherDeduction2,
          laborFeeNote: form.laborFeeNote, healthFeeNote: form.healthFeeNote, pensionFeeNote: form.pensionFeeNote, bgsOtherDeductionNote: form.bgsOtherDeductionNote,
        }),
      ]);
    } else if (type === 'acode') {
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bonusCross: raw.crossArea, bonusOpen: raw.serviceBonus, bonusDev: raw.quotaDev,
          bonusC: raw.certBonus, referral: raw.referral, mentoring: raw.mentoring,
          holidayBonus: raw.holidayBonus, otherSubsidy: raw.otherSubsidy,
          fuel: raw.fuel,
          crossAreaNote: form.crossAreaNote, serviceBonusNote: form.serviceBonusNote,
          quotaDevNote: form.quotaDevNote, certBonusNote: form.certBonusNote,
          referralNote: form.referralNote, mentoringNote: form.mentoringNote,
          holidayBonusNote: form.holidayBonusNote, otherSubsidyNote: form.otherSubsidyNote,
          otherNote: form.otherNote, fuelNote: form.fuelNote,
        }),
        saveDeduction({
          empId: raw.empId,
          withholdingTax: raw.withholdingTax,
          otherDeduction1: raw.otherDeduction1, otherDeduction2: raw.otherDeduction2,
          withholdingTaxNote: form.withholdingTaxNote, otherDeductionNote: form.otherDeductionNote,
        }),
      ]);
    } else {
      // summary
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bonusCross:      raw.crossArea,
          bonusOpen:       raw.serviceBonus,
          bonusDev:        raw.quotaDev,
          bonusC:          raw.certBonus,
          referral:        raw.referral,
          mentoring:       raw.mentoring,
          holidayBonus:    raw.holidayBonus,
          bgsOtherSubsidy: raw.bgsOtherSubsidy,
          otherSubsidy:    raw.acodeOtherSubsidy,
          fuel:            raw.fuel,
          bgsOtherSubsidyNote: form.bgsOtherSubsidyNote, bgsOtherNote:     form.bgsOtherNote,
          crossAreaNote:       form.crossAreaNote,        serviceBonusNote: form.serviceBonusNote,
          quotaDevNote:        form.quotaDevNote,         certBonusNote:    form.certBonusNote,
          referralNote:        form.referralNote,         mentoringNote:    form.mentoringNote,
          holidayBonusNote:    form.holidayBonusNote,     otherSubsidyNote: form.otherSubsidyNote,
          otherNote:           form.otherNote,            fuelNote:         form.fuelNote,
        }),
        saveDeduction({
          empId: raw.empId,
          withholdingTax:  raw.withholdingTax,
          laborFee:        raw.laborFee,
          healthFee:       raw.healthFee,
          pensionFee:      raw.pensionFee,
          otherDeduction1: raw.otherDeduction1,
          otherDeduction2: raw.otherDeduction2,
          laborFeeNote:          form.laborFeeNote,
          healthFeeNote:         form.healthFeeNote,
          pensionFeeNote:        form.pensionFeeNote,
          bgsOtherDeductionNote: form.bgsOtherDeductionNote,
          withholdingTaxNote:    form.withholdingTaxNote,
          otherDeductionNote:    form.otherDeductionNote,
        }),
      ]);
    }
    setNoteModal({ open: false, type: null, form: {}, raw: {} });
    loadData();
  };

  // ── Excel export ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const period = getPeriod();
      if (subTab === 'bgs')      await exportBgsExcel(bgsItems, period);
      if (subTab === 'acode')    await exportAcodeExcel(aItems, period);
      if (subTab === 'summary')  await exportSummaryExcel(summaryItems, period);
      if (subTab === 'summary2') await exportSummary2Excel(salary2Items, period);
    } catch (err) {
      alert(`匯出失敗：${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // ── Batch apply auto-computed withholding tax to deductions store ──────────
  const applyAutoTax = async () => {
    if (summaryItems.length === 0) return;
    setApplying(true);
    try {
      await Promise.all(
        summaryItems.map(item =>
          saveDeduction({
            empId: item.empId,
            withholdingTax: item.autoTax,
            laborFee: item.laborFee,
            healthFee: item.healthFee,
            pensionFee: item.pensionFee,
            otherDeduction1: item.otherDeduction1,
            otherDeduction2: item.otherDeduction2,
            laborFeeNote: item.laborFeeNote,
            healthFeeNote: item.healthFeeNote,
            pensionFeeNote: item.pensionFeeNote,
            bgsOtherDeductionNote: item.bgsOtherDeductionNote,
            withholdingTaxNote: item.withholdingTaxNote,
            otherDeductionNote: item.otherDeductionNote,
          })
        )
      );
      await loadData();
    } finally {
      setApplying(false);
    }
  };

  // ── Shared helpers ──────────────────────────────────────────────────────────
  const tabs = [
    { id: 'bgs',      label: 'BGS碼薪資' },
    { id: 'acode',    label: 'A碼及其他獎金' },
    { id: 'summary',  label: '薪資總表' },
    { id: 'summary2', label: '薪資總表(2)' },
  ];

  const thCls = (right = false) =>
    `px-4 py-3 text-xs font-medium${right ? ' text-right' : ''}`;

  const SumCell = ({ value = 0, bold = false, accent = false }) => (
    <td className="px-4 py-2.5 font-mono text-xs text-right font-semibold"
      style={{ color: accent ? 'var(--text-accent)' : bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
      {value !== 0 ? money(value) : '–'}
    </td>
  );
  const EC = () => <td className="px-4 py-2.5" />;

  const NoteBtn = ({ item, type }) => {
    const keys = type === 'bgs' ? BGS_NOTE_KEYS : type === 'acode' ? ACODE_NOTE_KEYS : SUMMARY_NOTE_KEYS;
    const hasNotes = keys.some(k => item[k]);
    return (
      <td className="px-2 py-3">
        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => openNote(type, item)}
            className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            title="編輯備註"
          >
            <FilledBellIcon
              size={16}
              color={hasNotes ? 'var(--text-accent)' : 'var(--text-secondary)'}
              strokeWidth={1.5}
            />
          </button>
        </div>
      </td>
    );
  };

  const EditBtn = ({ item, type }) => (
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => openEdit(type, item)}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Edit2 size={14} />
        </button>
      </div>
    </td>
  );

  const tabLabel = (type) => type === 'bgs' ? 'BGS碼薪資' : type === 'acode' ? 'A碼及其他獎金' : type === 'summary2' ? '薪資總表(2)' : '薪資總表';

  const q = debouncedSearch.trim().toLowerCase();
  const filteredBgs = useMemo(
    () => !q ? bgsItems : bgsItems.filter(i => i.empId?.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q)),
    [bgsItems, q]
  );
  const filteredA = useMemo(
    () => !q ? aItems : aItems.filter(i => i.empId?.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q)),
    [aItems, q]
  );
  const filteredSummary = useMemo(
    () => !q ? summaryItems : summaryItems.filter(i => i.empId?.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q)),
    [summaryItems, q]
  );
  const filteredSalary2 = useMemo(
    () => !q ? salary2Items : salary2Items.filter(i => i.empId?.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q)),
    [salary2Items, q]
  );

  // ── Footer column totals（預算，避免每次 render 重算 80 次 reduce）──────────
  const sumFields = (arr, fields) =>
    Object.fromEntries(fields.map(f => [f, arr.reduce((s, i) => s + (Number(i[f]) || 0), 0)]));

  const bgsTotals = useMemo(() => sumFields(bgsItems, [
    'rawB','rawG','rawS','rawMissed','splitB','splitG','splitS','splitMissed',
    'serviceIncome','otherSubsidy','other1','payable','laborFee','healthFee',
    'pensionFee','otherDeduction1','total','netSalary',
  ]), [bgsItems]);

  const aTotals = useMemo(() => sumFields(aItems, [
    'rawA','splitA','serviceIncome','crossArea','serviceBonus','quotaDev','certBonus',
    'referral','mentoring','holidayBonus','otherSubsidy','other2','payable',
    'withholdingTax','fuel','otherDeduction2','total','netSalary',
  ]), [aItems]);

  const summaryTotals = useMemo(() => sumFields(summaryItems, [
    'rawA','rawB','rawG','rawS','rawMissed','splitA','splitB','splitG','splitS','splitMissed',
    'serviceIncome','crossArea','serviceBonus','quotaDev','certBonus','referral','mentoring',
    'holidayBonus','otherSubsidy','other1','other2','payable','autoTax','fuel',
    'laborFee','healthFee','pensionFee','otherDeduction1','otherDeduction2','total','netSalary',
  ]), [summaryItems]);

  const salary2Totals = useMemo(() => sumFields(salary2Items, [
    'baseSalary','crossArea','ot134','ot167','ot267','ot1','ot2',
    'withholdingTax','laborFee','healthFee','pensionFee','otherDeduction','netSalary',
  ]), [salary2Items]);
  // ────────────────────────────────────────────────────────────────────────────

  // ── 虛擬捲動（四張表各自獨立 virtualizer）────────────────────────────────────
  const ROW_H = 44; // px — py-3(12) × 2 + text-sm line-height(20)
  const bgsVirtualizer = useVirtualizer({
    count: filteredBgs.length,
    getScrollElement: () => bgsScrollRef.current,
    estimateSize: () => ROW_H, overscan: 10,
  });
  const acodeVirtualizer = useVirtualizer({
    count: filteredA.length,
    getScrollElement: () => acodeScrollRef.current,
    estimateSize: () => ROW_H, overscan: 10,
  });
  const summaryVirtualizer = useVirtualizer({
    count: filteredSummary.length,
    getScrollElement: () => summaryScrollRef.current,
    estimateSize: () => ROW_H, overscan: 10,
  });
  const salary2Virtualizer = useVirtualizer({
    count: filteredSalary2.length,
    getScrollElement: () => salary2ScrollRef.current,
    estimateSize: () => ROW_H, overscan: 10,
  });

  // pre-render virtual item slices & padding
  const bgsVItems = bgsVirtualizer.getVirtualItems();
  const bgsPadTop = bgsVItems.length > 0 ? bgsVItems[0].start : 0;
  const bgsPadBot = bgsVItems.length > 0 ? bgsVirtualizer.getTotalSize() - bgsVItems[bgsVItems.length - 1].end : 0;

  const acodeVItems = acodeVirtualizer.getVirtualItems();
  const acodePadTop = acodeVItems.length > 0 ? acodeVItems[0].start : 0;
  const acodePadBot = acodeVItems.length > 0 ? acodeVirtualizer.getTotalSize() - acodeVItems[acodeVItems.length - 1].end : 0;

  const summaryVItems = summaryVirtualizer.getVirtualItems();
  const summaryPadTop = summaryVItems.length > 0 ? summaryVItems[0].start : 0;
  const summaryPadBot = summaryVItems.length > 0 ? summaryVirtualizer.getTotalSize() - summaryVItems[summaryVItems.length - 1].end : 0;

  const salary2VItems = salary2Virtualizer.getVirtualItems();
  const salary2PadTop = salary2VItems.length > 0 ? salary2VItems[0].start : 0;
  const salary2PadBot = salary2VItems.length > 0 ? salary2Virtualizer.getTotalSize() - salary2VItems[salary2VItems.length - 1].end : 0;
  // ────────────────────────────────────────────────────────────────────────────

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>薪資報表</h2>
          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>{getInstitutionName(currentInstitution)}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}>{getPeriod()}</span>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
          onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = 'var(--glass-border)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Download size={14} />
          {exporting ? '匯出中…' : '匯出 Excel'}
        </button>
      </div>

      {/* Sub-tab selector + search */}
      <div className="flex items-end justify-between border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className="px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px"
              style={{
                color:       subTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderColor: subTab === tab.id ? 'var(--text-accent)'  : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="搜尋員編 / 姓名…"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => setDebouncedSearch(e.target.value), 200);
          }}
          className="mb-1.5 px-3 py-1.5 text-sm outline-none rounded-md"
          style={{
            background: 'var(--input-bg)',
            border: 'var(--input-border)',
            color: 'var(--text-primary)',
            width: '180px',
          }}
          onFocus={e => e.target.style.boxShadow = 'var(--input-focus-ring)'}
          onBlur={e => e.target.style.boxShadow = 'none'}
        />
      </div>

      {/* ── BGS碼薪資 ─────────────────────────────────────────────────────── */}
      {subTab === 'bgs' && (
        <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div ref={bgsScrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  <th className={`${thCls()} sticky left-0 z-20 min-w-[80px]`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)' }}>員編</th>
                  <th className={`${thCls()} sticky left-[80px] z-20`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }}>姓名</th>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>領款方式</th>
                  {['B碼申請金額','G碼申請金額','S碼申請金額','服務未遇','B碼拆帳金額','G碼拆帳金額','S碼拆帳金額','服務未遇拆帳','服務所得總額',
                    '其他補貼','其他(1)','應領金額',
                    '勞保級距','勞保費用','健保級距','健保眷屬人數','健保費用',
                    '勞退自提%','應扣勞退自提','應扣費用(1)','總額','實領金額',
                  ].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>備註</th>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {bgsItems.length === 0 ? (
                  <tr><td colSpan="27" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>尚無數據，請先建立員工名單並上傳計算</td></tr>
                ) : filteredBgs.length === 0 ? (
                  <tr><td colSpan="27" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>無符合「{search}」的結果</td></tr>
                ) : <>
                  {bgsPadTop > 0 && <tr><td colSpan="27" style={{ height: bgsPadTop }} /></tr>}
                  {bgsVItems.map(vRow => {
                    const item = filteredBgs[vRow.index];
                    return (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--glass-bg)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium cursor-pointer hover:underline sticky left-[80px] z-[5]" style={{ color: 'var(--text-accent)', background: 'var(--glass-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }} onClick={() => openDetail(item)}>{item.name}</td>
                    <td className="px-4 py-3 text-sm"                       style={{ color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.rawB)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.rawG)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.rawS)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.rawMissed)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.splitB)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.splitG)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.splitS)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.splitMissed)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.serviceIncome)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">
                        {money(item.otherSubsidy)}<NoteTooltip note={item.bgsOtherSubsidyNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">
                        {money(item.other1)}<NoteTooltip note={item.bgsOtherNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.payable)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{item.laborBracket ? item.laborBracket.toLocaleString() : '–'}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.laborFee)}<NoteTooltip note={item.laborFeeNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{item.healthBracket ? item.healthBracket.toLocaleString() : '–'}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{item.healthDependents}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.healthFee)}<NoteTooltip note={item.healthFeeNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{pct(item.pensionRate)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.pensionFee)}<NoteTooltip note={item.pensionFeeNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.otherDeduction1)}<NoteTooltip note={item.bgsOtherDeductionNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                    <NoteBtn item={item} type="bgs" />
                    <EditBtn item={item} type="bgs" />
                  </tr>
                    );
                  })}
                  {bgsPadBot > 0 && <tr><td colSpan="27" style={{ height: bgsPadBot }} /></tr>}
                </>}
              </tbody>
              {bgsItems.length > 0 && (
                <tfoot className="sticky bottom-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                  <tr className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-2.5 text-xs font-bold sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--table-header-bg)' }}>小計</td>
                    <EC /><EC />
                    <SumCell value={bgsTotals.rawB} />
                    <SumCell value={bgsTotals.rawG} />
                    <SumCell value={bgsTotals.rawS} />
                    <SumCell value={bgsTotals.rawMissed} />
                    <SumCell value={bgsTotals.splitB} />
                    <SumCell value={bgsTotals.splitG} />
                    <SumCell value={bgsTotals.splitS} />
                    <SumCell value={bgsTotals.splitMissed} />
                    <SumCell value={bgsTotals.serviceIncome} bold />
                    <SumCell value={bgsTotals.otherSubsidy} />
                    <SumCell value={bgsTotals.other1} />
                    <SumCell value={bgsTotals.payable} bold />
                    <EC />
                    <SumCell value={bgsTotals.laborFee} />
                    <EC /><EC />
                    <SumCell value={bgsTotals.healthFee} />
                    <EC />
                    <SumCell value={bgsTotals.pensionFee} />
                    <SumCell value={bgsTotals.otherDeduction1} />
                    <SumCell value={bgsTotals.total} bold />
                    <SumCell value={bgsTotals.netSalary} accent />
                    <EC /><EC />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── A碼及其他獎金 ──────────────────────────────────────────────────── */}
      {subTab === 'acode' && (
        <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div ref={acodeScrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  <th className={`${thCls()} sticky left-0 z-20 min-w-[80px]`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)' }}>員編</th>
                  <th className={`${thCls()} sticky left-[80px] z-20`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }}>姓名</th>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>領款方式</th>
                  {['A碼申請金額','A碼拆帳金額','服務所得總額','跨區補助','服務獎金','額度開發','丙證獎金',
                    '介紹費','帶新人津貼','節日獎金','其他補貼','其他(2)',
                    '應領金額','扣繳稅額','油資補貼','應扣費用(2)','總額','實領金額',
                  ].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>備註</th>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {aItems.length === 0 ? (
                  <tr><td colSpan="23" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>尚無數據，請先建立員工名單並上傳計算</td></tr>
                ) : filteredA.length === 0 ? (
                  <tr><td colSpan="23" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>無符合「{search}」的結果</td></tr>
                ) : <>
                  {acodePadTop > 0 && <tr><td colSpan="23" style={{ height: acodePadTop }} /></tr>}
                  {acodeVItems.map(vRow => {
                    const item = filteredA[vRow.index];
                    return (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--glass-bg)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium cursor-pointer hover:underline sticky left-[80px] z-[5]" style={{ color: 'var(--text-accent)', background: 'var(--glass-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }} onClick={() => openDetail(item)}>{item.name}</td>
                    <td className="px-4 py-3 text-sm"                       style={{ color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.rawA)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.splitA)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.serviceIncome)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-blue-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.crossArea)}<NoteTooltip note={item.crossAreaNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-emerald-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.serviceBonus)}<NoteTooltip note={item.serviceBonusNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-emerald-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.quotaDev)}<NoteTooltip note={item.quotaDevNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.certBonus)}<NoteTooltip note={item.certBonusNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-purple-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.referral)}<NoteTooltip note={item.referralNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-purple-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.mentoring)}<NoteTooltip note={item.mentoringNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-yellow-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.holidayBonus)}<NoteTooltip note={item.holidayBonusNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">
                        {money(item.otherSubsidy)}<NoteTooltip note={item.otherSubsidyNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">
                        {money(item.other2)}<NoteTooltip note={item.otherNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.payable)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.withholdingTax)}<NoteTooltip note={item.withholdingTaxNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">
                        {money(item.fuel)}<NoteTooltip note={item.fuelNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.otherDeduction2)}<NoteTooltip note={item.otherDeductionNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                    <NoteBtn item={item} type="acode" />
                    <EditBtn item={item} type="acode" />
                  </tr>
                    );
                  })}
                  {acodePadBot > 0 && <tr><td colSpan="23" style={{ height: acodePadBot }} /></tr>}
                </>}
              </tbody>
              {aItems.length > 0 && (
                <tfoot className="sticky bottom-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                  <tr className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-2.5 text-xs font-bold sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--table-header-bg)' }}>小計</td>
                    <EC /><EC />
                    <SumCell value={aTotals.rawA} />
                    <SumCell value={aTotals.splitA} />
                    <SumCell value={aTotals.serviceIncome} bold />
                    <SumCell value={aTotals.crossArea} />
                    <SumCell value={aTotals.serviceBonus} />
                    <SumCell value={aTotals.quotaDev} />
                    <SumCell value={aTotals.certBonus} />
                    <SumCell value={aTotals.referral} />
                    <SumCell value={aTotals.mentoring} />
                    <SumCell value={aTotals.holidayBonus} />
                    <SumCell value={aTotals.otherSubsidy} />
                    <SumCell value={aTotals.other2} />
                    <SumCell value={aTotals.payable} bold />
                    <SumCell value={aTotals.withholdingTax} />
                    <SumCell value={aTotals.fuel} />
                    <SumCell value={aTotals.otherDeduction2} />
                    <SumCell value={aTotals.total} bold />
                    <SumCell value={aTotals.netSalary} accent />
                    <EC /><EC />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── 薪資總表 ───────────────────────────────────────────────────────── */}
      {subTab === 'summary' && (
        <>
        {/* 自動計算說明列 */}
        <div className="flex items-center justify-between px-1 -mt-2 mb-1">
          <button
            onClick={applyAutoTax}
            disabled={applying || summaryItems.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
            onMouseEnter={e => { if (!applying) e.currentTarget.style.background = 'var(--btn-primary-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--btn-primary-bg)'; }}
          >
            <Calculator size={13} />
            {applying ? '套用中…' : '套用扣繳稅額至A碼'}
          </button>
        </div>
        <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div ref={summaryScrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  <th className={`${thCls()} sticky left-0 z-20 min-w-[80px]`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)' }}>員編</th>
                  <th className={`${thCls()} sticky left-[80px] z-20`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }}>姓名</th>
                  {['A碼申請金額','B碼申請金額','G碼申請金額','S碼申請金額','服務未遇',
                    'A碼拆帳金額','B碼拆帳金額','G碼拆帳金額','S碼拆帳金額','服務未遇拆帳','服務所得總額',
                    '跨區補助','服務獎金','額度開發','丙證獎金','介紹費','帶新人津貼','節日獎金',
                    '其他補貼','其他(1)','其他(2)','應領金額',
                    '扣繳稅額','扶養親屬人數','油資補貼',
                    '勞保級距','勞保費用','健保級距','健保眷屬人數','健保費用',
                    '勞退自提%','應扣勞退自提','應扣費用(1)','應扣費用(2)','總額','實領金額',
                  ].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>備註</th>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {summaryItems.length === 0 ? (
                  <tr><td colSpan="40" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>尚無數據，請先建立員工名單並上傳計算</td></tr>
                ) : filteredSummary.length === 0 ? (
                  <tr><td colSpan="40" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>無符合「{search}」的結果</td></tr>
                ) : <>
                  {summaryPadTop > 0 && <tr><td colSpan="40" style={{ height: summaryPadTop }} /></tr>}
                  {summaryVItems.map(vRow => {
                    const item = filteredSummary[vRow.index];
                    return (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--glass-bg)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium cursor-pointer hover:underline sticky left-[80px] z-[5]" style={{ color: 'var(--text-accent)', background: 'var(--glass-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }} onClick={() => openDetail(item)}>{item.name}</td>
                    {/* 申請金額 */}
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.rawA)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.rawB)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.rawG)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.rawS)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.rawMissed)}</td>
                    {/* A/B/G/S 拆帳 + 未遇 */}
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.splitA)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.splitB)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.splitG)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.splitS)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.splitMissed)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.serviceIncome)}</td>
                    {/* 獎金 */}
                    <td className="px-4 py-3 font-mono text-sm text-right text-blue-400">
                      <span className="inline-flex items-center justify-end">{money(item.crossArea)}<NoteTooltip note={item.crossAreaNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-emerald-400">
                      <span className="inline-flex items-center justify-end">{money(item.serviceBonus)}<NoteTooltip note={item.serviceBonusNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-emerald-400">
                      <span className="inline-flex items-center justify-end">{money(item.quotaDev)}<NoteTooltip note={item.quotaDevNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">
                      <span className="inline-flex items-center justify-end">{money(item.certBonus)}<NoteTooltip note={item.certBonusNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-purple-400">
                      <span className="inline-flex items-center justify-end">{money(item.referral)}<NoteTooltip note={item.referralNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-purple-400">
                      <span className="inline-flex items-center justify-end">{money(item.mentoring)}<NoteTooltip note={item.mentoringNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-yellow-400">
                      <span className="inline-flex items-center justify-end">{money(item.holidayBonus)}<NoteTooltip note={item.holidayBonusNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">{money(item.otherSubsidy)}<NoteTooltip note={item.otherSubsidyNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">{money(item.other1)}<NoteTooltip note={item.bgsOtherNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">{money(item.other2)}<NoteTooltip note={item.otherNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.payable)}</td>
                    {/* 扣項 */}
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end gap-1">
                        {money(item.autoTax)}
                        <NoteTooltip note={item.withholdingTaxNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.dependentsCount}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">{money(item.fuel)}<NoteTooltip note={item.fuelNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.laborBracket ? item.laborBracket.toLocaleString() : '–'}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.laborFee)}<NoteTooltip note={item.laborFeeNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.healthBracket ? item.healthBracket.toLocaleString() : '–'}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.healthDependents}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.healthFee)}<NoteTooltip note={item.healthFeeNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{pct(item.pensionRate)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.pensionFee)}<NoteTooltip note={item.pensionFeeNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.otherDeduction1)}<NoteTooltip note={item.bgsOtherDeductionNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.otherDeduction2)}<NoteTooltip note={item.otherDeductionNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                    <NoteBtn item={item} type="summary" />
                    <EditBtn item={item} type="summary" />
                  </tr>
                    );
                  })}
                  {summaryPadBot > 0 && <tr><td colSpan="40" style={{ height: summaryPadBot }} /></tr>}
                </>}
              </tbody>
              {summaryItems.length > 0 && (
                <tfoot className="sticky bottom-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                  <tr className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-2.5 text-xs font-bold sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--table-header-bg)' }}>小計</td>
                    <EC />
                    <SumCell value={summaryTotals.rawA} />
                    <SumCell value={summaryTotals.rawB} />
                    <SumCell value={summaryTotals.rawG} />
                    <SumCell value={summaryTotals.rawS} />
                    <SumCell value={summaryTotals.rawMissed} />
                    <SumCell value={summaryTotals.splitA} />
                    <SumCell value={summaryTotals.splitB} />
                    <SumCell value={summaryTotals.splitG} />
                    <SumCell value={summaryTotals.splitS} />
                    <SumCell value={summaryTotals.splitMissed} />
                    <SumCell value={summaryTotals.serviceIncome} bold />
                    <SumCell value={summaryTotals.crossArea} />
                    <SumCell value={summaryTotals.serviceBonus} />
                    <SumCell value={summaryTotals.quotaDev} />
                    <SumCell value={summaryTotals.certBonus} />
                    <SumCell value={summaryTotals.referral} />
                    <SumCell value={summaryTotals.mentoring} />
                    <SumCell value={summaryTotals.holidayBonus} />
                    <SumCell value={summaryTotals.otherSubsidy} />
                    <SumCell value={summaryTotals.other1} />
                    <SumCell value={summaryTotals.other2} />
                    <SumCell value={summaryTotals.payable} bold />
                    <SumCell value={summaryTotals.autoTax} />
                    <EC />
                    <SumCell value={summaryTotals.fuel} />
                    <EC />
                    <SumCell value={summaryTotals.laborFee} />
                    <EC /><EC />
                    <SumCell value={summaryTotals.healthFee} />
                    <EC />
                    <SumCell value={summaryTotals.pensionFee} />
                    <SumCell value={summaryTotals.otherDeduction1} />
                    <SumCell value={summaryTotals.otherDeduction2} />
                    <SumCell value={summaryTotals.total} bold />
                    <SumCell value={summaryTotals.netSalary} accent />
                    <EC /><EC />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        </>
      )}

      {/* ── 薪資總表(2) 外帳 ──────────────────────────────────────────────── */}
      {subTab === 'summary2' && (
        <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div ref={salary2ScrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  {/* 人員基本資料 */}
                  <th className={`${thCls()} sticky left-0 z-20 min-w-[80px]`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)' }}>員編</th>
                  <th className={`${thCls()} sticky left-[80px] z-20`} style={{ color: 'var(--table-header-text)', background: 'var(--table-header-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }}>姓名</th>
                  {/* 應領費用明細 */}
                  {['本薪','轉場費','加班費(x1.34)','加班費(x1.67)','加班費(x2.67)','加班費(x1)','加班費(x2)'].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  {/* 應扣費用明細 */}
                  {['扣繳稅額','勞保費','健保費','自繳勞退金','應扣費用'].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  <th className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>實領金額</th>
                </tr>
              </thead>
              <tbody>
                {salary2Items.length === 0 ? (
                  <tr><td colSpan="15" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>尚無數據，請先建立員工名單並上傳計算</td></tr>
                ) : filteredSalary2.length === 0 ? (
                  <tr><td colSpan="15" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>無符合「{search}」的結果</td></tr>
                ) : <>
                  {salary2PadTop > 0 && <tr><td colSpan="15" style={{ height: salary2PadTop }} /></tr>}
                  {salary2VItems.map(vRow => {
                    const item = filteredSalary2[vRow.index];
                    return (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--glass-bg)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium sticky left-[80px] z-[5]" style={{ color: 'var(--text-primary)', background: 'var(--glass-bg)', boxShadow: '2px 0 6px -2px rgba(0,0,0,0.2)' }}>{item.name}</td>
                    {/* 應領 */}
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.baseSalary)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.crossArea)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">{money(item.ot134)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">{money(item.ot167)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">{money(item.ot267)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">{money(item.ot1)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">{money(item.ot2)}</td>
                    {/* 應扣 */}
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.withholdingTax)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.laborFee)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.healthFee)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.pensionFee)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.otherDeduction)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                  </tr>
                    );
                  })}
                  {salary2PadBot > 0 && <tr><td colSpan="15" style={{ height: salary2PadBot }} /></tr>}
                </>}
              </tbody>
              {salary2Items.length > 0 && (
                <tfoot className="sticky bottom-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                  <tr className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-2.5 text-xs font-bold sticky left-0 z-[5] min-w-[80px]" style={{ color: 'var(--text-primary)', background: 'var(--table-header-bg)' }}>小計</td>
                    <EC />
                    <SumCell value={salary2Totals.baseSalary} bold />
                    <SumCell value={salary2Totals.crossArea} />
                    <SumCell value={salary2Totals.ot134} />
                    <SumCell value={salary2Totals.ot167} />
                    <SumCell value={salary2Totals.ot267} />
                    <SumCell value={salary2Totals.ot1} />
                    <SumCell value={salary2Totals.ot2} />
                    <SumCell value={salary2Totals.withholdingTax} />
                    <SumCell value={salary2Totals.laborFee} />
                    <SumCell value={salary2Totals.healthFee} />
                    <SumCell value={salary2Totals.pensionFee} />
                    <SumCell value={salary2Totals.otherDeduction} />
                    <SumCell value={salary2Totals.netSalary} accent />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {modal.open && (
        <ModalShell
          title={`編輯資料 — ${tabLabel(modal.type)}`}
          subtitle={`${modal.raw.empId} ${modal.raw.name}`}
          onClose={() => setModal(m => ({ ...m, open: false }))}
          onSave={handleSave}
        >
          {modal.type === 'bgs' ? (
            <div className="grid grid-cols-2 gap-6">
              <Divider label="額外項目" />
              <ModalField label="其他補貼"    fieldKey="otherSubsidy"    formData={modal.form} onChange={handleChange} />
              <ModalField label="其他(1) [自動計算]" fieldKey="other1" formData={modal.form} onChange={handleChange} disabled={true} />
              <Divider label="應扣項目" />
              <ModalField label="勞保費用"    fieldKey="laborFee"        formData={modal.form} onChange={handleChange} />
              <ModalField label="健保費用"    fieldKey="healthFee"       formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣勞退自提" fieldKey="pensionFee"      formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣費用(1)" fieldKey="otherDeduction1" formData={modal.form} onChange={handleChange} />
            </div>
          ) : modal.type === 'acode' ? (
            <div className="grid grid-cols-2 gap-6">
              <Divider label="獎金項目" />
              <ModalField label="跨區補助"   fieldKey="crossArea"      formData={modal.form} onChange={handleChange} />
              <ModalField label="服務獎金"   fieldKey="serviceBonus"   formData={modal.form} onChange={handleChange} />
              <ModalField label="額度開發"   fieldKey="quotaDev"       formData={modal.form} onChange={handleChange} />
              <ModalField label="丙證獎金"   fieldKey="certBonus"      formData={modal.form} onChange={handleChange} />
              <ModalField label="介紹費"     fieldKey="referral"       formData={modal.form} onChange={handleChange} />
              <ModalField label="帶新人津貼"  fieldKey="mentoring"       formData={modal.form} onChange={handleChange} />
              <ModalField label="節日獎金"   fieldKey="holidayBonus"    formData={modal.form} onChange={handleChange} />
              <ModalField label="其他補貼"   fieldKey="otherSubsidy"    formData={modal.form} onChange={handleChange} />
              <ModalField label="其他(2) [自動計算]" fieldKey="other2" formData={modal.form} onChange={handleChange} disabled={true} />
              <Divider label="應扣 / 補貼項目" />
              <ModalField label="扣繳稅額"   fieldKey="withholdingTax"  formData={modal.form} onChange={handleChange} />
              <ModalField label="油資補貼"   fieldKey="fuel"            formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣費用(2)" fieldKey="otherDeduction2" formData={modal.form} onChange={handleChange} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <Divider label="獎金項目" />
              <ModalField label="跨區補助"        fieldKey="crossArea"         formData={modal.form} onChange={handleChange} />
              <ModalField label="服務獎金"        fieldKey="serviceBonus"      formData={modal.form} onChange={handleChange} />
              <ModalField label="額度開發"        fieldKey="quotaDev"          formData={modal.form} onChange={handleChange} />
              <ModalField label="丙證獎金"        fieldKey="certBonus"         formData={modal.form} onChange={handleChange} />
              <ModalField label="介紹費"          fieldKey="referral"          formData={modal.form} onChange={handleChange} />
              <ModalField label="帶新人津貼"       fieldKey="mentoring"         formData={modal.form} onChange={handleChange} />
              <ModalField label="節日獎金"        fieldKey="holidayBonus"      formData={modal.form} onChange={handleChange} />
              <ModalField label="其他補貼(BGS)"   fieldKey="bgsOtherSubsidy"   formData={modal.form} onChange={handleChange} />
              <ModalField label="其他補貼(A碼)"   fieldKey="acodeOtherSubsidy" formData={modal.form} onChange={handleChange} />
              <ModalField label="其他(1) [自動計算]" fieldKey="other1" formData={modal.form} onChange={handleChange} disabled={true} />
              <ModalField label="其他(2) [自動計算]" fieldKey="other2" formData={modal.form} onChange={handleChange} disabled={true} />
              <Divider label="應扣 / 補貼項目" />
              <ModalField label="扣繳稅額"        fieldKey="withholdingTax"    formData={modal.form} onChange={handleChange} />
              <ModalField label="油資補貼"        fieldKey="fuel"              formData={modal.form} onChange={handleChange} />
              <ModalField label="勞保費用"        fieldKey="laborFee"          formData={modal.form} onChange={handleChange} />
              <ModalField label="健保費用"        fieldKey="healthFee"         formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣勞退自提"     fieldKey="pensionFee"        formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣費用(1)"     fieldKey="otherDeduction1"   formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣費用(2)"     fieldKey="otherDeduction2"   formData={modal.form} onChange={handleChange} />
            </div>
          )}
        </ModalShell>
      )}

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      {detailModal.open && (() => {
        const record      = rawRecords.find(r => r.empId === detailModal.empId) || {};
        const aCodeResult = rawACodeResults.find(r => r.name === detailModal.name);
        const bd          = record.breakdown || {};
        const fmt = (v) => (v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });

        const TypeSection = ({ type, label, color }) => {
          const items = bd[type]?.items || [];
          if (items.length === 0) return null;
          const hasSelfPay = items.some(i => i.selfPayAmount > 0);
          return (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color }}>{label}</h4>
              <div className="overflow-hidden rounded border" style={{ borderColor: 'var(--glass-border)' }}>
                <table className="w-full text-xs">
                  <thead style={{ background: 'var(--table-header-bg)', color: 'var(--table-header-text)' }}>
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">個案</th>
                      <th className="px-3 py-2 text-left font-medium">代碼</th>
                      <th className="px-3 py-2 text-right font-medium">數量</th>
                      <th className="px-3 py-2 text-right font-medium">補助金額</th>
                      {hasSelfPay && <th className="px-3 py-2 text-right font-medium">自費金額</th>}
                      <th className="px-3 py-2 text-right font-medium">拆帳金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                        <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{it.client}</td>
                        <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{it.code}</td>
                        <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{it.count}</td>
                        <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>${fmt(it.amount)}</td>
                        {hasSelfPay && <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{it.selfPayAmount > 0 ? `$${fmt(it.selfPayAmount)}` : '—'}</td>}
                        <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color }}>${fmt(it.split)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                      <td className="px-3 py-1.5" colSpan={3} style={{ color: 'var(--text-secondary)' }}>合計</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>${fmt(items.reduce((s, i) => s + i.amount, 0))}</td>
                      {hasSelfPay && <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>${fmt(items.reduce((s, i) => s + i.selfPayAmount, 0))}</td>}
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color }}>${fmt(items.reduce((s, i) => s + i.split, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailModal(m => ({ ...m, open: false }))} />
            <div
              className="relative w-full max-w-3xl border overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
              style={{ background: 'var(--modal-bg)', borderRadius: 'var(--modal-radius)', boxShadow: 'var(--modal-shadow)', borderColor: 'var(--glass-border)' }}
            >
              <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>服務明細核對 — {detailModal.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>員編 {detailModal.empId}</p>
                </div>
                <button onClick={() => setDetailModal(m => ({ ...m, open: false }))} className="p-1.5 hover:bg-white/10 rounded-md transition-colors cursor-pointer">
                  <X size={20} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <TypeSection type="B" label="B碼明細" color="var(--color-blue-400, #60a5fa)" />
                <TypeSection type="G" label="G碼明細" color="var(--color-emerald-400, #34d399)" />
                <TypeSection type="S" label="S碼明細" color="var(--color-purple-400, #c084fc)" />
                <TypeSection type="Missed" label="服務未遇明細" color="var(--color-orange-400, #fb923c)" />
                {aCodeResult && aCodeResult.details?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-accent)' }}>A碼明細</h4>
                    <div className="overflow-hidden rounded border" style={{ borderColor: 'var(--glass-border)' }}>
                      <table className="w-full text-xs">
                        <thead style={{ background: 'var(--table-header-bg)', color: 'var(--table-header-text)' }}>
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">個案</th>
                            <th className="px-3 py-2 text-left font-medium">代碼</th>
                            <th className="px-3 py-2 text-right font-medium">數量</th>
                            <th className="px-3 py-2 text-right font-medium">申報金額</th>
                            <th className="px-3 py-2 text-right font-medium">拆帳金額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aCodeResult.details.map((d, i) => (
                            <tr key={i} className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                              <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{d.client}</td>
                              <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{d.code}</td>
                              <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{d.qty?.toFixed ? d.qty.toFixed(1) : d.qty}</td>
                              <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>${fmt(d.subtotal)}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: 'var(--text-accent)' }}>${fmt(d.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t font-semibold" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                            <td className="px-3 py-1.5" colSpan={3} style={{ color: 'var(--text-secondary)' }}>合計</td>
                            <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>${fmt(aCodeResult.details.reduce((s, d) => s + (d.subtotal || 0), 0))}</td>
                            <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-accent)' }}>${fmt(aCodeResult.totalCommission)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
                {!bd['B'] && !bd['G'] && !bd['S'] && !bd['Missed'] && !aCodeResult && (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>無明細資料，請先上傳計算</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Note Modal ─────────────────────────────────────────────────────── */}
      {noteModal.open && (
        <ModalShell
          title={`備註 — ${tabLabel(noteModal.type)}`}
          subtitle={`${noteModal.raw.empId} ${noteModal.raw.name}`}
          onClose={() => setNoteModal(m => ({ ...m, open: false }))}
          onSave={handleSaveNote}
        >
          {noteModal.type === 'bgs' ? (
            <div className="grid grid-cols-2 gap-5">
              <Divider label="額外項目" />
              <NoteField label="其他補貼"    amount={noteModal.raw.otherSubsidy}   fieldKey="bgsOtherSubsidyNote"   formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他(1)"    amount={noteModal.raw.other1}          fieldKey="bgsOtherNote"           formData={noteModal.form} onChange={handleNoteChange} />
              <Divider label="應扣項目" />
              <NoteField label="勞保費用"    amount={noteModal.raw.laborFee}        fieldKey="laborFeeNote"           formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="健保費用"    amount={noteModal.raw.healthFee}       fieldKey="healthFeeNote"          formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣勞退自提" amount={noteModal.raw.pensionFee}     fieldKey="pensionFeeNote"         formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣費用(1)" amount={noteModal.raw.otherDeduction1} fieldKey="bgsOtherDeductionNote"  formData={noteModal.form} onChange={handleNoteChange} />
            </div>
          ) : noteModal.type === 'acode' ? (
            <div className="grid grid-cols-2 gap-5">
              <Divider label="獎金項目" />
              <NoteField label="跨區補助"   amount={noteModal.raw.crossArea}     fieldKey="crossAreaNote"    formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="服務獎金"   amount={noteModal.raw.serviceBonus}  fieldKey="serviceBonusNote" formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="額度開發"   amount={noteModal.raw.quotaDev}      fieldKey="quotaDevNote"     formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="丙證獎金"   amount={noteModal.raw.certBonus}     fieldKey="certBonusNote"    formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="介紹費"     amount={noteModal.raw.referral}      fieldKey="referralNote"     formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="帶新人津貼"  amount={noteModal.raw.mentoring}    fieldKey="mentoringNote"    formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="節日獎金"   amount={noteModal.raw.holidayBonus}  fieldKey="holidayBonusNote" formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他補貼"    amount={noteModal.raw.otherSubsidy}    fieldKey="otherSubsidyNote"   formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他(2)"   amount={noteModal.raw.other2}           fieldKey="otherNote"          formData={noteModal.form} onChange={handleNoteChange} />
              <Divider label="應扣 / 補貼項目" />
              <NoteField label="扣繳稅額"   amount={noteModal.raw.withholdingTax}  fieldKey="withholdingTaxNote"  formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="油資補貼"   amount={noteModal.raw.fuel}            fieldKey="fuelNote"            formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣費用(2)" amount={noteModal.raw.otherDeduction2} fieldKey="otherDeductionNote"  formData={noteModal.form} onChange={handleNoteChange} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <Divider label="獎金項目" />
              <NoteField label="跨區補助"       amount={noteModal.raw.crossArea}       fieldKey="crossAreaNote"       formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="服務獎金"       amount={noteModal.raw.serviceBonus}    fieldKey="serviceBonusNote"    formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="額度開發"       amount={noteModal.raw.quotaDev}        fieldKey="quotaDevNote"        formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="丙證獎金"       amount={noteModal.raw.certBonus}       fieldKey="certBonusNote"       formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="介紹費"         amount={noteModal.raw.referral}        fieldKey="referralNote"        formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="帶新人津貼"      amount={noteModal.raw.mentoring}      fieldKey="mentoringNote"       formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="節日獎金"       amount={noteModal.raw.holidayBonus}    fieldKey="holidayBonusNote"    formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他補貼(BGS)"  amount={noteModal.raw.bgsOtherSubsidy}   fieldKey="bgsOtherSubsidyNote"  formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他補貼(A碼)"  amount={noteModal.raw.acodeOtherSubsidy} fieldKey="otherSubsidyNote"     formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他(1)"        amount={noteModal.raw.other1}            fieldKey="bgsOtherNote"         formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他(2)"        amount={noteModal.raw.other2}            fieldKey="otherNote"            formData={noteModal.form} onChange={handleNoteChange} />
              <Divider label="應扣 / 補貼項目" />
              <NoteField label="扣繳稅額"        amount={noteModal.raw.withholdingTax}  fieldKey="withholdingTaxNote"   formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="油資補貼"        amount={noteModal.raw.fuel}            fieldKey="fuelNote"             formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="勞保費用"        amount={noteModal.raw.laborFee}        fieldKey="laborFeeNote"         formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="健保費用"        amount={noteModal.raw.healthFee}       fieldKey="healthFeeNote"        formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣勞退自提"    amount={noteModal.raw.pensionFee}      fieldKey="pensionFeeNote"       formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣費用(1)"     amount={noteModal.raw.otherDeduction1} fieldKey="bgsOtherDeductionNote" formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣費用(2)"     amount={noteModal.raw.otherDeduction2} fieldKey="otherDeductionNote"   formData={noteModal.form} onChange={handleNoteChange} />
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
};

export default SalarySummary;
