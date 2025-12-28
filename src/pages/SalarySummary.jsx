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

      // A Code Amount (derived from BonusStore based on user request/edit)
      const splitA = bonus.bonusA || 0;

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
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">薪資總表</h2>
          
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#0f172a]/40 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky left-0 bg-[#0f172a]/95 backdrop-blur-xl z-20">員編</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky left-[80px] bg-[#0f172a]/95 backdrop-blur-xl z-20">姓名</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">A碼拆帳</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">B碼拆帳</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">G碼拆帳</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">S碼拆帳</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">未遇拆帳</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right text-yellow-500">額外獎金</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right text-red-400">應扣費用</th>
                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right text-cyan-400">實領金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-slate-500">
                    尚無數據，請先建立員工名單並上傳計算
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-6 font-mono text-cyan-400 font-bold sticky left-0 bg-[#0f172a]/40 backdrop-blur-xl z-10 group-hover:bg-[#161f32] transition-colors">{item.empId}</td>
                    <td className="p-6 font-bold text-white sticky left-[80px] bg-[#0f172a]/40 backdrop-blur-xl z-10 group-hover:bg-[#161f32] transition-colors">{item.name}</td>
                    <td className="p-6 font-mono text-slate-300 text-right">{item.splitA > 0 ? `$${item.splitA.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-slate-300 text-right">{item.splitB > 0 ? `$${item.splitB.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-slate-300 text-right">{item.splitG > 0 ? `$${item.splitG.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-slate-300 text-right">{item.splitS > 0 ? `$${item.splitS.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-slate-300 text-right">{item.splitMissed > 0 ? `$${item.splitMissed.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-yellow-400 text-right">{item.otherBonuses > 0 ? `$${item.otherBonuses.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono text-red-300 text-right">{item.totalDeduction > 0 ? `$${item.totalDeduction.toLocaleString()}` : '-'}</td>
                    <td className="p-6 font-mono font-black text-cyan-400 text-right text-lg shadow-[inset_20px_0_20px_-20px_rgba(34,211,238,0.1)]">
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
