import React, { useState } from 'react';
import { Upload, AlertTriangle, ChevronDown, ChevronUp, CloudUpload, Calculator, CheckCircle, FileText } from 'lucide-react';
import { parseServiceRecordExcel } from '../utils/excelParser';
import { processSalaryCalculation } from '../utils/calculator';
import { getEmployees } from '../data/employeeStore';
import { saveRecords } from '../data/recordsStore';

const RecordsProcessing = () => {
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Restore state on mount
  React.useEffect(() => {
    try {
        const savedState = localStorage.getItem('bgs_calc_state');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.results && parsed.results.length > 0) {
                setResults(parsed.results);
                if (parsed.warnings) setWarnings(parsed.warnings);
            }
        }
    } catch (e) {
        console.error("Failed to restore BGS state", e);
    }
  }, []);

  // Save state when results update
  React.useEffect(() => {
    if (results.length > 0) {
        try {
            localStorage.setItem('bgs_calc_state', JSON.stringify({
                results,
                warnings
            }));
        } catch (e) {
            console.error("BGS Auto-save failed:", e);
            if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                 // Use basic alert or just log, since we don't have a modal helper here easily accessible unless we add one
                 // But we have 'warnings' state we can use!
                 setWarnings(prev => [...prev, "系統警告：資料量過大超出瀏覽器限制 (5MB)，本次計算結果將無法於關閉後自動還原。"]);
            }
        }
    }
  }, [results, warnings]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset loop
    e.target.value = null;

    setIsProcessing(true);
    setResults([]);
    setWarnings([]);

    // Artificial delay for UX
    setTimeout(async () => {
      try {
         const rawData = await parseServiceRecordExcel(file);
         const employees = getEmployees();
         
         if (!rawData || rawData.length === 0) {
            throw new Error('Excel 檔案似乎是空的或無法讀取');
         }

         const { results: calcResults, warnings: calcWarnings } = processSalaryCalculation(rawData, employees);
         
         if (calcResults.length === 0) {
             setWarnings(prev => [...prev, ...calcWarnings, '未找到符合的薪資資料。請確認 Excel 欄位名稱是否正確 (需包含: 服務員, 服務項目, 金額 等)']);
         } else {
             setWarnings(calcWarnings);
             
             // Auto-save calculated splits to store
             const recordsToSave = calcResults.map(res => ({
                 empId: res.employee.empId,
                 b: res.breakdown['B'].splitSum,
                 g: res.breakdown['G'].splitSum,
                 s: res.breakdown['S'].splitSum,
                 missed: res.breakdown['Missed'].splitSum,
                 // Save full breakdown for detailed slip generation
                 breakdown: res.breakdown 
             }));
             saveRecords(recordsToSave);
         }

         setResults(calcResults);
      } catch (err) {
         console.error(err);
         setWarnings([`處理失敗: ${err.message}`]);
      } finally {
         setIsProcessing(false);
      }
    }, 1500);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-8">

      {/* Upload Zone */}
      <div className={`relative rounded-md border transition-all duration-300 glass-panel ${isProcessing ? 'h-52' : 'h-40 hover:h-52'}`} style={{ borderColor: 'var(--glass-border)', borderStyle: 'dashed' }}>
        <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
            disabled={isProcessing}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
             {isProcessing ? (
               <div className="flex flex-col items-center gap-4">
                  <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'var(--glass-border)' }}></div>
                      <div className="absolute inset-0 rounded-full border-t-2 border-zinc-400 animate-spin"></div>
                  </div>
                  <div>
                      <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>分析中...</h3>
                      <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>解析資料結構</p>
                  </div>
               </div>
             ) : (
                <div>
                     <div className="w-10 h-10 rounded-md flex items-center justify-center mx-auto mb-3 border" style={{ background: 'var(--accordion-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        <CloudUpload size={18} />
                     </div>
                     <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>服務清冊上傳</h3>
                     <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>拖曳或點擊選擇 Excel 檔案</p>
                </div>
             )}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-4 rounded-md bg-red-500/5 border border-red-500/20 flex gap-3 items-start animate-in slide-in-from-top-4">
            <div className="p-1.5 bg-red-500/10 rounded-md text-red-500 shrink-0">
                <AlertTriangle size={16} />
            </div>
            <div>
                <h4 className="font-medium text-red-400 text-sm mb-1">錯誤提醒</h4>
                <ul className="list-disc list-inside text-xs text-red-400/70 font-mono space-y-0.5">
                    {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                    ))}
                </ul>
            </div>
        </div>
      )}

      {/* Global Summary Stats */}
      {results.length > 0 && !isProcessing && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 animate-in fade-in duration-300">
            {['B', 'G', 'S', 'Missed', 'SelfPay'].map(type => {
                const totalAmount = type === 'SelfPay'
                    ? results.reduce((acc, res) => acc + (
                        res.breakdown['B'].selfPaySum +
                        res.breakdown['G'].selfPaySum +
                        res.breakdown['S'].selfPaySum
                      ), 0)
                    : results.reduce((acc, res) => acc + res.breakdown[type].rawSum, 0);

                const labels = { 'B': 'B碼總額', 'G': 'G碼總額', 'S': 'S碼總額', 'Missed': '未遇總額', 'SelfPay': '自費總額' };
                const textColors = {
                    'B': 'text-blue-500', 'G': 'text-emerald-500', 'S': 'text-purple-500',
                    'Missed': 'text-orange-500', 'SelfPay': 'text-pink-500'
                };

                return (
                    <div key={type} className="p-4 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{labels[type]}</div>
                        <div className={`text-lg font-mono font-semibold ${textColors[type]}`}>
                            ${totalAmount.toLocaleString()}
                        </div>
                    </div>
                )
            })}
        </div>
      )}

      {/* Results List */}
      <div className="space-y-2">
        {results.length > 0 && !isProcessing && (
            <div className="flex items-center gap-3 mb-2">
                <span className="h-px flex-1" style={{ background: 'var(--glass-border)' }}></span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    共 {results.length} 筆
                </span>
            </div>
        )}

        {results.map((res) => {
            const isExpanded = expandedId === res.employee.id;

            return (
            <div key={res.employee.id} className="relative">
                <div
                    onClick={() => toggleExpand(res.employee.id)}
                    className="relative rounded-md border transition-all duration-200 cursor-pointer glass-panel"
                    style={{
                        borderColor: isExpanded ? 'var(--text-accent)' : 'var(--glass-border)',
                    }}
                >
                    <div className="px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        {/* Left: Identity */}
                        <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-md flex items-center justify-center font-medium text-sm border"
                                style={{
                                    background: 'var(--emp-icon-bg)',
                                    borderColor: 'var(--glass-border)',
                                    color: 'var(--emp-icon-text)'
                                }}>
                                {res.employee.empId}
                             </div>
                             <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                        {res.employee.name}
                                    </h3>
                                    <div className="flex gap-1.5">
                                    {['B', 'G', 'S', 'Missed'].map(type => {
                                        const val = res.breakdown[type].splitSum;
                                        if(val === 0) return null;

                                        const colors = {
                                            'B': 'text-blue-500 border-blue-500/20',
                                            'G': 'text-emerald-500 border-emerald-500/20',
                                            'S': 'text-purple-500 border-purple-500/20',
                                            'Missed': 'text-orange-500 border-orange-500/20'
                                        };

                                        return (
                                            <span key={type} className={`px-1.5 py-0.5 rounded border text-xs font-mono ${colors[type]}`}>
                                                {type.charAt(0)} ${val}
                                            </span>
                                        )
                                    })}
                                    </div>
                                </div>
                             </div>
                        </div>

                        {/* Right: Total */}
                        <div className="flex items-center gap-6 pl-4 xl:pl-0 border-l xl:border-l-0" style={{ borderColor: 'var(--glass-border)' }}>
                            <div className="flex items-end gap-5 text-right">
                                 {(() => {
                                     const totalRaw = ['B', 'G', 'S', 'Missed'].reduce((acc, type) => acc + res.breakdown[type].rawSum, 0);
                                     return (
                                         <>
                                            <div className="hidden sm:block">
                                                <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>總額</p>
                                                <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>${totalRaw.toLocaleString()}</p>
                                            </div>

                                            <div>
                                                <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>拆帳總額</p>
                                                <p className="text-xl font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    ${res.splitTotal.toLocaleString()}
                                                </p>
                                            </div>

                                            {totalRaw > 0 && res.splitTotal === 0 && (
                                                <span className="text-xs text-orange-500 flex items-center gap-1 border border-orange-500/20 px-2 py-1 rounded-md">
                                                    <AlertTriangle size={10} /> 檢查拆帳設定
                                                </span>
                                            )}
                                         </>
                                     );
                                  })()}
                            </div>
                            <div
                                className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <ChevronDown size={16}/>
                            </div>
                        </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                        <div className="px-5 pb-5 pt-4 border-t animate-in fade-in duration-200" style={{ borderColor: 'var(--glass-border)' }}>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                {['B', 'G', 'S', 'Missed'].map(type => {
                                    const data = res.breakdown[type];
                                    const labels = { 'B': 'B碼', 'G': 'G碼', 'S': 'S碼', 'Missed': '未遇' };
                                    const textColors = {
                                        'B': 'text-blue-500', 'G': 'text-emerald-500',
                                        'S': 'text-purple-500', 'Missed': 'text-orange-500'
                                    };

                                    return (
                                        <div key={type} className="p-4 rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                                            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>{labels[type]}</div>
                                            <div className={`text-xl font-mono font-semibold ${textColors[type]}`}>${data.splitSum.toLocaleString()}</div>
                                            <div className="mt-1.5 flex justify-between text-xs font-mono" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                                                <span>{data.count} 筆</span>
                                                <span>{(res.employee.splits[type.toLowerCase()] || 0)}%</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Service List */}
                            <div>
                                <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                                    <FileText size={11}/> 服務細項
                                </h4>
                                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                                    {(() => {
                                        const allItems = [
                                            ...res.breakdown['B'].items,
                                            ...res.breakdown['G'].items,
                                            ...res.breakdown['S'].items,
                                            ...res.breakdown['Missed'].items,
                                        ];

                                        const groupedByClient = allItems.reduce((acc, item) => {
                                            const key = item.client || 'Unknown';
                                            if (!acc[key]) acc[key] = { client: key, items: [], totalSplit: 0 };

                                            const existingItem = acc[key].items.find(i => i.code === item.code);
                                            if (existingItem) {
                                                existingItem.count += item.count;
                                                existingItem.split += item.split;
                                            } else {
                                                acc[key].items.push({ ...item });
                                            }

                                            acc[key].totalSplit += item.split;
                                            return acc;
                                        }, {});

                                        return Object.values(groupedByClient).map((group, idx) => (
                                            <div key={idx} className="p-3 rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{group.client}</div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>${group.totalSplit.toFixed(1)}</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    {group.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between items-center text-xs font-mono pl-3 border-l" style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}>
                                                            <span>
                                                                {item.code} {item.count > 1 && `×${item.count}`}
                                                                {item.isSelfPay && <span className="ml-2 text-xs px-1 rounded border border-pink-500/20 bg-pink-500/10 text-pink-500">自費</span>}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
            )
        })}
      </div>
    </div>
  );
};

export default RecordsProcessing;
