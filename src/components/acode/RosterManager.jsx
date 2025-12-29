import React, { useState, useEffect } from "react";
import {
  Users,
  AlertCircle,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { getEmployees } from "../../data/employeeStore";

const RosterManager = ({ onRosterUpdate }) => {
  const [roster, setRoster] = useState([]);
  const [showSyncAlert, setShowSyncAlert] = useState(false);

  const loadAndSyncRoster = () => {
    const employees = getEmployees();
    // Map employeeStore data to A-Code expected format
    const mappedRoster = employees.map(emp => ({
        '員編': emp.empId,
        '姓名': emp.name,
        '職級': emp.position === 'Full-time' ? '正職' : '兼職',
        '員工編號': emp.empId, // redundant but safe for legacy logic
        '員工姓名': emp.name   // redundant but safe
    }));
    
    setRoster(mappedRoster);
    if (onRosterUpdate) onRosterUpdate(mappedRoster);
  };

  useEffect(() => {
    loadAndSyncRoster();
  }, []);

  const handleManualSync = () => {
    loadAndSyncRoster();
    setShowSyncAlert(true);
    setTimeout(() => setShowSyncAlert(false), 3000);
  };

  return (
    <div className="glass-panel p-6 rounded-xl transition-colors min-h-[60vh]">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-xl font-bold flex items-center" style={{ color: 'var(--text-primary)' }}>
            <Users className="mr-2" /> 人員名冊管理
            </h2>
            <p className="text-xs mt-1 flex items-center font-bold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                <AlertCircle size={12} className="mr-1" />
                此名冊自動同步自「員工管理」頁面
            </p>
        </div>
        
        <div className="flex gap-3">
            {showSyncAlert && (
                <span className="text-emerald-500 text-sm flex items-center animate-pulse">
                    <RefreshCw size={14} className="mr-1" /> 同步完成
                </span>
            )}
          <button
            onClick={handleManualSync}
            className="flex items-center px-4 py-2 rounded-lg transition border hover:bg-white/5"
            style={{ 
                color: 'var(--text-accent)', 
                borderColor: 'var(--glass-border)',
                background: 'rgba(0,0,0,0.1)'
            }}
          >
            <RefreshCw size={18} className="mr-2" />
            重新同步
          </button>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--glass-border)' }}>
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>尚無人員資料</p>
          <p className="text-sm mt-2 opacity-60" style={{ color: 'var(--text-secondary)' }}>請至「員工管理」頁面新增人員</p>
          <a href="/employees" className="inline-flex items-center mt-4 font-bold hover:underline" style={{ color: 'var(--text-accent)' }}>
             前往員工管理 <ArrowRight size={14} className="ml-1" />
          </a>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between text-sm font-bold opacity-60" style={{ color: 'var(--text-secondary)' }}>
            <p>共 {roster.length} 筆資料 (唯讀模式)</p>
          </div>

          <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--glass-border)' }}>
            <table className="min-w-full divide-y" style={{ divideColor: 'var(--glass-border)' }}>
              <thead style={{ background: 'var(--accordion-bg)' }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    員編
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    姓名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    職級
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    狀態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: 'var(--glass-border)' }}>
                {roster.map((staff, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                      {staff["員編"]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {staff["姓名"]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${
                          staff["職級"] === "正職"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {staff["職級"]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="flex items-center text-emerald-500 font-bold text-xs">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div> 系統同步
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default RosterManager;
