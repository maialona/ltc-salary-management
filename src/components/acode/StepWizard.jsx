import React from 'react';

const StepWizard = ({ step }) => {
    return (
        <div className="flex justify-center items-center mb-8">
            <div className={`flex items-center font-bold ${step >= 1 ? 'opacity-100' : 'opacity-40'}`} style={{ color: step >= 1 ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mr-2">1</div>
                上傳檔案
            </div>
            <div className="w-16 h-1 mx-4 rounded-full" style={{ background: 'var(--glass-border)' }}></div>
            <div className={`flex items-center font-bold ${step >= 2 ? 'opacity-100' : 'opacity-40'}`} style={{ color: step >= 2 ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mr-2">2</div>
                系統運算
            </div>
            <div className="w-16 h-1 mx-4 rounded-full" style={{ background: 'var(--glass-border)' }}></div>
            <div className={`flex items-center font-bold ${step >= 3 ? 'opacity-100' : 'opacity-40'}`} style={{ color: step >= 3 ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mr-2">3</div>
                下載結果
            </div>
        </div>
    );
};

export default StepWizard;
