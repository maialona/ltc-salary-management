import React from 'react';
import { Upload, FileSpreadsheet, FileCheck, Users, Calculator } from 'lucide-react';
import { readExcel } from '../../utils/acode-excel';

const FileUpload = ({ files, setFiles, fileStatus, setFileStatus, setFileHeaders, onProcess, isProcessing, progressText, showAlert }) => {
    
    const handleFileChange = async (e, type) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const { headers } = await readExcel(file);
                setFiles(prev => ({ ...prev, [type]: file }));
                setFileStatus(prev => ({ ...prev, [type]: true }));
                setFileHeaders(prev => ({ ...prev, [type]: headers }));
            } catch (err) {
                showAlert("檔案讀取失敗，請確認檔案未損毀。\n" + err.message);
            }
        }
    };

    return (
        <div className="glass-panel p-6 rounded-xl transition-colors">
            <h2 className="text-xl font-bold mb-6 flex items-center justify-center" style={{ color: 'var(--text-primary)' }}>
                <Upload className="mr-2" /> 請上傳 Excel 檔案
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Upload 1 */}
                <div className={`border-2 rounded-xl p-6 text-center transition-all ${fileStatus.serviceRecord ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm' : 'border-dashed hover:bg-white/5'}`}
                     style={{ borderColor: fileStatus.serviceRecord ? undefined : 'var(--glass-border)' }}>
                    {fileStatus.serviceRecord ? (
                        <div className="text-emerald-500 mb-3 animate-bounce"><FileCheck className="mx-auto h-12 w-12" /></div>
                    ) : (
                        <FileSpreadsheet className="mx-auto h-12 w-12 mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                    )}
                    <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>1. 服務紀錄表</h3>
                    <p className="text-xs mb-4 h-8" style={{ color: 'var(--text-secondary)' }}>必要欄位：服務日期、服務個案、服務代碼、服務時間</p>
                    
                    <label className={`cursor-pointer inline-block px-4 py-2 rounded-lg text-sm font-bold transition upload-btn ${fileStatus.serviceRecord ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'text-white hover:opacity-90'}`}
                           style={{ background: fileStatus.serviceRecord ? undefined : 'var(--btn-primary-bg)', color: fileStatus.serviceRecord ? undefined : '#fff' }}>
                        {fileStatus.serviceRecord ? '重新上傳' : '選擇檔案'}
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileChange(e, 'serviceRecord')} className="hidden" />
                    </label>
                    <div className="mt-2 text-xs truncate px-2 h-4" style={{ color: 'var(--text-secondary)' }}>
                        {files.serviceRecord ? files.serviceRecord.name : "尚未選擇檔案"}
                    </div>
                </div>

                {/* Upload 2 */}
                <div className={`border-2 rounded-xl p-6 text-center transition-all ${fileStatus.govRecord ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm' : 'border-dashed hover:bg-white/5'}`}
                     style={{ borderColor: fileStatus.govRecord ? undefined : 'var(--glass-border)' }}>
                    {fileStatus.govRecord ? (
                        <div className="text-emerald-500 mb-3 animate-bounce"><FileCheck className="mx-auto h-12 w-12" /></div>
                    ) : (
                        <FileSpreadsheet className="mx-auto h-12 w-12 mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                    )}
                    <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>2. A碼核定清冊</h3>
                    <p className="text-xs mb-4 h-8" style={{ color: 'var(--text-secondary)' }}>必要欄位：序號、日期、個案、代碼、小計</p>
                    
                    <label className={`cursor-pointer inline-block px-4 py-2 rounded-lg text-sm font-bold transition upload-btn ${fileStatus.govRecord ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'text-white hover:opacity-90'}`}
                           style={{ background: fileStatus.govRecord ? undefined : 'var(--btn-primary-bg)', color: fileStatus.govRecord ? undefined : '#fff' }}>
                        {fileStatus.govRecord ? '重新上傳' : '選擇檔案'}
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileChange(e, 'govRecord')} className="hidden" />
                    </label>
                    <div className="mt-2 text-xs truncate px-2 h-4" style={{ color: 'var(--text-secondary)' }}>
                        {files.govRecord ? files.govRecord.name : "尚未選擇檔案"}
                    </div>
                </div>

                {/* Upload 3 - System Roster Display (Read Only) */}
                <div className={`border-2 rounded-xl p-6 text-center transition-all ${fileStatus.staffList ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm' : 'bg-red-500/5 border-red-500/30'}`}>
                    {fileStatus.staffList ? (
                        <div className="text-emerald-500 mb-3"><Users className="mx-auto h-12 w-12" /></div>
                    ) : (
                        <Users className="mx-auto h-12 w-12 mb-3 text-red-400" />
                    )}
                    <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>3. 人員名冊</h3>
                    <p className="text-xs mb-4 h-8" style={{ color: 'var(--text-secondary)' }}>來源：系統名冊資料庫</p>
                    
                    {fileStatus.staffList ? (
                         <div className="mb-2">
                            <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full mb-2">
                                已載入系統名冊
                            </span>
                            <div className="mt-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                共 {Array.isArray(files.staffList) ? files.staffList.length : 0} 筆人員資料
                            </div>
                            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                                如需修改請至「員工管理」
                            </p>
                         </div>
                    ) : (
                        <div className="mb-2">
                            <span className="inline-block px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full mb-2">
                                尚無名冊資料
                            </span>
                            <p className="text-xs text-red-400 mt-2 font-bold">
                                請至「員工管理」分頁<br/>新增或匯入人員
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 flex justify-center flex-col items-center">
                <button 
                    onClick={onProcess}
                    disabled={!fileStatus.serviceRecord || !fileStatus.govRecord || !fileStatus.staffList || isProcessing}
                    className={`flex items-center px-10 py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all transform ${
                        (!fileStatus.serviceRecord || !fileStatus.govRecord || !fileStatus.staffList) 
                        ? 'opacity-50 cursor-not-allowed bg-gray-500' 
                        : 'hover:scale-105 active:scale-95'
                    }`}
                    style={{ 
                        background: (!fileStatus.serviceRecord || !fileStatus.govRecord || !fileStatus.staffList) ? undefined : 'var(--btn-primary-bg)',
                        boxShadow: (!fileStatus.serviceRecord || !fileStatus.govRecord || !fileStatus.staffList) ? 'none' : 'var(--btn-primary-shadow)'
                    }}
                >
                    {isProcessing ? (
                        <> <span className="animate-spin mr-3">⏳</span> <span>運算中...</span> </>
                    ) : (
                        <> <Calculator className="mr-2" />開始拆帳</>
                    )}
                </button>
                {isProcessing && (
                    <div className="mt-4 w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-blue-600 h-2.5 rounded-full animate-pulse w-full"></div>
                        <p className="text-center text-xs mt-2 font-medium" style={{ color: 'var(--text-accent)' }}>{progressText}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUpload;
