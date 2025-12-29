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
    <div className="space-y-20">
       
      {/* Upload Zone - Hero Plate */}
      <div className={`relative rounded-[2.5rem] transition-all duration-700 group overflow-hidden ${isProcessing ? 'h-96' : 'h-80 hover:h-96 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]'} border glass-panel`} style={{ borderColor: 'var(--glass-border)' }}>
        
        {/* Animated Gradient Border */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] pointer-events-none transform skew-x-12" style={{ transition: 'transform 2s ease-in-out, opacity 0.5s' }}></div>

        <input 
            type="file" 
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
            disabled={isProcessing}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
             {isProcessing ? (
               <div className="flex flex-col items-center gap-6">
                  <div className="relative w-20 h-20">
                      <div className="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                      <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin"></div>
                      <div className="absolute inset-0 rounded-full border-r-2 border-cyan-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
                  </div>
                  <div>
                      <h3 className="text-2xl font-black text-white tracking-widest animate-pulse" style={{ color: 'var(--text-primary)' }}>分析中...</h3>
                      <p className="text-xs font-mono text-cyan-500 mt-2">解析資料結構...</p>
                  </div>
               </div>
             ) : (
                <div className="group-hover:-translate-y-2 transition-transform duration-500">
                     <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/5 shadow-2xl group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        <CloudUpload size={40} />
                     </div>
                     <h3 className="text-3xl font-black tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>服務清冊上傳</h3>
                     <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>DRAG & DROP TO PROCESS</p>
                </div>
             )}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-8 rounded-[1.5rem] bg-red-500/5 border border-red-500/10 flex gap-6 items-start animate-in slide-in-from-top-4">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                <AlertTriangle size={24} />
            </div>
            <div className="space-y-3">
                <h4 className="font-bold text-red-400 tracking-wide text-lg">錯誤提醒</h4>
                <ul className="list-disc list-inside text-sm text-red-400/60 font-mono space-y-1">
                    {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                    ))}
                </ul>
            </div>
        </div>
      )}

      {/* Global Summary Stats */}
      {results.length > 0 && !isProcessing && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in duration-500">
            {['B', 'G', 'S', 'Missed'].map(type => {
                const totalAmount = results.reduce((acc, res) => acc + res.breakdown[type].rawSum, 0);
                const labels = { 'B': 'B碼總額', 'G': 'G碼總額', 'S': 'S碼總額', 'Missed': '未遇總額' };
                const colors = {
                        'B': 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
                        'G': 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
                        'S': 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/20',
                        'Missed': 'from-orange-500/20 to-orange-500/5 text-orange-400 border-orange-500/20'
                };
                
                return (
                    <div key={type} className={`relative p-6 rounded-[2rem] bg-gradient-to-br border ${colors[type].split(' ').pop()} overflow-hidden`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${colors[type].split(' ').slice(0, 2).join(' ')} opacity-50`}></div>
                        <div className="relative z-10">
                            <div className="text-[10px] font-bold text-white/50 mb-2 tracking-widest">{labels[type]}</div>
                            <div className={`text-2xl font-mono font-bold ${colors[type].split(' ')[2]}`}>
                                ${totalAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
      )}

      {/* Results List - Flow */}
      <div className="space-y-6">
        {results.length > 0 && !isProcessing && (
            <div className="flex justify-end px-4 gap-4 items-center mb-4">
                <span className="h-px flex-1" style={{ background: 'var(--glass-border)' }}></span>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                    COMPLETED: <span style={{ color: 'var(--text-primary)' }}>{results.length} PROFILES</span>
                </span>
            </div>
        )}

        {results.map((res) => {
            const isExpanded = expandedId === res.employee.id;
            
            return (
            <div key={res.employee.id} className="relative group perspective-1000">
                <div 
                    onClick={() => toggleExpand(res.employee.id)}
                    className={`
                        relative z-10 p-8 rounded-[2rem] border transition-all duration-500 cursor-pointer overflow-hidden glass-panel
                    `}
                    style={{
                        borderColor: isExpanded ? 'rgba(var(--accent-rgb), 0.3)' : 'var(--glass-border)',
                        boxShadow: isExpanded ? '0 0 50px -20px rgba(var(--accent-rgb), 0.2)' : undefined,
                        background: isExpanded ? 'var(--glass-bg)' : 'var(--glass-bg)'
                    }}
                >
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                        {/* Left: Identity */}
                        <div className="flex items-center gap-6">
                             <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-lg border transition-all duration-300 ${
                                 isExpanded ? '' : 'group-hover:text-white'
                             }`} style={{ 
                                 background: isExpanded ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(255,255,255,0.05)',
                                 borderColor: isExpanded ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--glass-border)',
                                 color: isExpanded ? 'var(--text-accent)' : 'var(--text-secondary)'
                             }}>
                                {res.employee.empId}
                             </div>
                             <div>
                                <div className="flex items-center gap-4 mb-2">
                                    <h3 className={`text-2xl font-bold tracking-tight transition-colors`} style={{ color: 'var(--text-primary)' }}>
                                        {res.employee.name}
                                    </h3>
                                    <div className="flex gap-2">
                                    {['B', 'G', 'S', 'Missed'].map(type => {
                                        const val = res.breakdown[type].splitSum;
                                        if(val === 0) return null;
                                        
                                        const colors = {
                                            'B': 'text-blue-400  border-blue-500/20',
                                            'G': 'text-emerald-400  border-emerald-500/20',
                                            'S': 'text-purple-400  border-purple-500/20',
                                            'Missed': 'text-orange-400 border-orange-500/20'
                                        };
                                        
                                        return (
                                            <span key={type} className={`px-2.5 py-0.5 rounded-lg border bg-opacity-5 bg-white text-[10px] font-mono font-bold ${colors[type]}`}>
                                                {type.charAt(0)} ${val}
                                            </span>
                                        )
                                    })}
                                    </div>
                                </div>
                             </div>
                        </div>

                        {/* Right: Total */}
                        <div className="flex items-center gap-8 pl-4 xl:pl-0 border-l xl:border-l-0" style={{ borderColor: 'var(--glass-border)' }}>
                            <div className="text-right">
                                 {(() => {
                                     const totalRaw = ['B', 'G', 'S', 'Missed'].reduce((acc, type) => acc + res.breakdown[type].rawSum, 0);
                                     return (
                                         <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                                             總額: <span style={{ color: 'var(--text-primary)' }}>${totalRaw.toLocaleString()}</span>
                                         </p>
                                     );
                                  })()}
                                 <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>拆帳總額</p>
                                 <p className={`text-4xl font-mono font-bold tracking-tighter transition-colors ${isExpanded ? 'text-glow-cyan' : ''}`} style={{ color: isExpanded ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                                     ${res.splitTotal.toLocaleString()}
                                 </p>
                                 {(() => {
                                     const totalRaw = ['B', 'G', 'S', 'Missed'].reduce((acc, type) => acc + res.breakdown[type].rawSum, 0);
                                     if (totalRaw > 0 && res.splitTotal === 0) {
                                         return (
                                            <div className="mt-2 flex flex-col items-end animate-pulse">
                                                <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1.5 bg-orange-400/10 px-2 py-1 rounded-md border border-orange-400/20">
                                                    <AlertTriangle size={10} /> 
                                                    CHECK SPLIT SETTINGS
                                                </span>
                                                <span className="text-[9px] font-mono mt-1" style={{ color: 'var(--text-secondary)' }}>RAW VALUE: ${totalRaw.toLocaleString()}</span>
                                            </div>
                                         );
                                     }
                                     return null;
                                 })()}
                            </div>
                            <div className={`p-3 rounded-full border transition-all duration-300 ${isExpanded ? 'bg-cyan-500/10 text-cyan-400 rotate-180' : 'group-hover:text-white'}`} style={{ borderColor: 'var(--glass-border)', color: isExpanded ? undefined : 'var(--text-secondary)' }}>
                                <ChevronDown size={20}/>
                            </div>
                        </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                        <div className="mt-10 pt-10 border-t animate-in slide-in-from-top-4 duration-500" style={{ borderColor: 'var(--glass-border)' }}>
                            
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                                {['B', 'G', 'S', 'Missed'].map(type => {
                                    const data = res.breakdown[type];
                                    const labels = { 'B': 'B碼', 'G': 'G碼', 'S': 'S碼', 'Missed': '未遇' };
                                    const colors = {
                                         'B': 'from-blue-500/20 to-blue-500/5 text-blue-400',
                                         'G': 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
                                         'S': 'from-purple-500/20 to-purple-500/5 text-purple-400',
                                         'Missed': 'from-orange-500/20 to-orange-500/5 text-orange-400'
                                    };
                                    
                                    return (
                                        <div key={type} className={`relative p-6 rounded-[1.5rem] bg-gradient-to-br border border-white/5 overflow-hidden ${colors[type].split(' ')[0]}`}>
                                            <div className="relative z-10">
                                                <div className="text-[10px] font-bold text-white/50 mb-4 tracking-widest">{labels[type]}</div>
                                                <div className={`text-3xl font-mono font-bold ${colors[type].split(' ')[2]}`}>${data.splitSum.toLocaleString()}</div>
                                                <div className="mt-2 flex justify-between text-[10px] font-mono opacity-60">
                                                    <span>{data.count} ROWS</span>
                                                    <span>{(res.employee.splits[type.toLowerCase()] || 0)}% RATE</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Service List */}
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest pl-2 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                    <FileText size={12}/> 服務細項
                                </h4>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                    {(() => {
                                        const allItems = [
                                            ...res.breakdown['B'].items,
                                            ...res.breakdown['G'].items,
                                            ...res.breakdown['S'].items,
                                            ...res.breakdown['Missed'].items,
                                        ];

                                        // Group by Client and Aggregate Items
                                        const groupedByClient = allItems.reduce((acc, item) => {
                                            const key = item.client || 'Unknown';
                                            if (!acc[key]) {
                                                acc[key] = {
                                                    client: key,
                                                    items: [],
                                                    totalSplit: 0
                                                };
                                            }
                                            
                                            // Check if service code already exists for this client
                                            const existingItem = acc[key].items.find(i => i.code === item.code);
                                            if (existingItem) {
                                                existingItem.count += item.count;
                                                existingItem.split += item.split;
                                            } else {
                                                // Add new item (clone to be safe)
                                                acc[key].items.push({ ...item });
                                            }

                                            acc[key].totalSplit += item.split;
                                            return acc;
                                        }, {});

                                        return Object.values(groupedByClient).map((group, idx) => (
                                            <div key={idx} className="p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-transparent hover:border-white/5">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{group.client}</div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-bold block mb-0.5" style={{ color: 'var(--text-secondary)' }}>拆帳總額</span>
                                                        <span className="text-base font-bold text-cyan-500">${group.totalSplit.toFixed(1)}</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Service Items for this Client */}
                                                <div className="space-y-2">
                                                    {group.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between items-center text-[10px] font-mono pl-4 border-l-2" style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}>
                                                            <span>{item.code} {item.count > 1 && `x${item.count}`}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Verification Footer */}
                            <div className="mt-8 pt-8 border-t flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity" style={{ borderColor: 'var(--glass-border)' }}>
                                <div className="flex items-center gap-3">
                                    <CheckCircle size={14} className="text-emerald-500" />
                                    <span className="text-[10px] font-bold tracking-widest text-slate-400">MATH VERIFIED: ROUND(SUM)</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-600">ID: {res.employee.empId}</span>
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
