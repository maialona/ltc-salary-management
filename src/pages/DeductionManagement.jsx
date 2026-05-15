import React, { useState, useEffect } from 'react';
import { Edit2, Upload, Trash, Save, X, RefreshCw } from 'lucide-react';
import { getDeductions, saveDeduction, clearDeductions, importDeductions } from '../data/deductionStore';
import { getEmployees } from '../data/employeeStore';
import { subscribePeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import { generateUUID } from '../utils/uuid';
import { parseDeductionExcel } from '../utils/excelParser';
import ConfirmModal from '../components/ConfirmModal';

const DeductionManagement = () => {
  const { currentInstitution } = useInstitution();
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
  }, [currentInstitution]);

  const loadData = async () => {
    const [employees, deductions] = await Promise.all([getEmployees(), getDeductions()]);

    const merged = employees.map(emp => {
        const deduction = deductions.find(d => d.empId === emp.empId) || {};
        const empLaborLevel = emp.laborInsuranceBracket || 0;
        const empLaborFee = emp.laborInsuranceSelfPay || 0;
        const empHealthLevel = emp.healthInsuranceBracket || 0;
        const empHealthFee = emp.healthInsuranceSelfPay || 0;
        const empPensionRate = emp.voluntaryPensionRate || 0;
        const empPensionFee = emp.voluntaryPensionDeduction || 0;
        return {
            ...emp,
            ...deduction,
            id: emp.id,
            deductionId: deduction.id,
            withholdingTax: deduction.withholdingTax || 0,
            laborLevel: deduction.laborLevel || empLaborLevel,
            laborFee: deduction.laborFee || empLaborFee,
            healthLevel: deduction.healthLevel || empHealthLevel,
            healthFee: deduction.healthFee || empHealthFee,
            pensionRate: deduction.pensionRate || empPensionRate,
            pensionFee: deduction.pensionFee || empPensionFee,
            otherDeduction: deduction.otherDeduction || 0,
            _empLaborLevel: empLaborLevel,
            _empLaborFee: empLaborFee,
            _empHealthLevel: empHealthLevel,
            _empHealthFee: empHealthFee,
            _empPensionRate: empPensionRate,
            _empPensionFee: empPensionFee,
        };
    });
    setItems(merged);
  };

  const handleOpenModal = (item) => {
    setError('');
    setFormData({
        ...item,
        id: item.deductionId || generateUUID()
    });
    setIsModalOpen(true);
  };

  const handleClearAll = () => {
    showConfirm('歸零確認', '確定要歸零所有應扣費用金額嗎？(員工名單不會被刪除)', 'danger', async () => {
        await clearDeductions();
        loadData();
    });
  };

  const handleSyncFromEmployee = () => {
    setFormData(prev => ({
      ...prev,
      laborLevel: prev._empLaborLevel,
      laborFee: prev._empLaborFee,
      healthLevel: prev._empHealthLevel,
      healthFee: prev._empHealthFee,
      pensionRate: prev._empPensionRate,
      pensionFee: prev._empPensionFee,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const deductionData = {
          empId: formData.empId,
          name: formData.name,
          withholdingTax: formData.withholdingTax,
          laborLevel: formData.laborLevel,
          laborFee: formData.laborFee,
          healthLevel: formData.healthLevel,
          healthFee: formData.healthFee,
          pensionRate: formData.pensionRate,
          pensionFee: formData.pensionFee,
          otherDeduction: formData.otherDeduction || 0,
      };
      await saveDeduction(deductionData);
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
      const newDeductions = await parseDeductionExcel(file);
      const { count } = await importDeductions(newDeductions);
      alert(`成功匯入/更新 ${count} 筆應扣費用資料。`);
      loadData();
    } catch (err) {
      console.error(err);
      alert('匯入失敗：' + err.message);
    } finally {
        e.target.value = null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>應扣費用管理</h2>

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
                    <button className="flex items-center gap-2 px-4 py-2 rounded-md border glass-panel cursor-pointer text-sm font-medium"
                            style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}>
                        <Upload size={14} />
                        <span>匯入 Excel</span>
                    </button>
               </div>

               {/* Clear All Button */}
               <button
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-md border border-red-500/20 transition-all cursor-pointer text-sm font-medium"
               >
                  <Trash size={14} />
                  <span>歸零</span>
               </button>
          </div>
      </div>

      {/* Table View */}
      <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                        <th className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--table-header-text)' }}>員編</th>
                        <th className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--table-header-text)' }}>姓名</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>扣繳稅額</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>勞保級距</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>勞保費用</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>健保級距</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>健保費用</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>自提比例</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>自提金額</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>應扣費用</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>總計</th>
                        <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: 'var(--table-header-text)' }}>操作</th>
                    </tr>
                </thead>
                <tbody className="" style={{ borderColor: 'var(--glass-border)' }}>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan="12" className="p-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                                尚無員工資料，請至「員工管理」新增人員
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => {
                            const total = (item.withholdingTax || 0) + (item.laborFee || 0) + (item.healthFee || 0) + (item.pensionFee || 0) + (item.otherDeduction || 0);
                            return (
                            <tr key={item.id} className="transition-colors border-b group hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                                <td className="px-4 py-3 font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.empId}</td>
                                <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                                <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>${item.withholdingTax?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.laborLevel?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-sm text-right text-red-500">${item.laborFee?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.healthLevel?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-sm text-right text-red-500">${item.healthFee?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-sm text-right" style={{ color: 'var(--text-secondary)' }}>{item.pensionRate}%</td>
                                <td className="px-4 py-3 font-mono text-sm text-right text-red-500">${item.pensionFee?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono text-sm text-right text-red-500">{item.otherDeduction > 0 ? `$${item.otherDeduction.toLocaleString()}` : '-'}</td>
                                <td className="px-4 py-3 font-mono text-sm font-semibold text-right text-red-500">${total.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenModal(item)}
                                            className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative w-full max-w-2xl border overflow-hidden animate-in zoom-in-95 duration-200"
                 style={{ 
                     background: 'var(--modal-bg)', 
                     borderRadius: 'var(--modal-radius)', 
                     boxShadow: 'var(--modal-shadow)',
                     borderColor: 'var(--glass-border)'
                 }}
                 onClick={e => e.stopPropagation()}>
                
                {/* Modal Header */}
                <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        編輯資料
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSyncFromEmployee}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer"
                            style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
                            title="將勞健保及自提欄位重設為員工管理中的預設值"
                        >
                            <RefreshCw size={12} />
                            重設為員工資料
                        </button>
                        <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-md transition-colors cursor-pointer">
                            <X size={20} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    <div className="grid grid-cols-2 gap-6">
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

                    <div className="h-px my-2" style={{ background: 'var(--glass-border)' }}></div>

                    {/* Tax */}
                    <div className="space-y-2">
                        <label className="uppercase tracking-widest pl-1 mb-2 block" 
                               style={{ 
                                   fontSize: 'var(--label-text-size)', 
                                   fontWeight: 'var(--label-text-weight)', 
                                   color: 'var(--label-text-color)' 
                               }}>扣繳稅額</label>
                        <input 
                            type="number" 
                            value={formData.withholdingTax} 
                            onChange={e => handleChange('withholdingTax', e.target.value)}
                            className="w-full px-4 py-3 outline-none transition-all font-mono font-medium"
                            style={{ 
                                background: 'var(--input-bg)', 
                                color: 'var(--text-primary)',
                                border: 'var(--input-border)',
                                borderRadius: 'var(--input-radius)'
                            }}
                            onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                        />
                    </div>

                    <div className="h-px my-2" style={{ background: 'var(--glass-border)' }}></div>
                    
                    {/* Labor Insurance */}
                    <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>勞保級距</label>
                                {formData._empLaborLevel > 0 && formData.laborLevel === formData._empLaborLevel && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>員工資料</span>
                                )}
                            </div>
                            <input
                                type="number"
                                value={formData.laborLevel}
                                onChange={e => handleChange('laborLevel', e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                                style={{ background: 'var(--input-bg)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', color: 'var(--text-primary)' }}
                                onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>勞保費用</label>
                                {formData._empLaborFee > 0 && formData.laborFee === formData._empLaborFee && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>員工資料</span>
                                )}
                            </div>
                            <input
                                type="number"
                                value={formData.laborFee}
                                onChange={e => handleChange('laborFee', e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                                style={{ background: 'var(--input-bg)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', color: 'var(--text-primary)' }}
                                onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>
                    </div>

                    {/* Health Insurance */}
                    <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>健保級距</label>
                                {formData._empHealthLevel > 0 && formData.healthLevel === formData._empHealthLevel && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>員工資料</span>
                                )}
                            </div>
                            <input
                                type="number"
                                value={formData.healthLevel}
                                onChange={e => handleChange('healthLevel', e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                                style={{ background: 'var(--input-bg)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', color: 'var(--text-primary)' }}
                                onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>健保費用</label>
                                {formData._empHealthFee > 0 && formData.healthFee === formData._empHealthFee && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>員工資料</span>
                                )}
                            </div>
                            <input
                                type="number"
                                value={formData.healthFee}
                                onChange={e => handleChange('healthFee', e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                                style={{ background: 'var(--input-bg)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', color: 'var(--text-primary)' }}
                                onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>
                    </div>

                    {/* Other Deduction */}
                    <div className="space-y-2">
                        <label className="uppercase tracking-widest pl-1 mb-2 block"
                               style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>應扣費用</label>
                        <input
                            type="number"
                            value={formData.otherDeduction || 0}
                            onChange={e => handleChange('otherDeduction', e.target.value)}
                            className="w-full px-4 py-3 outline-none transition-all font-mono font-medium"
                            style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                            onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                        />
                    </div>

                    <div className="h-px my-2" style={{ background: 'var(--glass-border)' }}></div>

                    {/* Pension */}
                     <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>自提比例 (%)</label>
                                {formData._empPensionRate > 0 && formData.pensionRate === formData._empPensionRate && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>員工資料</span>
                                )}
                            </div>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.pensionRate}
                                onChange={e => handleChange('pensionRate', e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                                style={{ background: 'var(--input-bg)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', color: 'var(--text-primary)' }}
                                onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>自提金額</label>
                                {formData._empPensionFee > 0 && formData.pensionFee === formData._empPensionFee && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-border)', color: 'var(--text-secondary)' }}>員工資料</span>
                                )}
                            </div>
                            <input
                                type="number"
                                value={formData.pensionFee}
                                onChange={e => handleChange('pensionFee', e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                                style={{ background: 'var(--input-bg)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', color: 'var(--text-primary)' }}
                                onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>
                    </div>

                </form>

                {/* Footer */}
                <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 rounded-md text-sm font-medium border transition-colors cursor-pointer"
                        style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer"
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--btn-primary-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-primary-bg)'}
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

export default DeductionManagement;
