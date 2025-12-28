import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Upload, AlertCircle, Hash } from 'lucide-react';
import { getEmployees, saveEmployee, deleteEmployee, importEmployees, clearEmployees } from '../data/employeeStore';
import { generateUUID } from '../utils/uuid';

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    empId: '',
    name: '',
    idNumber: '',
    position: 'Full-time',
    splits: { b: 0, g: 0, s: 0, missed: 0 }
  });
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const toggleAccordion = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = () => {
    setEmployees(getEmployees());
  };

  const handleOpenModal = (employee = null) => {
    setError('');
    if (employee) {
      setEditingEmployee(employee);
      setFormData(employee);
    } else {
      setEditingEmployee(null);
      setFormData({
        id: generateUUID(),
        empId: '',
        name: '',
        idNumber: '',
        bankCode: '',
        bankAccount: '',
        position: 'Full-time',
        splits: { b: 0, g: 0, s: 0, missed: 0 }
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('確定要刪除這位員工嗎？')) {
      deleteEmployee(id);
      loadEmployees();
    }
  };

  const handleClearAll = () => {
    if (window.confirm('確定要清除所有員工資料嗎？此動作無法復原。')) {
        clearEmployees();
        loadEmployees();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      saveEmployee(formData);
      setIsModalOpen(false);
      loadEmployees();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (field, value, isSplit = false) => {
    if (isSplit) {
      setFormData(prev => ({
        ...prev,
        splits: { ...prev.splits, [field]: parseFloat(value) || 0 }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleGlobalSplitChange = (value) => {
    const val = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      splits: { b: val, g: val, s: val, missed: val }
    }));
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { parseEmployeeExcel } = await import('../utils/excelParser');
      const newEmployees = await parseEmployeeExcel(file);
      const { count } = importEmployees(newEmployees);
      alert(`成功匯入/更新 ${count} 筆員工資料。`);
      loadEmployees();
    } catch (err) {
      alert('檔案匯入錯誤: ' + err.message);
    } finally {
        e.target.value = null; 
    }
  };

  return (
    <div className="space-y-12">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter mb-2">員工管理</h2>
            
          </div>

          <div className="flex gap-4">
            <label className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 cursor-pointer transition-all text-sm font-bold text-slate-300 flex items-center gap-2 group">
                <Upload size={16} className="group-hover:text-cyan-400 transition-colors" />
                <span>匯入 EXCEL</span>
                <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                    onChange={handleFileUpload}
                />
            </label>

            <button 
                onClick={handleClearAll}
                className="px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 font-bold transition-all text-sm flex items-center gap-2"
            >
                <Trash2 size={16} />
                <span>清除</span>
            </button>
            <button 
                onClick={() => handleOpenModal()} 
                className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 text-sm"
            >
                <Plus size={16} strokeWidth={3} />
                <span>新增員工</span>
            </button>
          </div>
      </div>

      {/* Accordion List View */}
      <div className="space-y-4">
        {employees.length === 0 ? (
           <div className="h-80 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-slate-500 border-dashed">
             <p className="font-bold text-lg">暫無員工資料</p>
             <p className="text-sm mt-2 opacity-60">點擊右上方按鈕新增</p>
           </div>
        ) : (
          employees.map((emp) => {
            const isExpanded = expandedId === emp.id;
            return (
                <div key={emp.id} className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-[#0f172a] border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]' : 'bg-[#0f172a]/40 border-white/5 hover:bg-[#1e293b]/50 hover:border-white/10'}`}>
                    
                    {/* List Header (Always Visible) */}
                    <div 
                        className="p-6 flex items-center justify-between cursor-pointer"
                        onClick={() => toggleAccordion(emp.id)}
                    >
                        <div className="flex items-center gap-6">
                            {/* Avatar/ID Circle */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-bold font-mono transition-colors ${isExpanded ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-slate-400'}`}>
                                {emp.empId}
                            </div>
                            
                            <div>
                                <h3 className={`text-lg font-bold transition-colors ${isExpanded ? 'text-white' : 'text-slate-200'}`}>{emp.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                                       emp.position === 'Full-time' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                       {emp.position === 'Full-time' ? '全職' : '兼職'}
                                    </span>
                                    <span className="text-xs text-slate-500 font-mono tracking-wider">{emp.idNumber}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            {/* Summary Split - Visible when collapsed */}
                            <div className={`text-right transition-opacity duration-300 ${isExpanded ? 'opacity-0 hidden sm:block' : 'opacity-100'}`}>
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block mb-0.5">拆帳</span>
                                <span className="text-lg font-mono font-bold text-cyan-400">{parseFloat((emp.splits?.b || 0).toFixed(1))}%</span>
                            </div>
                            
                            {/* Chevron */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-cyan-500 text-black rotate-180' : 'bg-white/5 text-slate-500 group-hover:bg-white/10'}`}>
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                            </div>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden bg-black/20 border-t border-white/5">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* Bank Info */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Hash size={12}/> 銀行帳戶資訊
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-slate-400">銀行代碼</span>
                                            <span className="text-sm font-mono font-bold text-cyan-400">{emp.bankCode || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-slate-400">匯款帳號</span>
                                            <span className="text-sm font-mono font-bold text-slate-200">{emp.bankAccount || '-'}</span>
                                        </div>
                                    </div>
                                </div>



                                {/* Actions */}
                                <div className="flex flex-col justify-end gap-3">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(emp); }}
                                        className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Edit2 size={14} /> 編輯資料
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                        className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Trash2 size={14} /> 刪除員工
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            );
          })
        )}
      </div>

      {/* Modal - Modern Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl transition-opacity duration-300">
          <div className="w-full max-w-xl bg-[#0f172a] rounded-[2.5rem] p-10 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
            
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] pointer-events-none rounded-full"></div>

            <h3 className="text-3xl font-bold mb-10 text-white tracking-tight relative z-10">
              {editingEmployee ? '編輯員工資料' : '新增員工'}
            </h3>
            
            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl flex items-center gap-3 text-sm">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">員工編號</label>
                  <input
                    required
                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border-none rounded-2xl px-5 py-3.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-mono font-medium"
                    value={formData.empId}
                    onChange={(e) => handleChange('empId', e.target.value)}
                    placeholder="C001"
                  />
                </div>
                 <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">職級</label>
                  <div className="relative">
                    <select
                        className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border-none rounded-2xl px-5 py-3.5 text-white outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-medium appearance-none cursor-pointer"
                        value={formData.position}
                        onChange={(e) => handleChange('position', e.target.value)}
                    >
                        <option className="bg-slate-900" value="Full-time">全職</option>
                        <option className="bg-slate-900" value="Part-time">兼職</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">真實姓名</label>
                    <input
                    required
                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border-none rounded-2xl px-5 py-3.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-medium"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="王小明"
                    />
                </div>
                <div className="space-y-3">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">身份證字號</label>
                    <input
                    required
                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border-none rounded-2xl px-5 py-3.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-mono font-medium"
                    value={formData.idNumber}
                    onChange={(e) => handleChange('idNumber', e.target.value)}
                    placeholder="A123456789"
                    />
                </div>
              </div>

               <div className="grid grid-cols-3 gap-6">
                <div className="col-span-1 space-y-3">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">銀行代碼</label>
                   <input
                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border-none rounded-2xl px-5 py-3.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-mono font-medium"
                    value={formData.bankCode || ''}
                    onChange={(e) => handleChange('bankCode', e.target.value)}
                    placeholder="822"
                   />
                </div>
                <div className="col-span-2 space-y-3">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">匯款帳號</label>
                   <input
                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border-none rounded-2xl px-5 py-3.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-mono font-medium"
                    value={formData.bankAccount || ''}
                    onChange={(e) => handleChange('bankAccount', e.target.value)}
                    placeholder="帳號"
                   />
                </div>
              </div>

              <div className="bg-white/[0.03] p-6 rounded-[1.5rem] border border-white/5 mt-4">
                <label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase tracking-widest pl-1">拆帳分配 (所有類別皆同)</label>
                <div className="relative">
                   <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full bg-black/20 border-none rounded-xl py-4 text-center font-mono text-2xl font-bold text-cyan-400 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder-white/20"
                        value={formData.splits.b} 
                        onChange={(e) => handleGlobalSplitChange(e.target.value)}
                        placeholder="60"
                   />
                   <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</div>
                </div>
              </div>

              <div className="flex gap-4 mt-8 pt-6 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 text-slate-400 hover:text-white text-xs font-bold tracking-widest transition-colors uppercase"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-white text-black rounded-2xl font-bold hover:scale-[1.02] shadow-xl hover:shadow-white/20 text-xs tracking-widest uppercase transition-all"
                >
                  確認儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
