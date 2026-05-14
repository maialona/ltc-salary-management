import React from 'react';

const StepWizard = ({ step }) => {
    return (
        <div className="flex justify-center items-center mb-8">
            <div className={`flex items-center font-bold ${step >= 1 ? 'opacity-100' : 'opacity-40'}`} style={{ color: step >= 1 ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                <div className="w-6 h-6 rounded border-2 border-current flex items-center justify-center mr-2 text-xs">1</div>
                上傳檔案
            </div>
            <div className="w-12 h-px mx-3" style={{ background: 'var(--glass-border)' }}></div>
            <div className={`flex items-center font-bold ${step >= 2 ? 'opacity-100' : 'opacity-40'}`} style={{ color: step >= 2 ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                <div className="w-6 h-6 rounded border-2 border-current flex items-center justify-center mr-2 text-xs">2</div>
                系統運算
            </div>
            <div className="w-12 h-px mx-3" style={{ background: 'var(--glass-border)' }}></div>
            <div className={`flex items-center font-bold ${step >= 3 ? 'opacity-100' : 'opacity-40'}`} style={{ color: step >= 3 ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                <div className="w-6 h-6 rounded border-2 border-current flex items-center justify-center mr-2 text-xs">3</div>
                下載結果
            </div>
        </div>
    );
};

export default StepWizard;
