import React, { useState, useEffect } from 'react';
import {  Edit2, Upload, Trash, X } from 'lucide-react';
import { getBonuses, saveBonus, clearBonuses, importBonuses } from '../data/bonusStore';
import { getEmployees } from '../data/employeeStore';
import { subscribePeriod } from '../data/periodStore';
import { generateUUID } from '../utils/uuid';
import { parseBonusExcel } from '../utils/excelParser';
import ConfirmModal from '../components/ConfirmModal';

const BonusManagement = () => {
  const [items, setItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'warning', 'danger', 'success', 'info'
    onConfirm: null,
    isAlert: false
  });

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
    loadData();
    const unsubscribe = subscribePeriod(() => loadData());
    return unsubscribe;
  }, []);

  const loadData = () => {
    const employees = getEmployees();
    const bonuses = getBonuses();

    // drive by employees
    const merged = employees.map(emp => {
        const bonus = bonuses.find(b => b.empId === emp.empId) || {};
        // We use the Employee's ID as the key for the row, but we need to track Bonus ID for saving
        // If bonus.id doesn't exist, it means this employee has no bonus record yet.
        return {
            ...emp, // contains empId, name, etc.
            ...bonus, // contains bonus values
            id: emp.id, // reliable row key
            bonusId: bonus.id, // persistence key
            // defaults for fields if not in bonus
            bonusA: bonus.bonusA || 0,
            bonusC: bonus.bonusC || 0,
            bonusOpen: bonus.bonusOpen || 0,
            bonusDev: bonus.bonusDev || 0,
            bonusCross: bonus.bonusCross || 0,
            referral: bonus.referral || 0,
            mentoring: bonus.mentoring || 0,
            fuel: bonus.fuel || 0,
            other: bonus.other || 0
        };
    });

    setItems(merged);
  };

  const handleOpenModal = (item) => {
    setError('');
    setFormData({
        ...item,
        // Ensure persistence ID is ready if needed, distinct from employee ID
        id: item.bonusId || generateUUID() 
    });
    setIsModalOpen(true);
  };

  const handleClearAll = () => {
    showConfirm('歸零確認', '確定要歸零所有額外獎金金額嗎？(員工名單不會被刪除)', 'danger', () => {
        clearBonuses();
        loadData();
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      // Save only the bonus fields + linkage keys
      const bonusData = {
          id: formData.id,
          empId: formData.empId,
          name: formData.name,
          bonusA: formData.bonusA,
          bonusC: formData.bonusC,
          bonusOpen: formData.bonusOpen,
          bonusDev: formData.bonusDev,
          bonusCross: formData.bonusCross,
          referral: formData.referral,
          mentoring: formData.mentoring,
          fuel: formData.fuel,
          other: formData.other
      };
      
      saveBonus(bonusData);
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: (parseFloat(value) || 0)
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const newBonuses = await parseBonusExcel(file);
      const { count } = importBonuses(newBonuses);
      showAlert('匯入成功', `成功匯入/更新 ${count} 筆額外獎金資料。`, 'success');
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('匯入失敗', '匯入失敗：' + err.message, 'danger');
    } finally {
        e.target.value = null;
    }
  };

  const fields = [
      { key: 'bonusA', label: 'A碼拆帳金額', color: 'text-amber-400', border: 'focus:border-amber-500/50', ring: 'focus:ring-amber-500/50' },
      { key: 'bonusC', label: '丙證獎金', color: 'text-amber-400', border: 'focus:border-amber-500/50', ring: 'focus:ring-amber-500/50' },
      { key: 'bonusOpen', label: '開案獎金', color: 'text-emerald-400', border: 'focus:border-emerald-500/50', ring: 'focus:ring-emerald-500/50' },
      { key: 'bonusDev', label: '開發獎金', color: 'text-emerald-400', border: 'focus:border-emerald-500/50', ring: 'focus:ring-emerald-500/50' },
      { key: 'bonusCross', label: '跨區獎金', color: 'text-blue-400', border: 'focus:border-blue-500/50', ring: 'focus:ring-blue-500/50' },
      { key: 'referral', label: '介紹費', color: 'text-purple-400', border: 'focus:border-purple-500/50', ring: 'focus:ring-purple-500/50' },
      { key: 'mentoring', label: '帶新人津貼', color: 'text-purple-400', border: 'focus:border-purple-500/50', ring: 'focus:ring-purple-500/50' },
      { key: 'fuel', label: '油資補助', color: 'text-slate-300', border: 'focus:border-slate-500/50', ring: 'focus:ring-slate-500/50' },
      { key: 'other', label: '其他', color: 'text-slate-300', border: 'focus:border-slate-500/50', ring: 'focus:ring-slate-500/50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>額外獎金管理</h2>
            <p className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-secondary)' }}>名單連動員工管理，請於該處新增/刪除人員</p>
          </div>

          <div className="flex gap-4">
               {/* Upload Button */}
               <div className="relative group">
                    <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all active:scale-95 glass-panel cursor-pointer"
                            style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}>
                        <Upload size={16} />
                        <span className="font-bold text-xs tracking-wide">匯入 EXCEL</span>
                    </button>
               </div>

               {/* Clear All Button */}
               <button 
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl border border-red-500/20 transition-all active:scale-95 cursor-pointer"
               >
                  <Trash size={16} />
                  <span className="font-bold text-xs tracking-wide">歸零</span>
               </button>
          </div>
      </div>

      {/* Table View */}
      <div className="overflow-hidden rounded-[2rem] border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                        <th className="p-3 text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--table-header-text)' }}>員編</th>
                        <th className="p-3 text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--table-header-text)' }}>姓名</th>
                        {fields.map(f => (
                             <th key={f.key} className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>{f.label}</th>
                        ))}
                        <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>總額</th>
                        <th className="p-3 text-sm font-bold uppercase tracking-widest text-right" style={{ color: 'var(--table-header-text)' }}>操作</th>
                    </tr>
                </thead>
                <tbody className="" style={{ borderColor: 'var(--glass-border)' }}>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={fields.length + 4} className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                                尚無員工資料，請至「員工管理」新增人員
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => {
                            const total = (item.bonusA || 0) + (item.bonusC || 0) + (item.bonusOpen || 0) + (item.bonusDev || 0) + (item.bonusCross || 0) + (item.referral || 0) + (item.mentoring || 0) + (item.fuel || 0) + (item.other || 0);
                            return (
                            <tr key={item.id} className="transition-colors border-b group hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                                <td className="p-3 font-mono font-bold" style={{ color: 'var(--text-accent)' }}>{item.empId}</td>
                                <td className="p-3 font-bold" style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                                {fields.map(f => (
                                    <td key={f.key} className={`p-3 font-mono text-right ${item[f.key] > 0 ? f.color : ''}`} style={{ color: item[f.key] > 0 ? undefined : 'var(--text-secondary)' }}>
                                        {item[f.key] > 0 ? `$${item[f.key].toLocaleString()}` : '-'}
                                    </td>
                                ))}
                                <td className="p-3 font-mono font-bold text-right text-yellow-400">
                                    ${total.toLocaleString()}
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleOpenModal(item)}
                                            className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative w-full max-w-4xl border rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                 style={{ 
                     background: 'var(--modal-bg)', 
                     borderRadius: 'var(--modal-radius)', 
                     boxShadow: 'var(--modal-shadow)',
                     borderColor: 'var(--glass-border)'
                 }}>
                
                {/* Modal Header */}
                <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
                    <h3 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        編輯資料
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                        <X size={20} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="space-y-2">
                            <label className="uppercase tracking-widest pl-1 mb-2 block" 
                                   style={{ 
                                       fontSize: 'var(--label-text-size)', 
                                       fontWeight: 'var(--label-text-weight)', 
                                       color: 'var(--label-text-color)' 
                                   }}>員編</label>
                            <input 
                                disabled
                                type="text" 
                                value={formData.empId} 
                                className="w-full px-4 py-3 cursor-not-allowed transition-all font-medium"
                                style={{ 
                                    background: 'var(--input-bg-disabled)', 
                                    borderColor: 'var(--glass-border)', 
                                    color: 'var(--text-secondary)',
                                    border: 'var(--input-border)',
                                    borderRadius: 'var(--input-radius)'
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="uppercase tracking-widest pl-1 mb-2 block" 
                                   style={{ 
                                       fontSize: 'var(--label-text-size)', 
                                       fontWeight: 'var(--label-text-weight)', 
                                       color: 'var(--label-text-color)' 
                                   }}>姓名</label>
                            <input 
                                disabled
                                type="text" 
                                value={formData.name} 
                                className="w-full px-4 py-3 cursor-not-allowed transition-all font-medium"
                                style={{ 
                                    background: 'var(--input-bg-disabled)', 
                                    borderColor: 'var(--glass-border)', 
                                    color: 'var(--text-secondary)',
                                    border: 'var(--input-border)',
                                    borderRadius: 'var(--input-radius)'
                                }}
                            />
                        </div>
                    </div>

                    <div className="h-px mb-8" style={{ background: 'var(--glass-border)' }}></div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {fields.map(f => (
                             <div key={f.key} className="space-y-2">
                                <label className="uppercase tracking-widest pl-1 mb-2 block"
                                   style={{ 
                                       fontSize: 'var(--label-text-size)', 
                                       fontWeight: 'var(--label-text-weight)', 
                                       color: 'var(--label-text-color)' 
                                   }}>{f.label}</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={formData[f.key]} 
                                        onChange={e => handleChange(f.key, e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 outline-none transition-all font-mono font-medium"
                                        style={{ 
                                            background: 'var(--input-bg)', 
                                            color: 'var(--text-primary)',
                                            border: 'var(--input-border)',
                                            borderRadius: 'var(--input-radius)'
                                        }}
                                        onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-secondary)' }}>$</span>
                                </div>
                            </div>
                        ))}
                    </div>

                </form>

                {/* Footer */}
                <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 z-50 glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleSubmit}
                        className="px-6 py-2.5 font-bold tracking-wide transition-all active:scale-95 cursor-pointer"
                        style={{ 
                            background: 'var(--btn-primary-bg)', 
                            color: '#fff',
                            borderRadius: 'var(--modal-radius)',
                            boxShadow: 'var(--btn-primary-shadow)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--btn-primary-hover)'}
                        onMouseLeave={(e) => e.target.style.background = 'var(--btn-primary-bg)'}
                    >
                        儲存資料
                    </button>
                </div>

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

export default BonusManagement;
