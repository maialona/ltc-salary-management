import React from 'react';
import { CheckCircle, Download, AlertCircle } from 'lucide-react';
import Sidebar from './Sidebar';
import WorkerDetail from './WorkerDetail';
import DebugPanel from './DebugPanel';
import { downloadExcel } from '../../utils/acode-excel';

const ResultsDashboard = ({ 
    debugInfo, 
    errors, 
    summaryResult, 
    calculationResult, 
    selectedWorker, 
    setSelectedWorker 
}) => {
    
    const handleDownload = () => {
        downloadExcel(calculationResult, summaryResult, errors, debugInfo);
    };

    return (
        <div className="glass-panel p-6 rounded-xl shadow-md h-[85vh] flex flex-col transition-colors">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-xl font-bold flex items-center" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle className="text-emerald-500 mr-2" /> 計算完成
                </h2>
                <div className="space-x-4">
                    <button onClick={() => window.location.reload()} className="hover:underline text-sm opacity-60 hover:opacity-100" style={{ color: 'var(--text-secondary)' }}>重新開始</button>
                    <button onClick={handleDownload} className="inline-flex items-center px-4 py-2 text-white rounded-lg transition shadow font-bold"
                            style={{ background: 'var(--btn-primary-bg)', boxShadow: 'var(--btn-primary-shadow)' }}>
                        <Download className="mr-2 h-5 w-5" /> 下載結果報表
                    </button>
                </div>
            </div>

            <DebugPanel debugInfo={debugInfo} />

            {errors.length > 0 && (
                <div className="mb-4 bg-red-500/10 border-l-4 border-red-500 p-2 shrink-0">
                    <div className="flex items-center text-red-500 font-bold text-sm">
                        <AlertCircle className="w-4 h-4 mr-2" /> 發現 {errors.length} 筆資料無法媒合
                    </div>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden border rounded-lg" style={{ borderColor: 'var(--glass-border)' }}>
                <Sidebar 
                    summaryResult={summaryResult} 
                    selectedWorker={selectedWorker} 
                    setSelectedWorker={setSelectedWorker} 
                />
                <div className="w-3/4 overflow-y-auto p-6" style={{ background: 'var(--content-bg)' }}>
                    <WorkerDetail staff={summaryResult.find(s => s.name === selectedWorker)} />
                </div>
            </div>
        </div>
    );
};

export default ResultsDashboard;
