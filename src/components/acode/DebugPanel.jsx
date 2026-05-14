import React from 'react';
import { AlertCircle } from 'lucide-react';

const DebugPanel = ({ debugInfo }) => {
    if (!debugInfo) return null;

    const diff = debugInfo.totalAllocated - debugInfo.totalInput;
    const hasDiffError = Math.abs(diff) > 5;

    const summaryItems = [
        { label: 'A碼清冊總額', value: debugInfo.totalInput },
        { label: '媒合金額', value: debugInfo.totalAllocated },
        { label: '拆帳薪資總額', value: debugInfo.totalCommissionPaid },
        { label: '差異', value: diff, isDiff: true },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {summaryItems.map((item, idx) => (
                <div key={idx} className="relative p-5 rounded-md border glass-panel"
                     style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                    <p className="text-xl font-mono font-semibold" style={{ color: item.isDiff && hasDiffError ? '#f87171' : 'var(--text-primary)' }}>
                        ${Math.round(item.value).toLocaleString()}
                    </p>
                    {item.isDiff && hasDiffError && (
                        <div className="absolute top-4 right-4 text-red-400 animate-pulse">
                            <AlertCircle size={16} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default DebugPanel;
