import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Upload, AlertCircle, Hash } from 'lucide-react';
import { getEmployees, saveEmployee, deleteEmployee, importEmployees, clearEmployees } from '../data/employeeStore';
import { generateUUID } from '../utils/uuid';
import ConfirmModal from '../components/ConfirmModal';

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


  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'warning', 'danger', 'success', 'info'
    onConfirm: null,
    isAlert: false
  });

  const toggleAccordion = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const showConfirm = (title, message, type, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      isAlert: false
    });
  };

  const showAlert = (title, message, type = 'info') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      isAlert: true
    });
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
    showConfirm('刪除確認', '確定要刪除這位員工嗎？此動作無法復原。', 'danger', () => {
        deleteEmployee(id);
        loadEmployees();
    });
  };

  const handleClearAll = () => {
    showConfirm('清除確認', '確定要清除所有員工資料嗎？此動作無法復原。', 'danger', () => {
        clearEmployees();
        loadEmployees();
    });
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
      showAlert('匯入成功', `成功匯入/更新 ${count} 筆員工資料。`, 'success');
      loadEmployees();
    } catch (err) {
      showAlert('匯入失敗', '檔案匯入錯誤: ' + err.message, 'danger');
    } finally {
        e.target.value = null; 
    }
  };

  return (
    <div className="space-y-12">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>員工管理</h2>
          </div>

          <div className="flex gap-4">
            <label className="px-6 py-3 rounded-xl border cursor-pointer transition-all text-sm font-bold flex items-center gap-2 group glass-panel" style={{ color: 'var(--text-secondary)' }}>
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
                className="px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 font-bold transition-all text-sm flex items-center gap-2 cursor-pointer"
            >
                <Trash2 size={16} />
                <span>清除</span>
            </button>
            <button 
                onClick={() => handleOpenModal()} 
                className="px-6 py-3 rounded-xl text-white font-bold shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2 text-sm cursor-pointer"
                style={{ background: 'var(--text-accent)', boxShadow: '0 4px 14px 0 rgba(38, 100, 235, 0.39)' }}
            >
                <Plus size={16} strokeWidth={3} />
                <span>新增員工</span>
            </button>
          </div>
      </div>

      {/* Accordion List View */}
      <div className="space-y-4">
        {employees.length === 0 ? (
           <div className="h-80 rounded-[2rem] border flex flex-col items-center justify-center border-dashed"
                style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
             <p className="font-bold text-lg">暫無員工資料</p>
             <p className="text-sm mt-2 opacity-60">點擊右上方按鈕新增</p>
           </div>
        ) : (
          employees.map((emp) => {
            const isExpanded = expandedId === emp.id;
            return (
                <div key={emp.id} 
                     className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden glass-panel ${isExpanded ? 'shadow-lg' : ''}`}
                     style={{ 
                         borderColor: isExpanded ? 'rgba(38, 100, 235, 0.3)' : 'var(--glass-border)',
                         background: 'var(--glass-bg)' 
                     }}>
                    
                    {/* List Header (Always Visible) */}
                    <div 
                        className="p-6 flex items-center justify-between cursor-pointer"
                        onClick={() => toggleAccordion(emp.id)}
                    >
                        <div className="flex items-center gap-6">
                            {/* Avatar/ID Circle */}
                            <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-bold font-mono transition-colors"
                                style={{
                                    background: 'var(--emp-icon-bg)',
                                    color: 'var(--emp-icon-text)'
                                }}
                            >
                                {emp.empId}
                            </div>
                            
                            <div>
                                <h3 className="text-lg font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>{emp.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                                       emp.position === 'Full-time' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                       {emp.position === 'Full-time' ? '全職' : '兼職'}
                                    </span>
                                    <span className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>{emp.idNumber}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            {/* Summary Split - Visible when collapsed */}
                            <div className={`text-right transition-opacity duration-300 ${isExpanded ? 'opacity-0 hidden sm:block' : 'opacity-100'}`}>
                                <span className="text-[10px] font-bold uppercase tracking-widest block mb-0.5" style={{ color: 'var(--text-secondary)' }}>拆帳</span>
                                <span className="text-lg font-mono font-bold" style={{ color: 'var(--text-accent)' }}>{parseFloat((emp.splits?.b || 0).toFixed(1))}%</span>
                            </div>
                            
                            {/* Chevron */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'rotate-180 bg-blue-600 text-white' : 'bg-white/5 group-hover:bg-white/10 text-gray-400'}`}
                                 style={{ 
                                     backgroundColor: isExpanded ? 'var(--text-accent)' : undefined,
                                 }}>
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                            </div>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden border-t" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* Bank Info */}
                                <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--glass-border)', background: 'rgba(255,255,255,0.05)' }}>
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                        <Hash size={12}/> 銀行帳戶資訊
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>銀行代碼</span>
                                            <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-accent)' }}>{emp.bankCode || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>匯款帳號</span>
                                            <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{emp.bankAccount || '-'}</span>
                                        </div>
                                    </div>
                                </div>



                                {/* Actions */}
                                <div className="flex flex-col justify-end gap-3">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(emp); }}
                                        className="w-full py-3 rounded-xl border font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all hover:bg-white/5 cursor-pointer"
                                        style={{ borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                                    >
                                        <Edit2 size={14} /> 編輯資料
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                        className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl transition-opacity duration-300"
             onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-xl p-10 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden flex flex-col"
               style={{ 
                   background: 'var(--modal-bg)', 
                   borderRadius: 'var(--modal-radius)', 
                   boxShadow: 'var(--modal-shadow)',
                   border: '1px solid var(--glass-border)'
               }}
               onClick={(e) => e.stopPropagation()}>
            
            {/* Background Glow */}
            {/* Background Glow - Remove for clean SaaS look */}
            {/* <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] pointer-events-none rounded-full"></div> */}

            <h3 className="text-3xl font-bold mb-10 tracking-tight relative z-10" style={{ color: 'var(--text-primary)' }}>
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
                  <label className="uppercase tracking-widest pl-1 mb-2 block" 
                         style={{ 
                             fontSize: 'var(--label-text-size)', 
                             fontWeight: 'var(--label-text-weight)', 
                             color: 'var(--label-text-color)' 
                         }}>員工編號</label>
                  <input
                    required
                    className="w-full px-5 py-3.5 outline-none transition-all font-mono font-medium"
                    style={{ 
                        background: 'var(--input-bg)', 
                        color: 'var(--text-primary)',
                        border: 'var(--input-border)',
                        borderRadius: 'var(--input-radius)',
                        boxShadow: 'none' // handle focus via css or specific class if needed, or inline style for focus ring
                    }}
                    onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    value={formData.empId}
                    onChange={(e) => handleChange('empId', e.target.value)}
                    placeholder="C001"
                  />
                </div>
                 <div className="space-y-3">
                  <label className="uppercase tracking-widest pl-1 mb-2 block" 
                         style={{ 
                             fontSize: 'var(--label-text-size)', 
                             fontWeight: 'var(--label-text-weight)', 
                             color: 'var(--label-text-color)' 
                         }}>職級</label>
                  <div className="relative">
                    <select
                        className="w-full px-5 py-3.5 outline-none transition-all font-medium appearance-none cursor-pointer"
                        style={{ 
                            background: 'var(--input-bg)', 
                            color: 'var(--text-primary)',
                            border: 'var(--input-border)',
                            borderRadius: 'var(--input-radius)'
                        }}
                        onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                        value={formData.position}
                        onChange={(e) => handleChange('position', e.target.value)}
                    >
                        <option style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }} value="Full-time">全職</option>
                        <option style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }} value="Part-time">兼職</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" style={{ color: 'var(--text-primary)' }}>
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: 'var(--text-secondary)' }}>真實姓名</label>
                    <input
                    required
                    className="w-full border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-medium"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="王小明"
                    />
                </div>
                <div className="space-y-3">
                     <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: 'var(--text-secondary)' }}>身份證字號</label>
                    <input
                    required
                    className="w-full border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-mono font-medium"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    value={formData.idNumber}
                    onChange={(e) => handleChange('idNumber', e.target.value)}
                    placeholder="A123456789"
                    />
                </div>
              </div>

               <div className="grid grid-cols-3 gap-6">
                <div className="col-span-1 space-y-3">
                   <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: 'var(--text-secondary)' }}>銀行代碼</label>
                   <input
                    className="w-full border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-mono font-medium"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    value={formData.bankCode || ''}
                    onChange={(e) => handleChange('bankCode', e.target.value)}
                    placeholder="822"
                   />
                </div>
                <div className="col-span-2 space-y-3">
                   <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: 'var(--text-secondary)' }}>匯款帳號</label>
                   <input
                    className="w-full border-none rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm font-mono font-medium"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    value={formData.bankAccount || ''}
                    onChange={(e) => handleChange('bankAccount', e.target.value)}
                    placeholder="帳號"
                   />
                </div>
              </div>

              <div className="p-6 rounded-[1.5rem] border mt-4" style={{ borderColor: 'var(--glass-border)', background: 'rgba(0,0,0,0.1)' }}>
                <label className="text-[10px] font-bold mb-2 block uppercase tracking-widest pl-1" style={{ color: 'var(--text-secondary)' }}>拆帳分配 (所有類別皆同)</label>
                <div className="relative">
                   <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full border-none rounded-xl py-4 text-center font-mono text-2xl font-bold text-cyan-400 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all placeholder-white/20"
                        style={{ background: 'var(--input-bg)' }}
                        value={formData.splits.b} 
                        onChange={(e) => handleGlobalSplitChange(e.target.value)}
                        placeholder="60"
                   />
                   <div className="absolute right-6 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--text-secondary)' }}>%</div>
                </div>
              </div>

              <div className="flex gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 text-xs font-bold tracking-widest transition-colors uppercase hover:opacity-80 cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 text-white font-bold tracking-widest uppercase transition-all hover:scale-[1.02] cursor-pointer"
                  style={{ 
                      background: 'var(--btn-primary-bg)', 
                      borderRadius: 'var(--modal-radius)', // match modal radius or smaller
                      boxShadow: 'var(--btn-primary-shadow)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--btn-primary-hover)'}
                  onMouseLeave={(e) => e.target.style.background = 'var(--btn-primary-bg)'}
                >
                  確認儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        {...confirmModal}
      />
    </div>
  );
};

export default EmployeeManagement;
