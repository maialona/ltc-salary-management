import React, { useState, useEffect } from 'react';
import { Edit2, X } from 'lucide-react';
import { getEmployees } from '../data/employeeStore';
import { getBonuses, saveBonus } from '../data/bonusStore';
import { getDeductions, saveDeduction } from '../data/deductionStore';
import { getRecords } from '../data/recordsStore';
import { getAcodeResults } from '../data/acodeStore';
import { subscribePeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';

const money = (val) => (val && val !== 0) ? `$${val.toLocaleString()}` : '-';
const pct   = (val) => (val && val !== 0) ? `${val}%` : '-';

// ─── Shared modal input ───────────────────────────────────────────────────────
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

// ─── Section divider ──────────────────────────────────────────────────────────
const Divider = ({ label }) => (
  <div className="col-span-full flex items-center gap-3 mt-2">
    <div className="h-px flex-1" style={{ background: 'var(--glass-border)' }} />
    <span className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <div className="h-px flex-1" style={{ background: 'var(--glass-border)' }} />
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const SalarySummary = () => {
  const { currentInstitution } = useInstitution();
  const [subTab, setSubTab]     = useState('bgs');
  const [bgsItems, setBgsItems] = useState([]);
  const [aItems, setAItems]     = useState([]);
  const [modal, setModal]       = useState({ open: false, type: null, form: {}, raw: {} });

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

      const splitB       = record.b || 0;
      const splitG       = record.g || 0;
      const splitS       = record.s || 0;
      const splitMissed  = record.missed || 0;
      const serviceIncome = splitB + splitG + splitS + splitMissed;
      const otherSubsidy = bonus.bgsOtherSubsidy || 0;
      const other        = bonus.other || 0;
      const payable      = serviceIncome + otherSubsidy + other;

      const laborFee      = deduction.laborFee  ?? emp.laborInsuranceSelfPay  ?? 0;
      const healthFee     = deduction.healthFee ?? emp.healthInsuranceSelfPay ?? 0;
      const pensionFee    = deduction.pensionFee ?? emp.voluntaryPensionDeduction ?? 0;
      const otherDeduction = deduction.otherDeduction || 0;

      const total     = payable - laborFee - healthFee - pensionFee - otherDeduction;
      const netSalary = Math.round(total);

      return {
        id: emp.id, empId: emp.empId, name: emp.name,
        paymentMethod: emp.paymentMethod || '-',
        splitB, splitG, splitS, splitMissed,
        serviceIncome, otherSubsidy, other, payable,
        laborBracket:   emp.laborInsuranceBracket || 0,
        laborFee,
        healthBracket:  emp.healthInsuranceBracket || 0,
        healthDependents: emp.healthDependents ?? 0,
        healthFee,
        pensionRate:    emp.voluntaryPensionRate || 0,
        pensionFee,
        otherDeduction,
        total, netSalary,
        // raw store IDs for saving
        _bonusId:     bonus.id,
        _deductionId: deduction.id,
      };
    });

    // A碼及獎金薪資
    const aCode = employees.map(emp => {
      const bonus      = bonuses.find(b => b.empId === emp.empId) || {};
      const deduction  = deductions.find(d => d.empId === emp.empId) || {};
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
      const withholdingTax = deduction.withholdingTax || 0;
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
        _bonusId:     bonus.id,
        _deductionId: deduction.id,
      };
    });

    setBgsItems(bgs);
    setAItems(aCode);
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
        saveBonus({ empId: raw.empId, name: raw.name, bgsOtherSubsidy: form.otherSubsidy, other: form.other }),
        saveDeduction({ empId: raw.empId, laborFee: form.laborFee, healthFee: form.healthFee, pensionFee: form.pensionFee, otherDeduction: form.otherDeduction }),
      ]);
    } else {
      await Promise.all([
        saveBonus({
          empId: raw.empId, name: raw.name,
          bonusCross: form.crossArea, bonusOpen: form.serviceBonus, bonusDev: form.quotaDev,
          bonusC: form.certBonus, referral: form.referral, mentoring: form.mentoring,
          holidayBonus: form.holidayBonus, otherSubsidy: form.otherSubsidy, other: form.other, fuel: form.fuel,
        }),
        saveDeduction({ empId: raw.empId, withholdingTax: form.withholdingTax, otherDeduction: form.otherDeduction }),
      ]);
    }

    setModal({ open: false, type: null, form: {}, raw: {} });
    loadData();
  };

  // ── Shared helpers ──────────────────────────────────────────────────────────
  const tabs = [
    { id: 'bgs',   label: 'BGS碼薪資' },
    { id: 'acode', label: 'A碼及獎金薪資' },
  ];

  const thCls = (right = false) =>
    `px-4 py-3 text-xs font-medium${right ? ' text-right' : ''}`;

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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>薪資總表</h2>
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
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {bgsItems.length === 0 ? (
                  <tr>
                    <td colSpan="22" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                      尚無數據，請先建立員工名單並上傳計算
                    </td>
                  </tr>
                ) : bgsItems.map(item => (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium"  style={{ color: 'var(--text-primary)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium"            style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                    <td className="px-4 py-3 text-sm"                        style={{ color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.splitB)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.splitG)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.splitS)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.splitMissed)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.serviceIncome)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.otherSubsidy)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.other)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.payable)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.laborBracket)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.laborFee)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.healthBracket)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{item.healthDependents}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.healthFee)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{pct(item.pensionRate)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.pensionFee)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.otherDeduction)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
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
                  <th className={thCls()} style={{ color: 'var(--table-header-text)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {aItems.length === 0 ? (
                  <tr>
                    <td colSpan="21" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                      尚無數據，請先建立員工名單並上傳計算
                    </td>
                  </tr>
                ) : aItems.map(item => (
                  <tr key={item.id} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="px-4 py-3 font-mono text-sm font-medium"  style={{ color: 'var(--text-primary)' }}>{item.empId}</td>
                    <td className="px-4 py-3 text-sm font-medium"            style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                    <td className="px-4 py-3 text-sm"                        style={{ color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.splitA)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.serviceIncome)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-blue-400">{money(item.crossArea)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-emerald-400">{money(item.serviceBonus)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-emerald-400">{money(item.quotaDev)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-amber-400">{money(item.certBonus)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-purple-400">{money(item.referral)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-purple-400">{money(item.mentoring)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-yellow-400">{money(item.holidayBonus)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.otherSubsidy)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.other)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.payable)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.withholdingTax)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right"   style={{ color: 'var(--text-secondary)' }}>{money(item.fuel)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right text-red-400">{money(item.otherDeduction)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{money(item.total)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-bold text-emerald-400">${item.netSalary.toLocaleString()}</td>
                    <EditBtn item={item} type="acode" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(m => ({ ...m, open: false }))} />
          <div
            className="relative w-full max-w-2xl border overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            style={{
              background:   'var(--modal-bg)',
              borderRadius: 'var(--modal-radius)',
              boxShadow:    'var(--modal-shadow)',
              borderColor:  'var(--glass-border)',
            }}
          >
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  編輯資料 — {modal.type === 'bgs' ? 'BGS碼薪資' : 'A碼及獎金薪資'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {modal.raw.empId} {modal.raw.name}
                </p>
              </div>
              <button onClick={() => setModal(m => ({ ...m, open: false }))} className="p-1.5 hover:bg-white/10 rounded-md transition-colors cursor-pointer">
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              {modal.type === 'bgs' ? (
                <div className="grid grid-cols-2 gap-6">
                  <Divider label="額外項目" />
                  <ModalField label="其他補貼" fieldKey="otherSubsidy"   formData={modal.form} onChange={handleChange} />
                  <ModalField label="其他"     fieldKey="other"          formData={modal.form} onChange={handleChange} />
                  <Divider label="應扣項目" />
                  <ModalField label="勞保費用"    fieldKey="laborFee"      formData={modal.form} onChange={handleChange} />
                  <ModalField label="健保費用"    fieldKey="healthFee"     formData={modal.form} onChange={handleChange} />
                  <ModalField label="應扣勞退自提" fieldKey="pensionFee"    formData={modal.form} onChange={handleChange} />
                  <ModalField label="應扣費用"    fieldKey="otherDeduction" formData={modal.form} onChange={handleChange} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <Divider label="獎金項目" />
                  <ModalField label="跨區補助"  fieldKey="crossArea"    formData={modal.form} onChange={handleChange} />
                  <ModalField label="服務獎金"  fieldKey="serviceBonus" formData={modal.form} onChange={handleChange} />
                  <ModalField label="額度開發"  fieldKey="quotaDev"     formData={modal.form} onChange={handleChange} />
                  <ModalField label="丙證獎金"  fieldKey="certBonus"    formData={modal.form} onChange={handleChange} />
                  <ModalField label="介紹費"   fieldKey="referral"     formData={modal.form} onChange={handleChange} />
                  <ModalField label="帶新人津貼" fieldKey="mentoring"    formData={modal.form} onChange={handleChange} />
                  <ModalField label="節日獎金"  fieldKey="holidayBonus" formData={modal.form} onChange={handleChange} />
                  <ModalField label="其他補貼"  fieldKey="otherSubsidy" formData={modal.form} onChange={handleChange} />
                  <ModalField label="其他"    fieldKey="other"        formData={modal.form} onChange={handleChange} />
                  <Divider label="應扣 / 補貼項目" />
                  <ModalField label="扣繳稅額"  fieldKey="withholdingTax" formData={modal.form} onChange={handleChange} />
                  <ModalField label="油資補貼"  fieldKey="fuel"           formData={modal.form} onChange={handleChange} />
                  <ModalField label="應扣費用"  fieldKey="otherDeduction" formData={modal.form} onChange={handleChange} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
              <button
                onClick={() => setModal(m => ({ ...m, open: false }))}
                className="px-4 py-2 rounded-md text-sm font-medium border transition-colors cursor-pointer"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--btn-primary-bg)'}
              >
                儲存資料
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySummary;
