import React from 'react';

const Sidebar = ({ summaryResult, selectedWorker, setSelectedWorker }) => {
    return (
        <div className="w-1/4 min-w-[200px] border-r overflow-y-auto" 
             style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
            {summaryResult.map((staff, idx) => (
                <div 
                    key={idx} 
                    onClick={() => setSelectedWorker(staff.name)}
                    className={`p-3 border-b cursor-pointer transition flex items-center justify-between ${
                        selectedWorker === staff.name 
                        ? 'border-l-4' 
                        : 'hover:bg-white/5'
                    }`}
                    style={{ 
                        borderColor: 'var(--glass-border)', 
                        background: selectedWorker === staff.name ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                        borderLeftColor: selectedWorker === staff.name ? 'var(--text-accent)' : 'transparent'
                    }}
                >
                    <div className="flex items-center overflow-hidden">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-2 shrink-0 ${
                            selectedWorker === staff.name 
                            ? 'text-white' 
                            : 'text-gray-300'
                        }`}
                        style={{ background: selectedWorker === staff.name ? 'var(--text-accent)' : 'rgba(255,255,255,0.1)' }}>
                            {staff.id || staff.name[0]}
                        </div>
                        <div className="truncate">
                            <div className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{staff.name}</div>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{staff.id}</div>
                        </div>
                    </div>
                    <div className="text-xs font-bold ml-2" style={{ color: 'var(--text-accent)' }}>
                        ${staff.totalCommission.toLocaleString()}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Sidebar;
