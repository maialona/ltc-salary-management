import React, { useState } from 'react';
import { CheckCircle, Download, AlertCircle, ChevronDown, FileText, AlertTriangle } from 'lucide-react';
import DebugPanel from './DebugPanel';
import { downloadExcel } from '../../utils/acode-excel';

const ResultsDashboard = ({ 
    debugInfo, 
    errors, 
    summaryResult, 
    calculationResult, 
    onReset
}) => {
    const [expandedId, setExpandedId] = useState(null);

    const handleDownload = () => {
        downloadExcel(calculationResult, summaryResult, errors, debugInfo);
    };

    const toggleExpand = (name) => {
        setExpandedId(expandedId === name ? null : name);
    };

    return (
        <div className="space-y-12">
            
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
                <div>
                     <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="text-emerald-500 w-8 h-8" /> 
                        <h2 className="text-3xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>計算完成</h2>
                     </div>
                     <p className="font-bold opacity-60 ml-1" style={{ color: 'var(--text-secondary)' }}>A-CODE CALCULATION COMPLETED</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={onReset} className="px-6 py-3 rounded-xl border font-bold hover:bg-white/5 transition-colors cursor-pointer" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        重新開始
                    </button>
                    <button onClick={handleDownload} className="px-6 py-3 rounded-xl text-white font-bold shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
                            style={{ background: 'var(--btn-primary-bg)', boxShadow: 'var(--btn-primary-shadow)' }}>
                        <Download className="w-5 h-5" />
                        <span>下載結果報表</span>
                    </button>
                </div>
            </div>

            {/* Debug Panel */}
            <DebugPanel debugInfo={debugInfo} />

            {/* Errors */}
            {errors.length > 0 && (
                <div className="p-6 rounded-[1.5rem] bg-red-500/5 border border-red-500/10 flex gap-4 items-start animate-in slide-in-from-top-4">
                    <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-red-400 tracking-wide mb-1">發現 {errors.length} 筆資料無法媒合</h4>
                        <p className="text-sm opacity-60 text-red-400">請檢查下載的報表中的 "Errors" 分頁以獲取詳細資訊。</p>
                    </div>
                </div>
            )}

            {/* Results List */}
            <div className="space-y-6">
                 <div className="flex justify-end px-4 gap-4 items-center">
                    <span className="h-px flex-1" style={{ background: 'var(--glass-border)' }}></span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                        CALCULATED: <span style={{ color: 'var(--text-primary)' }}>{summaryResult.length} STAFF</span>
                    </span>
                </div>

                {summaryResult.map((staff, idx) => {
                    const isExpanded = expandedId === staff.name;
                    
                    return (
                        <div key={idx} className="relative group perspective-1000">
                             <div 
                                onClick={() => toggleExpand(staff.name)}
                                className={`
                                    relative z-10 p-8 rounded-[2rem] border transition-all duration-500 cursor-pointer overflow-hidden glass-panel
                                `}
                                style={{
                                    borderColor: isExpanded ? 'rgba(var(--accent-rgb), 0.3)' : 'var(--glass-border)',
                                    boxShadow: isExpanded ? '0 0 50px -20px rgba(var(--accent-rgb), 0.2)' : undefined,
                                    background: 'var(--glass-bg)'
                                }}
                            >
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                                    {/* Left: Identity */}
                                    <div className="flex items-center gap-6">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-lg border transition-all duration-300 ${
                                            isExpanded ? '' : 'group-hover:text-white'
                                        }`} style={{ 
                                            background: isExpanded ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--emp-icon-bg)', // Use theme var
                                            borderColor: isExpanded ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--glass-border)',
                                            color: isExpanded ? 'var(--text-accent)' : 'var(--emp-icon-text)' // Use theme var
                                        }}>
                                            {staff.id || staff.name[0]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-4 mb-2">
                                                <h3 className="text-2xl font-bold tracking-tight transition-colors" style={{ color: 'var(--text-primary)' }}>
                                                    {staff.name}
                                                </h3>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Total */}
                                    <div className="flex items-center gap-8 pl-4 xl:pl-0 border-l xl:border-l-0" style={{ borderColor: 'var(--glass-border)' }}>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-accent)' }}>本月拆帳總額</p>
                                            <p className={`text-4xl font-mono font-bold tracking-tighter transition-colors ${isExpanded ? 'text-glow-cyan' : ''}`} style={{ color: isExpanded ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                                                ${staff.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </p>
                                        </div>
                                        <div 
                                            className={`p-3 rounded-full border transition-all duration-300 ${isExpanded ? 'rotate-180' : 'group-hover:text-white'}`} 
                                            style={{ 
                                                borderColor: 'var(--glass-border)', 
                                                background: isExpanded ? 'var(--expand-btn-bg)' : undefined,
                                                color: isExpanded ? 'var(--expand-btn-text)' : 'var(--text-secondary)'
                                            }}
                                        >
                                            <ChevronDown size={20}/>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content (Formerly WorkerDetail) */}
                                {isExpanded && (
                                    <div className="mt-10 pt-10 border-t animate-in slide-in-from-top-4 duration-500" style={{ borderColor: 'var(--glass-border)' }}>
                                         <h4 className="text-[10px] font-bold uppercase tracking-widest pl-2 flex items-center gap-2 mb-6" style={{ color: 'var(--text-secondary)' }}>
                                            <FileText size={12}/> 服務細項明細
                                        </h4>

                                        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                                            <table className="min-w-full text-sm text-left">
                                                <thead className="text-xs uppercase font-bold" style={{ background: 'var(--table-header-bg)', color: 'var(--table-header-text)' }}>
                                                    <tr>
                                                        <th className="px-6 py-4">服務個案</th>
                                                        <th className="px-6 py-4">督導</th>
                                                        <th className="px-6 py-4">服務代碼</th>
                                                        <th className="px-6 py-4 text-right">數量</th>
                                                        <th className="px-6 py-4 text-right">小計</th>
                                                        <th className="px-6 py-4 text-right">拆帳金額</th>
                                                    </tr>
                                                </thead>
                                                <tbody style={{ borderTop: '1px solid var(--glass-border)' }}>
                                                    {staff.details.map((detail, dIdx) => (
                                                        <tr key={dIdx} className="hover:bg-white/5 transition" 
                                                            style={{ 
                                                                transition: 'background-color 0.2s',
                                                                borderBottom: '1px solid var(--glass-border)'
                                                            }}>
                                                            <td className="px-6 py-4 font-bold" style={{ color: 'var(--text-primary)' }}>{detail.client}</td>
                                                            <td className="px-6 py-4" style={{ color: 'var(--text-secondary)' }}>{detail.supervisor}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-xs font-bold px-2 py-1 rounded-md border" 
                                                                      style={{ background: 'rgba(0,0,0,0.05)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}>
                                                                    {detail.code}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{Number(detail.qty).toFixed(2)}</td>
                                                            <td className="px-6 py-4 text-right font-mono opacity-60" style={{ color: 'var(--text-secondary)' }}>${Math.round(detail.subtotal).toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-right font-bold font-mono text-base" style={{ color: 'var(--text-accent)' }}>${detail.amount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ResultsDashboard;
