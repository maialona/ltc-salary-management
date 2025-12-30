import React from 'react';
import { AlertCircle } from 'lucide-react';

const DebugPanel = ({ debugInfo }) => {
    if (!debugInfo) return null;

    return (
        <div className="mb-4 rounded-lg p-3 shrink-0 flex flex-wrap gap-4 items-center justify-between border shadow-inner" 
             style={{ 
                 background: 'rgba(34, 211, 238, 0.05)', 
                 borderColor: 'rgba(34, 211, 238, 0.2)'
             }}>
            <div className="flex gap-6 items-center flex-wrap text-sm">
                <div className="flex items-center">
                    <span className="text-xs uppercase tracking-wider font-bold opacity-70 mr-2" style={{ color: 'var(--text-secondary)' }}>A碼清冊總額</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>${debugInfo.totalInput.toLocaleString()}</span>
                </div>
                <div className="flex items-center">
                    <span className="text-xs uppercase tracking-wider font-bold opacity-70 mr-2" style={{ color: 'var(--text-secondary)' }}>媒合金額</span>
                    <span className="font-mono font-bold text-emerald-500">${debugInfo.totalAllocated.toLocaleString()}</span>
                </div>
                <div className="flex items-center">
                    <span className="text-xs uppercase tracking-wider font-bold opacity-70 mr-2" style={{ color: 'var(--text-secondary)' }}>差異</span>
                    <span className={`font-mono font-bold ${Math.abs(debugInfo.totalAllocated - debugInfo.totalInput) > 5 ? 'text-red-500' : 'opacity-40'}`}
                          style={{ color: Math.abs(debugInfo.totalAllocated - debugInfo.totalInput) <= 5 ? 'var(--text-secondary)' : undefined }}>
                        ${Math.round(debugInfo.totalAllocated - debugInfo.totalInput).toLocaleString()}
                    </span>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="flex items-center px-3 py-1 rounded-full" style={{ background: 'rgba(34, 211, 238, 0.1)' }}>
                    <span className="text-xs uppercase tracking-wider font-bold mr-2 text-cyan-500">拆帳薪資總額</span>
                    <span className="font-mono font-bold text-cyan-500 text-lg leading-none">${Math.round(debugInfo.totalCommissionPaid).toLocaleString()}</span>
                </div>
                {Math.abs(debugInfo.totalAllocated - debugInfo.totalInput) > 100 && (
                    <div className="text-xs text-red-500 flex items-center animate-pulse font-bold bg-red-500/10 px-2 py-1 rounded">
                        <AlertCircle className="w-3 h-3 mr-1" /> 營收媒合差異過大
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebugPanel;
