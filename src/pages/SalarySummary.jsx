import React, { useState, useEffect } from 'react';
import { getEmployees } from '../data/employeeStore';
import { getBonuses } from '../data/bonusStore';
import { getDeductions } from '../data/deductionStore';
import { getRecords } from '../data/recordsStore';
import { subscribePeriod } from '../data/periodStore';

const SalarySummary = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribePeriod(() => loadData());
    return unsubscribe;
  }, []);

  const loadData = () => {
    const employees = getEmployees();
    const bonuses = getBonuses();
    const deductions = getDeductions();
    const records = getRecords();

    // Pre-load A-Code Data
    let aCodeResults = [];
    try {
        const savedACodeState = localStorage.getItem('acode_calc_state');
        if (savedACodeState) {
            const parsed = JSON.parse(savedACodeState);
            if (parsed.results && parsed.results.finalSummary) {
                aCodeResults = parsed.results.finalSummary;
            }
        }
    } catch (e) {
        console.error("Failed to load A-Code data", e);
    }

    const merged = employees.map(emp => {
      const bonus = bonuses.find(b => b.empId === emp.empId) || {};
      const deduction = deductions.find(d => d.empId === emp.empId) || {};
      const record = records.find(r => r.empId === emp.empId) || { b: 0, g: 0, s: 0, missed: 0 };

      // Helper to sum bonus fields EXCEPT bonusA (which is listed separately)
      const otherBonuses = (bonus.bonusC || 0) + 
                           (bonus.bonusOpen || 0) + 
                           (bonus.bonusDev || 0) + 
                           (bonus.bonusCross || 0) + 
                           (bonus.referral || 0) + 
                           (bonus.mentoring || 0) + 
                           (bonus.fuel || 0) + 
                           (bonus.other || 0);

      // Sum of deductions
      const totalDeduction = (deduction.withholdingTax || 0) + 
                             (deduction.laborFee || 0) + 
                             (deduction.healthFee || 0) + 
                             (deduction.pensionFee || 0);

      // A-Code Amount (derived from System Calculation or Manual Bonus)
      let splitA = 0;
      
      // 1. Try System Data first
      const empResult = aCodeResults.find(res => res.id === emp.empId || res.name === emp.name);
      if (empResult) {
          splitA = empResult.totalCommission;
      }

      // 2. If no system data, check manual entry (optional, depends on policy)
      if (splitA === 0) {
          splitA = bonus.bonusA || 0;
      }

      // Splits from RecordsProcessing
      const splitB = record.b || 0;
      const splitG = record.g || 0;
      const splitS = record.s || 0;
      const splitMissed = record.missed || 0;

      // Net Calculation
      const netSalary = splitA + splitB + splitG + splitS + splitMissed + otherBonuses - totalDeduction;

      return {
        id: emp.id,
        empId: emp.empId,
        name: emp.name,
        splitA,
        splitB,
        splitG,
        splitS,
        splitMissed,
        otherBonuses,
        totalDeduction,
        netSalary
      };
    });

    setItems(merged);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>薪資總表</h2>
          
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                <th className="p-3 text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--table-header-text)' }}>員編</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--table-header-text)' }}>姓名</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>A碼拆帳</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>B碼拆帳</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>G碼拆帳</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>S碼拆帳</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>未遇拆帳</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>額外獎金</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>應扣費用</th>
                <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>實領金額</th>
              </tr>
            </thead>
            <tbody className="" style={{ borderColor: 'var(--glass-border)' }}>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                    尚無數據，請先建立員工名單並上傳計算
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="transition-colors border-b group hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="p-6 font-mono font-bold" style={{ color: 'var(--text-accent)' }}>{item.empId}</td>
                    <td className="p-6 font-bold" style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                    <td className="p-6 font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{item.splitA > 0 ? `$${item.splitA.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{item.splitB > 0 ? `$${item.splitB.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{item.splitG > 0 ? `$${item.splitG.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{item.splitS > 0 ? `$${item.splitS.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{item.splitMissed > 0 ? `$${item.splitMissed.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-yellow-400 text-right">{item.otherBonuses > 0 ? `$${item.otherBonuses.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-red-300 text-right">{item.totalDeduction > 0 ? `$${item.totalDeduction.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono font-black text-right text-lg" style={{ color: 'var(--text-accent)' }}>
                        ${item.netSalary.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalarySummary;
