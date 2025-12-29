import React, { useState, useEffect } from 'react';
import { getEmployees } from '../data/employeeStore';
import { getBonuses } from '../data/bonusStore';
import { getDeductions } from '../data/deductionStore';
import { getRecords } from '../data/recordsStore';
import { subscribePeriod, getPeriod } from '../data/periodStore';
import { Download, AlertTriangle, FileText, CheckCircle, Printer } from 'lucide-react';

const SalarySlipTemplate = ({ data, isBulk = false }) => {
    return (
        <div className={`bg-white text-black p-8 md:p-12 mx-auto max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:max-w-none print:min-h-0 print:m-0 rounded-sm ${isBulk ? 'print:break-after-page mb-8 print:mb-0' : ''}`}>
            
            {/* Available for Print Styling - Only render once if handled by parent, but safe here too */}
                <style>{`
                    @media print {
                        @page {
                            size: A4;
                            margin: 10mm;
                        }
                        /* Ensure the root takes full width and height naturally */
                        #salary-slip-root {
                            width: 100%;
                            height: auto;
                            display: block;
                        }
                    }
                `}</style>

            <div className="space-y-6">
                
                {/* Header */}
                <div className="text-center border-b-2 border-black pb-6">
                    <h1 className="text-3xl font-black tracking-tight mb-2">薪資明細表</h1>
                    <div className="flex justify-center gap-8 text-sm font-bold mt-4">
                        <span>薪資月份: {getPeriod()}</span>
                        <span>員編: {data.emp.empId}</span>
                        <span>姓名: {data.emp.name}</span>
                        <span>列印日期: {new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                {/* 1. Service Details */}
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest border-l-4 border-black pl-3 mb-4">服務項目明細</h3>
                    
                    {Object.keys(data.groupedServices).length === 0 ? (
                        <p className="text-gray-400 text-xs italic py-4 text-center">無服務紀錄</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            {Object.values(data.groupedServices).map((group, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-2 text-xs break-inside-avoid">
                                    <div className="font-bold mb-1 pb-1 border-b border-gray-100 flex justify-between">
                                        <span>{group.client}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {group.items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-gray-600 font-mono">
                                                <span>{item.code} {item.count > 1 && `x${item.count}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Split Calculation Summary */}
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest border-l-4 border-black pl-3 mb-4">拆帳金額計算</h3>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                       <div className="grid grid-cols-4 gap-4 text-center divide-x divide-gray-200">
                           {['B', 'G', 'S', 'Missed'].map(type => {
                               const info = data.breakdown[type] || { rawSum: 0, splitSum: 0 };
                               const labels = { 'B': 'B碼', 'G': 'G碼', 'S': 'S碼', 'Missed': '未遇' };
                               return (
                                   <div key={type} className="px-2">
                                       <div className="text-xs font-bold text-gray-500 mb-1">{labels[type]}總額</div>
                                       <div className="font-mono text-gray-400 text-xs mb-1">${info.rawSum.toLocaleString()}</div>
                                       <div className="font-bold text-lg">${info.splitSum.toLocaleString()}</div>
                                   </div>
                               )
                           })}
                       </div>
                       <div className="border-t border-gray-200 mt-4 pt-3 flex justify-end items-center gap-4">
                           <span className="text-xs font-bold text-gray-500 uppercase">拆帳小計</span>
                           <span className="text-xl font-black font-mono">${data.splitTotal.toLocaleString()}</span>
                       </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {/* 3. Bonus & Deductions */}
                    <div>
                         <h3 className="text-sm font-black uppercase tracking-widest border-l-4 border-black pl-3 mb-4">額外獎金明細</h3>
                         <table className="w-full text-sm">
                             <tbody>
                                 {data.bonusDetails.map((item, idx) => (
                                     <tr key={idx} className="border-b border-gray-100">
                                         <td className="py-2 text-gray-600">{item.label}</td>
                                         <td className="py-2 text-right font-mono font-bold">${item.value.toLocaleString()}</td>
                                     </tr>
                                 ))}
                                 <tr className="border-t-2 border-gray-200">
                                     <td className="py-3 font-bold">獎金小計</td>
                                     <td className="py-3 text-right font-black font-mono text-lg">${data.totalBonus.toLocaleString()}</td>
                                 </tr>
                             </tbody>
                         </table>
                    </div>

                    <div>
                         <h3 className="text-sm font-black uppercase tracking-widest border-l-4 border-black pl-3 mb-4">應扣費用明細</h3>
                         <table className="w-full text-sm">
                             <tbody>
                                 {data.deductionDetails.map((item, idx) => (
                                     <tr key={idx} className="border-b border-gray-100">
                                         <td className="py-2 text-gray-600">{item.label}</td>
                                         <td className="py-2 text-right font-mono font-bold text-red-500">-${item.value.toLocaleString()}</td>
                                     </tr>
                                 ))}
                                 <tr className="border-t-2 border-gray-200">
                                     <td className="py-3 font-bold">應扣小計</td>
                                     <td className="py-3 text-right font-black font-mono text-lg text-red-600">-${data.totalDeduction.toLocaleString()}</td>
                                 </tr>
                             </tbody>
                         </table>
                    </div>
                </div>

                {/* 4. Final Net */}
                <div className="border-t-4 border-black pt-6 mt-8 flex justify-between items-center bg-gray-50 p-6 rounded-xl">
                    <div className="text-sm text-gray-500 font-bold">
                        實領金額 = 拆帳小計 + 獎金小計 - 應扣小計
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">本月實領金額</div>
                        <div className="text-4xl font-black font-mono text-black">${data.netSalary.toLocaleString()}</div>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Main Component
const SalarySlipDownload = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [singleData, setSingleData] = useState(null);
  const [allData, setAllData] = useState(null); // For bulk view
  const [isBulkMode, setIsBulkMode] = useState(false);

  useEffect(() => {
    setEmployees(getEmployees());
  }, []);

  useEffect(() => {
    if (selectedEmpId) {
        setIsBulkMode(false); // Switch to single mode if specific employee selected
        const d = processEmployeeData(selectedEmpId);
        setSingleData(d);
    } else {
        setSingleData(null);
    }
    
    // Subscribe to global period change
    const unsubscribe = subscribePeriod(() => {
        if(selectedEmpId) {
            const d = processEmployeeData(selectedEmpId);
            setSingleData(d);
        }
        if(isBulkMode) {
             prepareBulkData();
        }
    });
    return unsubscribe;
  }, [selectedEmpId]);

  // If entering bulk mode, prepare all data
  useEffect(() => {
      if (isBulkMode) {
          prepareBulkData();
          setSelectedEmpId(null); // Clear selection
      }
  }, [isBulkMode]);

  const prepareBulkData = () => {
      // Process all employees
      const all = getEmployees().map(e => processEmployeeData(e.empId)).filter(d => d !== null);
      setAllData(all);
  };

  const processEmployeeData = (empId) => {
    const emp = getEmployees().find(e => e.empId === empId);
    if (!emp) return null;

    const bonuses = getBonuses();
    const deductions = getDeductions();
    const records = getRecords();

    const bonus = bonuses.find(b => b.empId === empId) || {};
    const deduction = deductions.find(d => d.empId === empId) || {};
    const record = records.find(r => r.empId === empId) || { breakdown: null };

    // Bonus Breakdown
    const bonusDetails = [
      { label: 'A碼拆帳', value: bonus.bonusA || 0 }, 
      { label: '丙證獎金', value: bonus.bonusC || 0 },
      { label: '開案獎金', value: bonus.bonusOpen || 0 },
      { label: '開發獎金', value: bonus.bonusDev || 0 },
      { label: '跨區獎金', value: bonus.bonusCross || 0 },
      { label: '介紹費', value: bonus.referral || 0 },
      { label: '帶新人津貼', value: bonus.mentoring || 0 },
      { label: '油資補助', value: bonus.fuel || 0 },
      { label: '其他', value: bonus.other || 0 },
    ].filter(item => item.value > 0);

    const totalBonus = bonusDetails.reduce((acc, item) => acc + item.value, 0);

    // Deduction Breakdown
    const deductionDetails = [
      { label: '扣繳稅額', value: deduction.withholdingTax || 0 },
      { label: '勞保費', value: deduction.laborFee || 0 },
      { label: '健保費', value: deduction.healthFee || 0 },
      { label: '勞退自提', value: deduction.pensionFee || 0 },
    ].filter(item => item.value > 0);

    const totalDeduction = deductionDetails.reduce((acc, item) => acc + item.value, 0);

    // B/G/S/Missed Splits & Raw
    const breakdown = record.breakdown || {
       'B': { rawSum: 0, splitSum: record.b || 0, items: [] },
       'G': { rawSum: 0, splitSum: record.g || 0, items: [] },
       'S': { rawSum: 0, splitSum: record.s || 0, items: [] },
       'Missed': { rawSum: 0, splitSum: record.missed || 0, items: [] }
    };
    
    // Group Items by Client
    const allItems = [
      ...(breakdown['B']?.items || []),
      ...(breakdown['G']?.items || []),
      ...(breakdown['S']?.items || []),
      ...(breakdown['Missed']?.items || []),
    ];

    const groupedServices = allItems.reduce((acc, item) => {
        const key = item.client || 'Unknown';
        if (!acc[key]) {
            acc[key] = { client: key, items: [] };
        }
        const existing = acc[key].items.find(i => i.code === item.code);
        if (existing) {
            existing.count += item.count;
            existing.amount += item.amount;
        } else {
            acc[key].items.push({ ...item });
        }
        return acc;
    }, {});

    const splitTotal = (breakdown['B']?.splitSum || 0) + (breakdown['G']?.splitSum || 0) + (breakdown['S']?.splitSum || 0) + (breakdown['Missed']?.splitSum || 0);

    const netSalary = splitTotal + totalBonus - totalDeduction;

    return {
        emp,
        bonusDetails,
        totalBonus,
        deductionDetails,
        totalDeduction,
        groupedServices,
        breakdown,
        splitTotal,
        netSalary
    };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Helper Header - Hidden on Print */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8 print:hidden">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>薪資表下載</h2>
              <p className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-secondary)' }}>檢視並列印員工詳細薪資單</p>
            </div>
            
            <div className="flex gap-4">
                <button 
                  onClick={() => setIsBulkMode(!isBulkMode)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all border cursor-pointer ${isBulkMode ? 'bg-amber-500 border-amber-500 text-black' : 'hover:bg-white/10 glass-panel'}`}
                  style={isBulkMode ? {} : { borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                >
                    <FileText size={16} />
                    <span>{isBulkMode ? '切換回單人檢視' : '一鍵下載全部'}</span>
                </button>

                {!isBulkMode && (
                    <select 
                        value={selectedEmpId || ''}
                        onChange={e => setSelectedEmpId(e.target.value)}
                        className="border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none cursor-pointer glass-panel"
                        style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                    >
                        <option value="" style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}>選擇員工...</option>
                        {employees.map(e => (
                            <option key={e.id} value={e.empId} style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}>{e.empId} - {e.name}</option>
                        ))}
                    </select>
                )}

                {(singleData || (isBulkMode && allData?.length > 0)) && (
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
                        style={{ background: 'var(--text-accent)', boxShadow: '0 10px 20px -10px var(--text-accent)' }}
                    >
                        <Printer size={16} />
                        <span>{isBulkMode ? `列印全體薪資單 (${allData.length})` : '列印 / 下載 PDF'}</span>
                    </button>
                )}
            </div>
        </div>

        {/* Content Area */}
        <div id="salary-slip-root">
             {/* Global Print Style for Bulk */}
             <style>{`
                @media print {
                    @page { size: A4; margin: 10mm; }
                    
                    /* Wrapper for each slip */
                    .salary-slip-page {
                        page-break-after: always;
                        break-after: page;
                        display: block;
                        width: 100%;
                        position: relative;
                        /* Ensure no overflow hiding */
                        overflow: visible;
                    }

                    /* Prevent break after the last page to avoid blank sheet, 
                       but actually for "missing last page" issues, sometimes forced break is safer.
                       Let's try auto for last child. */
                    .salary-slip-page:last-child {
                        page-break-after: auto;
                        break-after: auto;
                    }

                    /* Ensure container flows naturally */
                    html, body, #root, #salary-slip-root {
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                        display: block !important;
                    }
                }
            `}</style>
            
            {isBulkMode ? (
                // BULK MODE
                allData && allData.length > 0 ? (
                    <div>
                        {allData.map((d, i) => (
                             <div key={d.emp.empId} className="salary-slip-page">
                                 <SalarySlipTemplate data={d} isBulk={true} />
                                 {/* Only add margin between slips on screen, not print */}
                                 <div className="h-12 print:hidden"></div> 
                             </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-500">
                        目前無任何員工資料可供列印
                    </div>
                )
            ) : (
                // SINGLE MODE
                singleData ? (
                    <SalarySlipTemplate data={singleData} isBulk={false} />
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 border rounded-[2rem] glass-panel" style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}>
                        <FileText size={48} className="mb-4 opacity-50" />
                        <p className="font-bold">請選擇一位員工以預覽薪資單</p>
                        <p className="text-xs opacity-60 mt-2">或點擊「一鍵下載全部」</p>
                    </div>
                )
            )}
        </div>

    </div>
  );
};

export default SalarySlipDownload;
