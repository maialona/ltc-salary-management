import React from 'react';
import { AlertCircle } from 'lucide-react';

const DebugPanel = ({ debugInfo }) => {
    if (!debugInfo) return null;

    const summaryItems = [
        {
            label: 'A碼清冊總額',
            value: debugInfo.totalInput,
            colorClass: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
            labelColor: '#4fa1ff',
            textColor: 'text-blue-400'
        },
        {
            label: '媒合金額',
            value: debugInfo.totalAllocated,
            colorClass: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
            labelColor: '#00d491',
            textColor: 'text-emerald-400'
        },
        {
            label: '拆帳薪資總額',
            value: debugInfo.totalCommissionPaid,
            colorClass: 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/20',
            labelColor: '#c27aff',
            textColor: 'text-purple-400'
        },
        {
            label: '差異',
            value: debugInfo.totalAllocated - debugInfo.totalInput,
            colorClass: 'from-orange-500/20 to-orange-500/5 text-orange-400 border-orange-500/20',
            labelColor: '#ff8904',
            textColor: 'text-orange-400',
            isDiff: true
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {summaryItems.map((item, idx) => (
                <div key={idx} className={`relative p-6 rounded-[2rem] bg-gradient-to-br border ${item.colorClass.split(' ').pop()} overflow-hidden`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.colorClass.split(' ').slice(0, 2).join(' ')} opacity-50`}></div>
                    <div className="relative z-10">
                        <div className="text-sm font-bold mb-2 tracking-widest" style={{ color: item.labelColor }}>{item.label}</div>
                        <div className={`text-2xl font-mono font-bold ${item.textColor}`}>
                            ${Math.round(item.value).toLocaleString()}
                        </div>
                        {item.isDiff && Math.abs(item.value) > 5 && (
                             <div className="absolute top-4 right-4 animate-pulse text-red-500">
                                <AlertCircle size={20} />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DebugPanel;
