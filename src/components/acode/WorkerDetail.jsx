import React from 'react';

const WorkerDetail = ({ staff }) => {
    if (!staff) {
        return (
            <div className="h-full flex items-center justify-center opacity-40">
                <span style={{ color: 'var(--text-secondary)' }}>請從左側選擇人員查看詳細資料</span>
            </div>
        );
    }

    return (
        <div style={{ color: 'var(--text-primary)' }}>
            <div className="flex justify-between items-end mb-6 pb-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <div className="flex items-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mr-4 shadow-lg text-white"
                         style={{ background: 'var(--btn-primary-bg)', boxShadow: 'var(--btn-primary-shadow)' }}>
                        {staff.id || staff.name[0]}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{staff.name}</h2>
                        <p className="font-mono opacity-60" style={{ color: 'var(--text-secondary)' }}>員編: {staff.id || '未設定'}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm mb-1 font-bold" style={{ color: 'var(--text-secondary)' }}>本月總拆帳金額</p>
                    <p className="text-4xl font-black text-emerald-500 font-mono tracking-tight">${staff.totalCommission.toLocaleString()}</p>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border-0 shadow-sm" style={{ background: 'var(--glass-bg)' }}>
                <table className="min-w-full text-sm text-left">
                    <thead className="text-xs uppercase font-bold" style={{ background: 'var(--accordion-bg)', color: 'var(--text-secondary)' }}>
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
                                <td className="px-6 py-4 text-right font-bold text-emerald-500 font-mono text-base">${Math.round(detail.amount).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WorkerDetail;
