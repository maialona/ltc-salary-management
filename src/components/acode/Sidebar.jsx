import React from 'react';

const Sidebar = ({ summaryResult, selectedWorker, setSelectedWorker }) => {
    return (
        <div className="w-1/4 min-w-[200px] border-r overflow-y-auto" 
             style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
            {summaryResult.map((staff, idx) => {
                const isActive = selectedWorker === staff.name;
                return (
                    <div 
                        key={idx} 
                        onClick={() => setSelectedWorker(staff.name)}
                        className={`p-4 border-b cursor-pointer transition-all flex items-center justify-between group ${
                            isActive 
                            ? 'bg-blue-50 dark:bg-cyan-900/20 border-l-4 border-l-blue-600 dark:border-l-cyan-400' 
                            : 'hover:bg-gray-50 dark:hover:bg-white/5 border-l-4 border-l-transparent'
                        }`}
                        style={{ 
                            borderColor: 'var(--glass-border)',
                            // Remove inline background/border overrides to let classes handle it
                        }}
                    >
                        <div className="flex items-center overflow-hidden">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mr-3 shrink-0 transition-colors ${
                                isActive 
                                ? 'bg-blue-600 text-white dark:bg-cyan-500 dark:text-black' 
                                : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400 group-hover:bg-white group-hover:text-blue-600 dark:group-hover:text-cyan-300'
                            }`}>
                                {staff.id || staff.name[0]}
                            </div>
                            <div className="truncate">
                                <div className={`font-bold text-sm truncate transition-colors ${isActive ? 'text-blue-900 dark:text-cyan-100' : ''}`} style={{ color: isActive ? undefined : 'var(--text-primary)' }}>{staff.name}</div>
                            </div>
                        </div>
                        <div className={`text-xs font-bold ml-2 font-mono ${isActive ? 'text-blue-600 dark:text-cyan-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            ${staff.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Sidebar;
