import React, { useState, useEffect } from 'react';
import { Edit2, X, Calculator, Download } from 'lucide-react';
import FilledBellIcon from '../components/ui/filled-bell-icon';
import { getEmployees } from '../data/employeeStore';
import { getBonuses, saveBonus } from '../data/bonusStore';
import { getDeductions, saveDeduction } from '../data/deductionStore';
import { getRecords } from '../data/recordsStore';
import { getAcodeResults } from '../data/acodeStore';
import { subscribePeriod, getPeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import { lookupWithholdingTax } from '../data/withholdingTaxTable';
import { exportBgsExcel, exportAcodeExcel, exportSummaryExcel } from '../utils/salary-excel';

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
  const [bgsItems, setBgsItems]         = useState([]);
  const [aItems, setAItems]             = useState([]);
  const [summaryItems, setSummaryItems] = useState([]);
  const [applying, setApplying]         = useState(false);
  const [exporting, setExporting]       = useState(false);
  const [modal, setModal]               = useState({ open: false, type: null, form: {}, raw: {} });
  const [noteModal, setNoteModal]       = useState({ open: false, type: null, form: {}, raw: {} });

  useEffect(() => {
    loadData();
    const unsub = subscribePeriod(() => loadData());
    return unsub;
  }, [currentInstitution]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = async () => {
    const [employees, bonuses, deductions, records, acodeData] = await Promise.all([
      getEmployees(), getBonuses(), getDeductions(), getRecords(), getAcodeResults(),
    ]);

    const aCodeResults = acodeData?.finalSummary ?? [];

    // BGS碼薪資
    const bgs = employees.map(emp => {
      const bonus     = bonuses.find(b => b.empId === emp.empId) || {};
      const deduction = deductions.find(d => d.empId === emp.empId) || {};
      const record    = records.find(r => r.empId === emp.empId) || {};

      const splitB        = record.b || 0;
      const splitG        = record.g || 0;
      const splitS        = record.s || 0;
      const splitMissed   = record.missed || 0;
      const serviceIncome = splitB + splitG + splitS + splitMissed;
      const otherSubsidy  = bonus.bgsOtherSubsidy || 0;
      const other         = bonus.other || 0;
      const payable       = serviceIncome + otherSubsidy + other;

      const laborFee       = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
      const healthFee      = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
      const pensionFee     = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
      const otherDeduction = deduction.otherDeduction || 0;

      const total     = payable - laborFee - healthFee - pensionFee - otherDeduction;
      const netSalary = Math.round(total);

      return {
        id: emp.id, empId: emp.empId, name: emp.name,
        paymentMethod: emp.paymentMethod || '-',
        splitB, splitG, splitS, splitMissed,
        serviceIncome, otherSubsidy, other, payable,
        laborBracket:    emp.laborInsuranceBracket || 0,
        laborFee,
        healthBracket:   emp.healthInsuranceBracket || 0,
        healthDependents: emp.healthDependents ?? 0,
        healthFee,
        pensionRate:     emp.voluntaryPensionRate || 0,
        pensionFee,
        otherDeduction,
        total, netSalary,
        _bonusId: bonus.id, _deductionId: deduction.id,
        bgsOtherSubsidyNote:   bonus.bgsOtherSubsidyNote        || '',
        bgsOtherNote:          bonus.bgsOtherNote                || '',
        laborFeeNote:          deduction.laborFeeNote            || '',
        healthFeeNote:         deduction.healthFeeNote           || '',
        pensionFeeNote:        deduction.pensionFeeNote          || '',
        bgsOtherDeductionNote: deduction.bgsOtherDeductionNote   || '',
      };
    });

    // A碼及獎金薪資
    const aCode = employees.map(emp => {
      const bonus       = bonuses.find(b => b.empId === emp.empId) || {};
      const deduction   = deductions.find(d => d.empId === emp.empId) || {};
      const record      = records.find(r => r.empId === emp.empId) || {};
      const aCodeResult = aCodeResults.find(r => r.id === emp.empId || r.name === emp.name);

      const splitA        = aCodeResult ? aCodeResult.totalCommission : (bonus.bonusA || 0);
      const serviceIncome = splitA;
      const crossArea     = bonus.bonusCross   || 0;
      const serviceBonus  = bonus.bonusOpen    || 0;
      const quotaDev      = bonus.bonusDev     || 0;
      const certBonus     = bonus.bonusC       || 0;
      const referral      = bonus.referral     || 0;
      const mentoring     = bonus.mentoring    || 0;
      const holidayBonus  = bonus.holidayBonus || 0;
      const otherSubsidy  = bonus.otherSubsidy || 0;
      const other         = bonus.other        || 0;

      const payable = serviceIncome + crossArea + serviceBonus + quotaDev + certBonus
                    + referral + mentoring + holidayBonus + otherSubsidy + other;

      // 應收金額 = 全部來源合計（A+B+G+S+未遇+所有獎金補貼），查115年度扣繳稅額表
      const bgsOtherSubsidy = bonus.bgsOtherSubsidy || 0;
      const splitB = record.b || 0;
      const splitG = record.g || 0;
      const splitS = record.s || 0;
      const splitMissed = record.missed || 0;
      const fullPayable = splitA + splitB + splitG + splitS + splitMissed
                        + crossArea + serviceBonus + quotaDev + certBonus
                        + referral + mentoring + holidayBonus
                        + bgsOtherSubsidy + otherSubsidy + other;
      const acDepCount = emp.dependentsCount ?? 0;
      const withholdingTax = lookupWithholdingTax(fullPayable, acDepCount);
      const fuel           = bonus.fuel || 0;
      const otherDeduction = deduction.otherDeduction || 0;

      const total     = payable - withholdingTax + fuel - otherDeduction;
      const netSalary = Math.round(total);

      return {
        id: emp.id, empId: emp.empId, name: emp.name,
        paymentMethod: emp.paymentMethod || '-',
        splitA, serviceIncome,
        crossArea, serviceBonus, quotaDev, certBonus,
        referral, mentoring, holidayBonus, otherSubsidy, other,
        payable, withholdingTax, fuel, otherDeduction,
        total, netSalary,
        _bonusId: bonus.id, _deductionId: deduction.id,
        crossAreaNote:      bonus.crossAreaNote           || '',
        serviceBonusNote:   bonus.serviceBonusNote        || '',
        quotaDevNote:       bonus.quotaDevNote             || '',
        certBonusNote:      bonus.certBonusNote            || '',
        referralNote:       bonus.referralNote             || '',
        mentoringNote:      bonus.mentoringNote            || '',
        holidayBonusNote:   bonus.holidayBonusNote         || '',
        otherSubsidyNote:   bonus.otherSubsidyNote         || '',
        otherNote:          bonus.otherNote                || '',
        fuelNote:           bonus.fuelNote                 || '',
        withholdingTaxNote: deduction.withholdingTaxNote   || '',
        otherDeductionNote: deduction.otherDeductionNote   || '',
      };
    });

    // 薪資總表 (combined)
    const summary = employees.map(emp => {
      const bonus       = bonuses.find(b => b.empId === emp.empId) || {};
      const deduction   = deductions.find(d => d.empId === emp.empId) || {};
      const record      = records.find(r => r.empId === emp.empId) || {};
      const aCodeResult = aCodeResults.find(r => r.id === emp.empId || r.name === emp.name);

      const splitA      = aCodeResult ? aCodeResult.totalCommission : (bonus.bonusA || 0);
      const splitB      = record.b || 0;
      const splitG      = record.g || 0;
      const splitS      = record.s || 0;
      const splitMissed = record.missed || 0;
      const serviceIncome = splitA + splitB + splitG + splitS + splitMissed;

      const crossArea        = bonus.bonusCross   || 0;
      const serviceBonus     = bonus.bonusOpen    || 0;
      const quotaDev         = bonus.bonusDev     || 0;
      const certBonus        = bonus.bonusC       || 0;
      const referral         = bonus.referral     || 0;
      const mentoring        = bonus.mentoring    || 0;
      const holidayBonus     = bonus.holidayBonus || 0;
      const bgsOtherSubsidy  = bonus.bgsOtherSubsidy || 0;
      const acodeOtherSubsidy = bonus.otherSubsidy  || 0;
      const otherSubsidy     = bgsOtherSubsidy + acodeOtherSubsidy;
      const other            = bonus.other || 0;

      const payable = serviceIncome + crossArea + serviceBonus + quotaDev + certBonus
                    + referral + mentoring + holidayBonus + otherSubsidy + other;

      const storedWithholdingTax = deduction.withholdingTax || 0;
      const dependentsCount = emp.dependentsCount ?? 0;
      const fuel            = bonus.fuel || 0;
      const laborBracket    = emp.laborInsuranceBracket || 0;
      const laborFee        = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
      const healthBracket   = emp.healthInsuranceBracket || 0;
      const healthDependents = emp.healthDependents ?? 0;
      const healthFee       = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
      const pensionRate     = emp.voluntaryPensionRate || 0;
      const pensionFee      = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
      const otherDeduction  = deduction.otherDeduction || 0;

      // 依115年度扣繳稅額表自動計算，以應收金額(=payable)及扶養人數查表
      const autoTax = lookupWithholdingTax(payable, dependentsCount);
      const withholdingTax = autoTax;

      const total     = payable - withholdingTax + fuel - laborFee - healthFee - pensionFee - otherDeduction;
      const netSalary = Math.round(total);

      return {
        id: emp.id, empId: emp.empId, name: emp.name,
        splitA, splitB, splitG, splitS, splitMissed, serviceIncome,
        crossArea, serviceBonus, quotaDev, certBonus,
        referral, mentoring, holidayBonus, otherSubsidy, other, payable,
        withholdingTax, autoTax, storedWithholdingTax, dependentsCount, fuel,
        laborBracket, laborFee, healthBracket, healthDependents, healthFee,
        pensionRate, pensionFee, otherDeduction, total, netSalary,
        _bonusId: bonus.id, _deductionId: deduction.id,
        bgsOtherSubsidy, acodeOtherSubsidy,
        // all notes
        bgsOtherSubsidyNote:   bonus.bgsOtherSubsidyNote   || '',
        bgsOtherNote:          bonus.bgsOtherNote           || '',
        crossAreaNote:         bonus.crossAreaNote          || '',
        serviceBonusNote:      bonus.serviceBonusNote       || '',
        quotaDevNote:          bonus.quotaDevNote           || '',
        certBonusNote:         bonus.certBonusNote          || '',
        referralNote:          bonus.referralNote           || '',
        mentoringNote:         bonus.mentoringNote          || '',
        holidayBonusNote:      bonus.holidayBonusNote       || '',
        otherSubsidyNote:      bonus.otherSubsidyNote       || '',
        otherNote:             bonus.otherNote              || '',
        fuelNote:              bonus.fuelNote               || '',
        laborFeeNote:          deduction.laborFeeNote       || '',
        healthFeeNote:         deduction.healthFeeNote      || '',
        pensionFeeNote:        deduction.pensionFeeNote     || '',
        bgsOtherDeductionNote: deduction.bgsOtherDeductionNote || '',
        withholdingTaxNote:    deduction.withholdingTaxNote || '',
        otherDeductionNote:    deduction.otherDeductionNote || '',
      };
    });

    setBgsItems(bgs);
    setAItems(aCode);
    setSummaryItems(summary);
  };

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
          bgsOtherSubsidy: form.otherSubsidy, other: form.other,
          bgsOtherSubsidyNote: raw.bgsOtherSubsidyNote, bgsOtherNote: raw.bgsOtherNote,
        }),
        saveDeduction({
          empId: raw.empId,
          laborFee: form.laborFee, healthFee: form.healthFee, pensionFee: form.pensionFee, otherDeduction: form.otherDeduction,
          laborFeeNote: raw.laborFeeNote, healthFeeNote: raw.healthFeeNote, pensionFeeNote: raw.pensionFeeNote, bgsOtherDeductionNote: raw.bgsOtherDeductionNote,
        }),
      ]);
    } else if (type === 'acode') {
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bonusCross: form.crossArea, bonusOpen: form.serviceBonus, bonusDev: form.quotaDev,
          bonusC: form.certBonus, referral: form.referral, mentoring: form.mentoring,
          holidayBonus: form.holidayBonus, otherSubsidy: form.otherSubsidy, other: form.other, fuel: form.fuel,
          crossAreaNote: raw.crossAreaNote, serviceBonusNote: raw.serviceBonusNote,
          quotaDevNote: raw.quotaDevNote, certBonusNote: raw.certBonusNote,
          referralNote: raw.referralNote, mentoringNote: raw.mentoringNote,
          holidayBonusNote: raw.holidayBonusNote, otherSubsidyNote: raw.otherSubsidyNote,
          otherNote: raw.otherNote, fuelNote: raw.fuelNote,
        }),
        saveDeduction({
          empId: raw.empId,
          withholdingTax: form.withholdingTax, otherDeduction: form.otherDeduction,
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
          other:           form.other,
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
          otherDeduction:  form.otherDeduction,
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
          bgsOtherSubsidy: raw.otherSubsidy, other: raw.other,
          bgsOtherSubsidyNote: form.bgsOtherSubsidyNote, bgsOtherNote: form.bgsOtherNote,
        }),
        saveDeduction({
          empId: raw.empId,
          laborFee: raw.laborFee, healthFee: raw.healthFee, pensionFee: raw.pensionFee, otherDeduction: raw.otherDeduction,
          laborFeeNote: form.laborFeeNote, healthFeeNote: form.healthFeeNote, pensionFeeNote: form.pensionFeeNote, bgsOtherDeductionNote: form.bgsOtherDeductionNote,
        }),
      ]);
    } else if (type === 'acode') {
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bonusCross: raw.crossArea, bonusOpen: raw.serviceBonus, bonusDev: raw.quotaDev,
          bonusC: raw.certBonus, referral: raw.referral, mentoring: raw.mentoring,
          holidayBonus: raw.holidayBonus, otherSubsidy: raw.otherSubsidy, other: raw.other, fuel: raw.fuel,
          crossAreaNote: form.crossAreaNote, serviceBonusNote: form.serviceBonusNote,
          quotaDevNote: form.quotaDevNote, certBonusNote: form.certBonusNote,
          referralNote: form.referralNote, mentoringNote: form.mentoringNote,
          holidayBonusNote: form.holidayBonusNote, otherSubsidyNote: form.otherSubsidyNote,
          otherNote: form.otherNote, fuelNote: form.fuelNote,
        }),
        saveDeduction({
          empId: raw.empId,
          withholdingTax: raw.withholdingTax, otherDeduction: raw.otherDeduction,
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
          other:           raw.other,
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
          otherDeduction:  raw.otherDeduction,
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
      if (subTab === 'bgs')     await exportBgsExcel(bgsItems, period);
      if (subTab === 'acode')   await exportAcodeExcel(aItems, period);
      if (subTab === 'summary') await exportSummaryExcel(summaryItems, period);
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
            otherDeduction: item.otherDeduction,
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
    { id: 'bgs',     label: 'BGS碼薪資' },
    { id: 'acode',   label: 'A碼及獎金薪資' },
    { id: 'summary', label: '薪資總表' },
  ];

  const thCls = (right = false) =>
    `px-4 py-3 text-xs font-medium${right ? ' text-right' : ''}`;

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

  const tabLabel = (type) => type === 'bgs' ? 'BGS碼薪資' : type === 'acode' ? 'A碼及獎金薪資' : '薪資總表';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>薪資報表</h2>
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

      {/* Sub-tab selector */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--glass-border)' }}>
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

      {/* ── BGS碼薪資 ─────────────────────────────────────────────────────── */}
      {subTab === 'bgs' && (
        <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>員編</th>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>姓名</th>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>領款方式</th>
                  {['B碼拆帳金額','G碼拆帳金額','S碼拆帳金額','服務未遇拆帳','服務所得總額',
                    '其他補貼','其他','應領金額',
                    '勞保級距','勞保費用','健保級距','健保眷屬人數','健保費用',
                    '勞退自提%','應扣勞退自提','應扣費用','總額','實領金額',
                  ].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>備註</th>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {bgsItems.length === 0 ? (
                  <tr>
                    <td colSpan="23" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                      尚無數據，請先建立員工名單並上傳計算
                    </td>
                  </tr>
                ) : bgsItems.map(item => (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium"           style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                    <td className="px-4 py-3 text-sm"                       style={{ color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
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
                        {money(item.other)}<NoteTooltip note={item.bgsOtherNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.payable)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.laborBracket)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">
                        {money(item.laborFee)}<NoteTooltip note={item.laborFeeNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right"  style={{ color: 'var(--text-secondary)' }}>{money(item.healthBracket)}</td>
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
                        {money(item.otherDeduction)}<NoteTooltip note={item.bgsOtherDeductionNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                    <NoteBtn item={item} type="bgs" />
                    <EditBtn item={item} type="bgs" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── A碼及獎金薪資 ──────────────────────────────────────────────────── */}
      {subTab === 'acode' && (
        <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>員編</th>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>姓名</th>
                  <th className={thCls()}     style={{ color: 'var(--table-header-text)' }}>領款方式</th>
                  {['A碼拆帳金額','服務所得總額','跨區補助','服務獎金','額度開發','丙證獎金',
                    '介紹費','帶新人津貼','節日獎金','其他補貼','其他',
                    '應領金額','扣繳稅額','油資補貼','應扣費用','總額','實領金額',
                  ].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>備註</th>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {aItems.length === 0 ? (
                  <tr>
                    <td colSpan="22" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                      尚無數據，請先建立員工名單並上傳計算
                    </td>
                  </tr>
                ) : aItems.map(item => (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium"           style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                    <td className="px-4 py-3 text-sm"                       style={{ color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
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
                        {money(item.other)}<NoteTooltip note={item.otherNote} />
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
                        {money(item.otherDeduction)}<NoteTooltip note={item.otherDeductionNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                    <NoteBtn item={item} type="acode" />
                    <EditBtn item={item} type="acode" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 薪資總表 ───────────────────────────────────────────────────────── */}
      {subTab === 'summary' && (
        <>
        {/* 自動計算說明列 */}
        <div className="flex items-center justify-between px-1 -mt-2 mb-1">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            扣繳稅額依 115 年度薪資所得扣繳稅額表自動計算（以應收金額 × 扶養親屬人數查表）
          </p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>員編</th>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>姓名</th>
                  {['A碼拆帳金額','B碼拆帳金額','G碼拆帳金額','S碼拆帳金額','服務未遇拆帳','服務所得總額',
                    '跨區補助','服務獎金','額度開發','丙證獎金','介紹費','帶新人津貼','節日獎金',
                    '其他補貼','其他','應領金額',
                    '扣繳稅額','扶養親屬人數','油資補貼',
                    '勞保級距','勞保費用','健保級距','健保眷屬人數','健保費用',
                    '勞退自提%','應扣勞退自提','應扣費用','總額','實領金額',
                  ].map(h => (
                    <th key={h} className={thCls(true)} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                  ))}
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>備註</th>
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {summaryItems.length === 0 ? (
                  <tr>
                    <td colSpan="33" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                      尚無數據，請先建立員工名單並上傳計算
                    </td>
                  </tr>
                ) : summaryItems.map(item => (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium"           style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                    {/* A/B/G/S + 未遇 */}
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
                      <span className="inline-flex items-center justify-end">{money(item.other)}<NoteTooltip note={item.otherNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.payable)}</td>
                    {/* 扣項 */}
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end gap-1">
                        {money(item.autoTax)}
                        {item.autoTax !== item.storedWithholdingTax && item.storedWithholdingTax !== 0 && (
                          <span
                            className="text-[10px] px-1 rounded font-sans"
                            style={{ background: 'var(--text-accent)', color: 'var(--glass-bg)', opacity: 0.85 }}
                            title={`已儲存值：$${item.storedWithholdingTax.toLocaleString()}，點選「套用扣繳稅額至A碼」更新`}
                          >更新</span>
                        )}
                        <NoteTooltip note={item.withholdingTaxNote} />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.dependentsCount}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center justify-end">{money(item.fuel)}<NoteTooltip note={item.fuelNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.laborBracket)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.laborFee)}<NoteTooltip note={item.laborFeeNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{money(item.healthBracket)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.healthDependents}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.healthFee)}<NoteTooltip note={item.healthFeeNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{pct(item.pensionRate)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.pensionFee)}<NoteTooltip note={item.pensionFeeNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">
                      <span className="inline-flex items-center justify-end">{money(item.otherDeduction)}<NoteTooltip note={item.otherDeductionNote} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                    <NoteBtn item={item} type="summary" />
                    <EditBtn item={item} type="summary" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
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
              <ModalField label="其他補貼"    fieldKey="otherSubsidy"   formData={modal.form} onChange={handleChange} />
              <ModalField label="其他"        fieldKey="other"           formData={modal.form} onChange={handleChange} />
              <Divider label="應扣項目" />
              <ModalField label="勞保費用"    fieldKey="laborFee"        formData={modal.form} onChange={handleChange} />
              <ModalField label="健保費用"    fieldKey="healthFee"       formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣勞退自提" fieldKey="pensionFee"      formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣費用"    fieldKey="otherDeduction"   formData={modal.form} onChange={handleChange} />
            </div>
          ) : modal.type === 'acode' ? (
            <div className="grid grid-cols-2 gap-6">
              <Divider label="獎金項目" />
              <ModalField label="跨區補助"   fieldKey="crossArea"      formData={modal.form} onChange={handleChange} />
              <ModalField label="服務獎金"   fieldKey="serviceBonus"   formData={modal.form} onChange={handleChange} />
              <ModalField label="額度開發"   fieldKey="quotaDev"       formData={modal.form} onChange={handleChange} />
              <ModalField label="丙證獎金"   fieldKey="certBonus"      formData={modal.form} onChange={handleChange} />
              <ModalField label="介紹費"     fieldKey="referral"       formData={modal.form} onChange={handleChange} />
              <ModalField label="帶新人津貼"  fieldKey="mentoring"      formData={modal.form} onChange={handleChange} />
              <ModalField label="節日獎金"   fieldKey="holidayBonus"   formData={modal.form} onChange={handleChange} />
              <ModalField label="其他補貼"   fieldKey="otherSubsidy"   formData={modal.form} onChange={handleChange} />
              <ModalField label="其他"       fieldKey="other"           formData={modal.form} onChange={handleChange} />
              <Divider label="應扣 / 補貼項目" />
              <ModalField label="扣繳稅額"   fieldKey="withholdingTax"  formData={modal.form} onChange={handleChange} />
              <ModalField label="油資補貼"   fieldKey="fuel"            formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣費用"   fieldKey="otherDeduction"  formData={modal.form} onChange={handleChange} />
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
              <ModalField label="其他"            fieldKey="other"             formData={modal.form} onChange={handleChange} />
              <Divider label="應扣 / 補貼項目" />
              <ModalField label="扣繳稅額"        fieldKey="withholdingTax"    formData={modal.form} onChange={handleChange} />
              <ModalField label="油資補貼"        fieldKey="fuel"              formData={modal.form} onChange={handleChange} />
              <ModalField label="勞保費用"        fieldKey="laborFee"          formData={modal.form} onChange={handleChange} />
              <ModalField label="健保費用"        fieldKey="healthFee"         formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣勞退自提"     fieldKey="pensionFee"        formData={modal.form} onChange={handleChange} />
              <ModalField label="應扣費用"        fieldKey="otherDeduction"    formData={modal.form} onChange={handleChange} />
            </div>
          )}
        </ModalShell>
      )}

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
              <NoteField label="其他"        amount={noteModal.raw.other}           fieldKey="bgsOtherNote"           formData={noteModal.form} onChange={handleNoteChange} />
              <Divider label="應扣項目" />
              <NoteField label="勞保費用"    amount={noteModal.raw.laborFee}        fieldKey="laborFeeNote"           formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="健保費用"    amount={noteModal.raw.healthFee}       fieldKey="healthFeeNote"          formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣勞退自提" amount={noteModal.raw.pensionFee}     fieldKey="pensionFeeNote"         formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣費用"    amount={noteModal.raw.otherDeduction}  fieldKey="bgsOtherDeductionNote"  formData={noteModal.form} onChange={handleNoteChange} />
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
              <NoteField label="其他補貼"   amount={noteModal.raw.otherSubsidy}  fieldKey="otherSubsidyNote" formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他"       amount={noteModal.raw.other}          fieldKey="otherNote"        formData={noteModal.form} onChange={handleNoteChange} />
              <Divider label="應扣 / 補貼項目" />
              <NoteField label="扣繳稅額"   amount={noteModal.raw.withholdingTax} fieldKey="withholdingTaxNote" formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="油資補貼"   amount={noteModal.raw.fuel}           fieldKey="fuelNote"           formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣費用"   amount={noteModal.raw.otherDeduction} fieldKey="otherDeductionNote" formData={noteModal.form} onChange={handleNoteChange} />
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
              <NoteField label="其他補貼(BGS)"  amount={noteModal.raw.bgsOtherSubsidy} fieldKey="bgsOtherSubsidyNote" formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他補貼(A碼)"  amount={noteModal.raw.acodeOtherSubsidy} fieldKey="otherSubsidyNote"  formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="其他"           amount={noteModal.raw.other}           fieldKey="otherNote"           formData={noteModal.form} onChange={handleNoteChange} />
              <Divider label="應扣 / 補貼項目" />
              <NoteField label="扣繳稅額"       amount={noteModal.raw.withholdingTax}  fieldKey="withholdingTaxNote"  formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="油資補貼"       amount={noteModal.raw.fuel}            fieldKey="fuelNote"            formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="勞保費用"       amount={noteModal.raw.laborFee}        fieldKey="laborFeeNote"        formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="健保費用"       amount={noteModal.raw.healthFee}       fieldKey="healthFeeNote"       formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣勞退自提"    amount={noteModal.raw.pensionFee}     fieldKey="pensionFeeNote"      formData={noteModal.form} onChange={handleNoteChange} />
              <NoteField label="應扣費用"       amount={noteModal.raw.otherDeduction}  fieldKey="bgsOtherDeductionNote" formData={noteModal.form} onChange={handleNoteChange} />
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
};

export default SalarySummary;
