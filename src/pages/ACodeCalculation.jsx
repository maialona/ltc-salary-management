import React, { useState, useEffect } from "react";
import { processData } from '../utils/acode-processor';
import { getEmployees } from '../data/employeeStore';
import { getAcodeResults, saveAcodeResults, deleteAcodeResults } from '../data/acodeStore';
import { subscribePeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import FileUpload from '../components/acode/FileUpload';
import ResultsDashboard from '../components/acode/ResultsDashboard';
import Modal from '../components/acode/Modal';

const ACodeCalculation = () => {
    const { currentInstitution } = useInstitution();

    // Core Data State
    const [files, setFiles] = useState({ serviceRecord: null, govRecord: null, staffList: null });
    const [fileStatus, setFileStatus] = useState({ serviceRecord: false, govRecord: false, staffList: false });
    const [fileHeaders, setFileHeaders] = useState({ serviceRecord: [], govRecord: [], staffList: [] });
    const [employees, setEmployees] = useState([]);

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

    // On mount and when institution/period changes: sync roster + restore saved results
    useEffect(() => {
        const init = async () => {
            // Reset wizard state when switching institution or period
            setResults(null);
            setStep(1);
            setSelectedWorker(null);
            try {
                const [employees, savedResults] = await Promise.all([
                    getEmployees(),
                    getAcodeResults(),
                ]);

                if (employees && employees.length > 0) {
                    setEmployees(employees);
                    const mappedRoster = employees.map(emp => ({
                        '員編': emp.empId,
                        '姓名': emp.name,
                        '職級': emp.position === 'Full-time' ? '正職' : '兼職',
                        '員工編號': emp.empId,
                        '員工姓名': emp.name,
                        'aa09抽成': emp.splits?.aa09 || 0,
                        '其餘A碼抽成': emp.splits?.otherAcode || 0,
                    }));
                    setFiles(prev => ({ ...prev, staffList: mappedRoster }));
                    setFileStatus(prev => ({ ...prev, staffList: true }));
                }

                if (savedResults && savedResults.finalSummary?.length > 0) {
                    setResults(savedResults);
                    setStep(3);
                    setSelectedWorker(savedResults.finalSummary[0].name);
                }
            } catch (e) {
                console.error("Failed to sync/restore", e);
            }
        };

        init();
        const unsub = subscribePeriod(init);
        return unsub;
    }, [currentInstitution]);

    // Auto-save results to API when calculation completes
    useEffect(() => {
        if (results && step === 3) {
            saveAcodeResults(results).catch(e => {
                console.error("Auto-save failed:", e);
            });
        }
    }, [results, step]);

    const handleProcess = async () => {
        setIsProcessing(true);
        setStep(2);
        setProgressText("初始化...");

        try {
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

    const handleReset = async () => {
        setResults(null);
        setStep(1);
        setSelectedWorker(null);
        try {
            await deleteAcodeResults();
        } catch (e) {
            console.error("Failed to delete acode results", e);
        }
    };

    return (
        <div className="transition-colors p-8">
            <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                content={modal.content}
                type={modal.type}
                onConfirm={() => setModal(prev => ({ ...prev, isOpen: false }))}
            />

            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                           A碼拆帳系統
                        </h1>
                    </div>
                </header>

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
                        employees={employees}
                    />
                )}
            </div>
        </div>
    );
};

export default ACodeCalculation;
