import React, { useState, useEffect } from "react";
import { processData } from '../utils/acode-processor';
import StepWizard from '../components/acode/StepWizard';
import FileUpload from '../components/acode/FileUpload';
import ResultsDashboard from '../components/acode/ResultsDashboard';
import Modal from '../components/acode/Modal';

const ACodeCalculation = () => {
    // Core Data State
    const [files, setFiles] = useState({ serviceRecord: null, govRecord: null, staffList: null });
    const [fileStatus, setFileStatus] = useState({ serviceRecord: false, govRecord: false, staffList: false });
    const [fileHeaders, setFileHeaders] = useState({ serviceRecord: [], govRecord: [], staffList: [] });
    
    // Calculation State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressText, setProgressText] = useState("");
    const [results, setResults] = useState(null);
    const [step, setStep] = useState(1);
    
    // Result View State
    const [selectedWorker, setSelectedWorker] = useState(null);

    // Alert Modal State
    const [modal, setModal] = useState({ isOpen: false, title: "", content: "", type: "info" });
    const showAlert = (content, type = "info") => {
        setModal({ isOpen: true, title: "系統訊息", content, type });
    };

    // Load Roster from Employee Store on mount
    useEffect(() => {
        const loadSyncedRoster = () => {
            try {
                // 1. Sync Roster
                const employees = localStorage.getItem('salary_system_employees');
                if (employees) {
                    const parsed = JSON.parse(employees);
                    const mappedRoster = parsed.map(emp => ({
                        '員編': emp.empId,
                        '姓名': emp.name,
                        '職級': emp.position === 'Full-time' ? '正職' : '兼職',
                        '員工編號': emp.empId, 
                        '員工姓名': emp.name   
                    }));
                    
                    if (mappedRoster.length > 0) {
                        setFiles(prev => ({ ...prev, staffList: mappedRoster }));
                        setFileStatus(prev => ({ ...prev, staffList: true }));
                    }
                }

                // 2. Restore Calculation State
                const savedState = localStorage.getItem('acode_calc_state');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);
                    // Only restore if we have valid results
                    if (parsedState.results && parsedState.step === 3) {
                        setResults(parsedState.results);
                        setStep(3);
                        if (parsedState.selectedWorker) {
                            setSelectedWorker(parsedState.selectedWorker);
                        } else if (parsedState.results.finalSummary.length > 0) {
                             setSelectedWorker(parsedState.results.finalSummary[0].name);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to sync/restore", e);
            }
        };
        
        loadSyncedRoster();
    }, []);

    // Save state when results change
    useEffect(() => {
        if (results && step === 3) {
            try {
                localStorage.setItem('acode_calc_state', JSON.stringify({
                    results,
                    step,
                    selectedWorker
                }));
            } catch (e) {
                console.error("Auto-save failed:", e);
                // If quota exceeded, warn the user
                if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                    showAlert("注意：資料量過大，瀏覽器無法自動除存。關閉視窗後資料將會遺失。", "warning");
                }
            }
        }
    }, [results, step, selectedWorker]);

    const handleProcess = async () => {
        setIsProcessing(true);
        setStep(2);
        setProgressText("初始化...");

        try {
            // Small delay to allow UI to update
            await new Promise(r => setTimeout(r, 100));
            
            const resultData = await processData(files, setProgressText);
            
            setResults(resultData);
            if (resultData.finalSummary.length > 0) {
                setSelectedWorker(resultData.finalSummary[0].name);
            }
            setStep(3);
        } catch (error) {
            console.error(error);
            showAlert("計算發生錯誤: " + error.message, "danger");
            setStep(1);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        // Clear state
        setResults(null);
        setStep(1);
        setSelectedWorker(null);
        
        // Clear persisted state
        try {
            localStorage.removeItem('acode_calc_state');
        } catch (e) {
            console.error("Failed to clear state", e);
        }
    };

    return (
        <div className="min-h-screen transition-colors p-8">
            <Modal 
                isOpen={modal.isOpen} 
                title={modal.title} 
                content={modal.content} 
                type={modal.type} 
                onConfirm={() => setModal(prev => ({ ...prev, isOpen: false }))} 
            />

            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>
                           A碼拆帳系統
                        </h1>
                        
                    </div>
                </header>

                <StepWizard step={step} />
                
                {step === 1 && (
                    <FileUpload 
                        files={files}
                        setFiles={setFiles}
                        fileStatus={fileStatus}
                        setFileStatus={setFileStatus}
                        setFileHeaders={setFileHeaders}
                        onProcess={handleProcess}
                        isProcessing={isProcessing}
                        progressText={progressText}
                        showAlert={showAlert}
                    />
                )}

                {step === 3 && results && (
                    <ResultsDashboard 
                        debugInfo={results.debugInfo}
                        errors={results.errors}
                        summaryResult={results.finalSummary}
                        calculationResult={results.results}
                        selectedWorker={selectedWorker}
                        setSelectedWorker={setSelectedWorker}
                        onReset={handleReset}
                    />
                )}
            </div>
            
            <footer className="mt-12 text-center text-sm pb-8" style={{ color: 'var(--text-secondary)' }}>
                <p>&copy; {new Date().getFullYear()} LTC Salary System - ACode Module</p>
            </footer>
        </div>
    );
};

export default ACodeCalculation;
