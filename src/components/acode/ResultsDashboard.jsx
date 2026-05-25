import React, { useState } from 'react';
import { CheckCircle, Download, AlertCircle, ChevronDown, FileText, AlertTriangle } from 'lucide-react';
import DebugPanel from './DebugPanel';
import { downloadExcel } from '../../utils/acode-excel';

const ResultsDashboard = ({
    debugInfo,
    errors,
    summaryResult,
    calculationResult,
    onReset,
    employees = [],
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
                     <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="text-emerald-500 w-5 h-5" />
                        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>計算完成</h2>
                     </div>
                     <p className="text-sm ml-7" style={{ color: 'var(--text-secondary)' }}>A-Code 計算已完成</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={onReset} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-white/5 transition-colors cursor-pointer" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                        重新開始
                    </button>
                    <button onClick={handleDownload} className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
                            style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--btn-primary-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-primary-bg)'}>
                        <Download className="w-5 h-5" />
                        <span>下載結果報表</span>
                    </button>
                </div>
            </div>

            {/* Debug Panel */}
            <DebugPanel debugInfo={debugInfo} />

            {/* Errors */}
            {errors.length > 0 && (
                <div className="p-4 rounded-md bg-red-500/5 border border-red-500/20 flex gap-3 items-start animate-in slide-in-from-top-4">
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
                    const emp = employees.find(e => e.empId === staff.id || e.name === staff.name);
                    const aa09Rate = emp?.splits?.aa09 || 0;
                    const otherRate = emp?.splits?.otherAcode || 0;

                    return (
                        <div key={idx} className="relative group perspective-1000">
                             <div
                                onClick={() => toggleExpand(staff.name)}
                                className="relative rounded-md border transition-all duration-200 cursor-pointer glass-panel"
                                style={{
                                    borderColor: isExpanded ? 'var(--text-accent)' : 'var(--glass-border)',
                                    background: 'var(--glass-bg)'
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
                                            {staff.id || staff.name[0]}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {staff.name}
                                            </h3>
                                            {(aa09Rate > 0 || otherRate > 0) && (
                                                <p className="text-xs mt-0.5 font-mono flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                                    {aa09Rate > 0 && (
                                                        <span>AA09 <span style={{ color: 'var(--text-accent)' }}>{aa09Rate}%</span></span>
                                                    )}
                                                    {otherRate > 0 && (
                                                        <span>其餘A碼 <span style={{ color: 'var(--text-accent)' }}>{otherRate}%</span></span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Total */}
                                    <div className="flex items-center gap-5 pl-4 xl:pl-0 border-l xl:border-l-0" style={{ borderColor: 'var(--glass-border)' }}>
                                        <div className="text-right">
                                            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>本月拆帳總額</p>
                                            <p className="text-xl font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                ${staff.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </p>
                                        </div>
                                        <div
                                            className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            <ChevronDown size={16}/>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content (Formerly WorkerDetail) */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-4 border-t animate-in fade-in duration-200" style={{ borderColor: 'var(--glass-border)' }}>
                                         <h4 className="text-xs font-medium flex items-center gap-1.5 mb-4" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                                            <FileText size={11}/> 服務細項明細
                                        </h4>

                                        <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
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
