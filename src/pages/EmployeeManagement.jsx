import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Upload, Download, AlertCircle, Hash, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getEmployees, saveEmployee, updateEmployee, deleteEmployee, importEmployees, clearEmployees } from '../data/employeeStore';
import { generateUUID } from '../utils/uuid';
import ConfirmModal from '../components/ConfirmModal';
import { INSTITUTIONS, getInstitutionName } from '../constants/institutions.js';
import { useInstitution } from '../context/InstitutionContext.jsx';
import { getPeriod, subscribePeriod } from '../data/periodStore.js';

const safeNum = (v) => {
  if (v === '-' || v === '' || v === null || v === undefined) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const EmployeeManagement = () => {
  const { currentInstitution } = useInstitution();
  const [subTab, setSubTab] = useState('employees');
  const [overtimeRows, setOvertimeRows] = useState(() => {
    try { const s = localStorage.getItem(`overtime_rows_${getPeriod()}`); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    empId: '',
    name: '',
    idNumber: '',
    position: 'Full-time',
    organization: '',
    paymentMethod: '匯款',
    splits: { b: 0, g: 0, s: 0, missed: 0, aa09: 0 },
    laborInsuranceBracket: 0,
    laborInsuranceSelfPay: 0,
    healthInsuranceBracket: 0,
    healthDependents: 0,
    healthInsuranceSelfPay: 0,
    voluntaryPensionRate: 0,
    voluntaryPensionDeduction: 0,
    dependentsCount: 0,
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
  }, [currentInstitution]);

  useEffect(() => {
    const loadOvertime = (period) => {
      try {
        const s = localStorage.getItem(`overtime_rows_${period}`);
        setOvertimeRows(s ? JSON.parse(s) : []);
      } catch { setOvertimeRows([]); }
    };
    return subscribePeriod(loadOvertime);
  }, []);

  const loadEmployees = async () => {
    try {
      setEmployees(await getEmployees());
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOpenModal = (employee = null) => {
    setError('');
    if (employee) {
      setEditingEmployee(employee);
      setFormData(employee);
    } else {
      setEditingEmployee(null);
      setFormData({
        empId: '',
        name: '',
        idNumber: '',
        bankCode: '',
        bankAccount: '',
        position: 'Full-time',
        organization: currentInstitution,
        paymentMethod: '匯款',
        splits: { b: 0, g: 0, s: 0, missed: 0, aa09: 0 },
        laborInsuranceBracket: 0,
        laborInsuranceSelfPay: 0,
        healthInsuranceBracket: 0,
        healthDependents: 0,
        healthInsuranceSelfPay: 0,
        voluntaryPensionRate: 0,
        voluntaryPensionDeduction: 0,
        dependentsCount: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    showConfirm('刪除確認', '確定要刪除這位員工嗎？此動作無法復原。', 'danger', async () => {
        await deleteEmployee(id);
        await loadEmployees();
    });
  };

  const handleClearAll = () => {
    showConfirm('清除確認', '確定要清除所有員工資料嗎？此動作無法復原。', 'danger', async () => {
        await clearEmployees();
        await loadEmployees();
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingEmployee) {
        await updateEmployee(formData.id, formData);
      } else {
        await saveEmployee(formData);
      }
      setIsModalOpen(false);
      await loadEmployees();
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

  const handleBGSSplitChange = (value) => {
    const val = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      splits: { ...prev.splits, b: val, g: val, s: val, missed: val }
    }));
  };
  
  const handleDownloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('員工資料');

    sheet.columns = [
      { header: '員工編號', key: 'empId', width: 14 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '身分證字號', key: 'idNumber', width: 16 },
      { header: '職級', key: 'position', width: 12 },
      { header: '所屬機構', key: 'organization', width: 16 },
      { header: '薪資領取方式', key: 'paymentMethod', width: 14 },
      { header: 'BGS碼抽成', key: 'bgsSplit', width: 13 },
      { header: 'AA09抽成', key: 'aa09Split', width: 13 },
      { header: '銀行代碼', key: 'bankCode', width: 12 },
      { header: '匯款帳號', key: 'bankAccount', width: 20 },
      { header: '勞(就)保級距', key: 'laborInsuranceBracket', width: 16 },
      { header: '勞保+職災+就保(自付)', key: 'laborInsuranceSelfPay', width: 22 },
      { header: '健保級距', key: 'healthInsuranceBracket', width: 14 },
      { header: '健保眷屬人數', key: 'healthDependents', width: 14 },
      { header: '健保費(自付)', key: 'healthInsuranceSelfPay', width: 14 },
      { header: '勞退自提(%)', key: 'voluntaryPensionRate', width: 14 },
      { header: '應扣勞退自提', key: 'voluntaryPensionDeduction', width: 16 },
      { header: '扶養親屬人數', key: 'dependentsCount', width: 14 },
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    sheet.addRow({
      empId: 'C001', name: '王小明', idNumber: 'A123456789', position: 'Full-time',
      organization: '府城', paymentMethod: '匯款',
      bgsSplit: 60, aa09Split: 55,
      bankCode: '822', bankAccount: '1234567890123',
      laborInsuranceBracket: 26400, laborInsuranceSelfPay: 472,
      healthInsuranceBracket: 26400, healthDependents: 1, healthInsuranceSelfPay: 826,
      voluntaryPensionRate: 6, voluntaryPensionDeduction: 1584, dependentsCount: 2,
    });
    sheet.addRow({
      empId: 'C002', name: '李小花', idNumber: 'B987654321', position: 'Part-time',
      organization: '鴻康', paymentMethod: '領現',
      bgsSplit: 50, aa09Split: 45,
      bankCode: '004', bankAccount: '9876543210987',
      laborInsuranceBracket: 0, laborInsuranceSelfPay: 0,
      healthInsuranceBracket: 0, healthDependents: 0, healthInsuranceSelfPay: 0,
      voluntaryPensionRate: 0, voluntaryPensionDeduction: 0, dependentsCount: 0,
    });

    const lastCol = sheet.columns.length;
    const lastColLetter = String.fromCharCode(64 + lastCol);
    const note = sheet.getCell('A4');
    note.value = '※ 職級：Full-time / Part-time；薪資領取方式：匯款 / 領現；抽成填數字（如 60 代表 60%）；勞退自提(%)填 0~6';
    note.font = { color: { argb: 'FF6B7280' }, italic: true, size: 10 };
    sheet.mergeCells(`A4:${lastColLetter}4`);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '員工匯入範本.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { parseEmployeeExcel } = await import('../utils/excelParser');
      const newEmployees = await parseEmployeeExcel(file);
      const { count } = await importEmployees(newEmployees);
      showAlert('匯入成功', `成功匯入/更新 ${count} 筆員工資料。`, 'success');
      await loadEmployees();
    } catch (err) {
      showAlert('匯入失敗', '檔案匯入錯誤: ' + err.message, 'danger');
    } finally {
        e.target.value = null; 
    }
  };

  const handleOvertimeUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      const headers = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        headers[c] = cell ? String(cell.v ?? '').trim() : '';
      }
      const rows = [];
      for (let r = 1; r <= range.e.r; r++) {
        const get = (col) => { const cell = ws[XLSX.utils.encode_cell({ r, c: col })]; return cell ? cell.v ?? '' : ''; };
        const idx = (h) => headers.findIndex(x => x === h);
        const name = String(get(idx('姓名'))).trim();
        if (!name) continue;
        const actualHours = safeNum(get(idx('實際工時')));
        const transfer    = safeNum(get(idx('轉場')));
        const h134 = safeNum(get(idx('1.34')));
        const h167 = safeNum(get(idx('1.67')));
        const h267 = safeNum(get(idx('2.67')));
        const h1   = safeNum(get(idx('1')));
        const h2   = safeNum(get(idx('2')));
        const transferFee  = Math.round(transfer * 196);
        const overtimeFee  = Math.round((h134 + h167 + h267 + h1 + h2) * 200);
        rows.push({ name, actualHours, transfer, h134, h167, h267, h1, h2, transferFee, overtimeFee });
      }
      setOvertimeRows(rows);
      try { localStorage.setItem(`overtime_rows_${getPeriod()}`, JSON.stringify(rows)); } catch {}
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-8">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>員工管理</h2>
          </div>

          <div className="flex gap-2">
            {subTab === 'employees' && (<>
              <button onClick={handleDownloadTemplate} className="px-4 py-2 rounded-md border cursor-pointer transition-all text-sm font-medium flex items-center gap-2 glass-panel" style={{ color: 'var(--text-secondary)' }}>
                <Download size={14} /><span>下載範本</span>
              </button>
              <label className="px-4 py-2 rounded-md border cursor-pointer transition-all text-sm font-medium flex items-center gap-2 glass-panel" style={{ color: 'var(--text-secondary)' }}>
                <Upload size={14} /><span>匯入 Excel</span>
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <button onClick={handleClearAll} className="px-4 py-2 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium transition-all text-sm flex items-center gap-2 cursor-pointer">
                <Trash2 size={14} /><span>清除</span>
              </button>
              <button onClick={() => handleOpenModal()} className="px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 text-sm cursor-pointer"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--btn-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-primary-bg)'}>
                <Plus size={14} strokeWidth={2.5} /><span>新增員工</span>
              </button>
            </>)}
            {subTab === 'overtime' && (
              <label className="px-4 py-2 rounded-md border cursor-pointer transition-all text-sm font-medium flex items-center gap-2 glass-panel" style={{ color: 'var(--text-secondary)' }}>
                <Upload size={14} /><span>匯入 Excel</span>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleOvertimeUpload} />
              </label>
            )}
          </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--glass-border)' }}>
        {[{ id: 'employees', label: '員工名單', icon: null }, { id: 'overtime', label: '加班時數統計', icon: Clock }].map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2 cursor-pointer"
            style={{
              color: subTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: subTab === tab.id ? 'var(--text-primary)' : 'transparent',
            }}>
            {tab.icon && React.createElement(tab.icon, { size: 13 })}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overtime Tab */}
      {subTab === 'overtime' && (
        <div>
          {overtimeRows.length === 0 ? (
            <div className="h-64 rounded-md border flex flex-col items-center justify-center border-dashed"
                 style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
              <Clock size={24} className="mb-3 opacity-30" />
              <p className="font-medium text-sm">尚無資料</p>
              <p className="text-xs mt-1.5 opacity-60">請上傳加班費時數統計 Excel 檔案</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                      {['姓名','實際工時','轉場','1.34','1.67','2.67','1','2','轉場費','加班費'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium ${i >= 1 ? 'text-right' : ''}`} style={{ color: 'var(--table-header-text)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overtimeRows.map((row, idx) => {
                      const fmt = (v) => v === 0 ? '-' : v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                      return (
                        <tr key={idx} className="border-b hover:bg-white/[0.05] transition-colors" style={{ borderColor: 'var(--glass-border)' }}>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.name}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.actualHours)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.transfer)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.h134)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.h167)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.h267)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.h1)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.h2)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-amber-500">{row.transferFee > 0 ? `$${row.transferFee.toLocaleString()}` : '-'}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-right text-amber-500">{row.overtimeFee > 0 ? `$${row.overtimeFee.toLocaleString()}` : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accordion List View */}
      {subTab === 'employees' && <div className="space-y-2">
        {employees.length === 0 ? (
           <div className="h-64 rounded-md border flex flex-col items-center justify-center border-dashed"
                style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
             <p className="font-medium text-sm">暫無員工資料</p>
             <p className="text-xs mt-1.5 opacity-60">點擊右上方按鈕新增</p>
           </div>
        ) : (
          employees.map((emp) => {
            const isExpanded = expandedId === emp.id;
            return (
                <div key={emp.id}
                     className="group relative rounded-md border transition-all duration-200 overflow-hidden glass-panel"
                     style={{
                         borderColor: isExpanded ? 'var(--text-accent)' : 'var(--glass-border)',
                         background: 'var(--glass-bg)'
                     }}>

                    {/* List Header (Always Visible) */}
                    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                        {/* Left: clickable info area */}
                        <div
                            className="flex items-center gap-5 flex-1 min-w-0 cursor-pointer"
                            onClick={() => toggleAccordion(emp.id)}
                        >
                            {/* 員編 Badge */}
                            <div
                                className="w-10 h-10 shrink-0 rounded-md flex items-center justify-center text-xs font-medium font-mono"
                                style={{ background: 'var(--emp-icon-bg)', color: 'var(--emp-icon-text)' }}
                            >
                                {emp.empId}
                            </div>

                            {/* 姓名 */}
                            <span className="text-sm font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{emp.name}</span>

                            {/* 職級 */}
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                                emp.position === 'Full-time'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                                {emp.position === 'Full-time' ? '全職' : '兼職'}
                            </span>

                            {/* 薪資領取方式 */}
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                                (emp.paymentMethod || '匯款') === '匯款'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                            }`}>
                                {emp.paymentMethod || '匯款'}
                            </span>

                            {/* Chevron */}
                            <div className={`w-5 h-5 ml-auto shrink-0 flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                 style={{ color: 'var(--text-secondary)' }}>
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                            </div>
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleOpenModal(emp); }}
                                className="px-3 py-1.5 rounded-md border font-medium text-xs flex items-center gap-1.5 transition-all hover:bg-white/5 cursor-pointer"
                                style={{ borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                            >
                                <Edit2 size={12} /> 編輯
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                className="px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                                <Trash2 size={12} /> 刪除
                            </button>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden border-t" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                            <div className="p-5 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-4">

                                {/* Basic Info */}
                                <div className="p-4 rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                                    <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                                        <Hash size={11}/> 基本資訊
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>所屬機構</span>
                                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{getInstitutionName(emp.organization) || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>薪資領取方式</span>
                                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
                                                (emp.paymentMethod || '匯款') === '匯款'
                                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>{emp.paymentMethod || '匯款'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>銀行代碼</span>
                                            <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{emp.bankCode || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>匯款帳號</span>
                                            <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{emp.bankAccount || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Split Info */}
                                <div className="p-4 rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                                    <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                                        <Hash size={11}/> 抽成比例
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>BGS碼抽成</span>
                                            <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{emp.splits?.b ?? 0}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>AA09抽成</span>
                                            <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{emp.splits?.aa09 ?? 0}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Insurance Info */}
                                <div className="p-4 rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                                    <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                                        <Hash size={11}/> 勞健保 / 勞退
                                    </h4>
                                    <div className="space-y-2">
                                        {[
                                            { label: '勞(就)保級距', value: emp.laborInsuranceBracket },
                                            { label: '勞保+職災+就保(自付)', value: emp.laborInsuranceSelfPay },
                                            { label: '健保級距', value: emp.healthInsuranceBracket },
                                            { label: '健保眷屬人數', value: `${emp.healthDependents ?? 0} 人` },
                                            { label: '健保費(自付)', value: emp.healthInsuranceSelfPay },
                                            { label: '勞退自提', value: `${emp.voluntaryPensionRate ?? 0}%` },
                                            { label: '應扣勞退自提', value: emp.voluntaryPensionDeduction },
                                            { label: '扶養親屬人數', value: `${emp.dependentsCount ?? 0} 人` },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="flex justify-between">
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                                                <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{value ?? '-'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            );
          })
        )}
      </div>}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 transition-opacity duration-200"
             onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200"
               style={{
                   background: 'var(--modal-bg)',
                   borderRadius: 'var(--modal-radius)',
                   boxShadow: 'var(--modal-shadow)',
                   border: '1px solid var(--glass-border)'
               }}
               onClick={(e) => e.stopPropagation()}>

            <h3 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              {editingEmployee ? '編輯員工資料' : '新增員工'}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md flex items-center gap-2 text-xs">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block"
                         style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>員工編號</label>
                  <input
                    required
                    className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                    style={{
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        border: 'var(--input-border)',
                        borderRadius: 'var(--input-radius)',
                    }}
                    onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    value={formData.empId}
                    onChange={(e) => handleChange('empId', e.target.value)}
                    placeholder="C001"
                  />
                </div>
                 <div className="space-y-1.5">
                  <label className="block"
                         style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>職級</label>
                  <div className="relative">
                    <select
                        className="w-full px-3 py-2 text-sm outline-none transition-all appearance-none cursor-pointer"
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
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" style={{ color: 'var(--text-primary)' }}>
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>所屬機構</label>
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 text-sm outline-none transition-all appearance-none cursor-pointer"
                      style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                      onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                      onBlur={(e) => e.target.style.boxShadow = 'none'}
                      value={formData.organization || currentInstitution}
                      onChange={(e) => handleChange('organization', e.target.value)}
                    >
                      {INSTITUTIONS.map(inst => (
                        <option key={inst.code} value={inst.code} style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" style={{ color: 'var(--text-primary)' }}>
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>薪資領取方式</label>
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 text-sm outline-none transition-all appearance-none cursor-pointer"
                      style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                      onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                      onBlur={(e) => e.target.style.boxShadow = 'none'}
                      value={formData.paymentMethod || '匯款'}
                      onChange={(e) => handleChange('paymentMethod', e.target.value)}
                    >
                      <option style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }} value="匯款">匯款</option>
                      <option style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }} value="領現">領現</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" style={{ color: 'var(--text-primary)' }}>
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1L5 5L9 1"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>真實姓名</label>
                    <input
                    required
                    className="w-full px-3 py-2 text-sm outline-none transition-all"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                    onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="王小明"
                    />
                </div>
                <div className="space-y-1.5">
                     <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>身份證字號</label>
                    <input
                    required
                    className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                    onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    value={formData.idNumber}
                    onChange={(e) => handleChange('idNumber', e.target.value)}
                    placeholder="A123456789"
                    />
                </div>
              </div>

               <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-1.5">
                   <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>銀行代碼</label>
                   <input
                    className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                    onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    value={formData.bankCode || ''}
                    onChange={(e) => handleChange('bankCode', e.target.value)}
                    placeholder="822"
                   />
                </div>
                <div className="col-span-2 space-y-1.5">
                   <label className="block" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>匯款帳號</label>
                   <input
                    className="w-full px-3 py-2 text-sm outline-none transition-all font-mono"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                    onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    value={formData.bankAccount || ''}
                    onChange={(e) => handleChange('bankAccount', e.target.value)}
                    placeholder="帳號"
                   />
                </div>
              </div>

              {/* 抽成比例 */}
              <div className="p-4 rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                <label className="block mb-3" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>抽成比例</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>BGS碼抽成</label>
                    <div className="relative">
                      <input
                        type="number" min="0" max="100" step="0.1"
                        className="w-full px-3 py-2 text-sm text-center font-mono font-semibold outline-none transition-all"
                        style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                        onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                        value={formData.splits.b}
                        onChange={(e) => handleBGSSplitChange(e.target.value)}
                        placeholder="60"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-secondary)' }}>%</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>AA09抽成</label>
                    <div className="relative">
                      <input
                        type="number" min="0" max="100" step="0.1"
                        className="w-full px-3 py-2 text-sm text-center font-mono font-semibold outline-none transition-all"
                        style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)' }}
                        onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                        value={formData.splits.aa09 || 0}
                        onChange={(e) => handleChange('aa09', parseFloat(e.target.value) || 0, true)}
                        placeholder="55"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-secondary)' }}>%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 勞健保與勞退 */}
              <div className="p-4 rounded-md border" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                <label className="block mb-3" style={{ fontSize: 'var(--label-text-size)', fontWeight: 'var(--label-text-weight)', color: 'var(--label-text-color)' }}>勞健保 / 勞退</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '勞(就)保級距', field: 'laborInsuranceBracket', placeholder: '26400', unit: '' },
                    { label: '勞保+職災+就保(自付)', field: 'laborInsuranceSelfPay', placeholder: '472', unit: '' },
                    { label: '健保級距', field: 'healthInsuranceBracket', placeholder: '26400', unit: '' },
                    { label: '健保眷屬人數', field: 'healthDependents', placeholder: '0', unit: '人' },
                    { label: '健保費(自付)', field: 'healthInsuranceSelfPay', placeholder: '826', unit: '' },
                    { label: '勞退自提', field: 'voluntaryPensionRate', placeholder: '6', unit: '%' },
                    { label: '應扣勞退自提', field: 'voluntaryPensionDeduction', placeholder: '1584', unit: '' },
                    { label: '扶養親屬人數', field: 'dependentsCount', placeholder: '0', unit: '人' },
                  ].map(({ label, field, placeholder, unit }) => (
                    <div key={field} className="space-y-1.5">
                      <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                      <div className="relative">
                        <input
                          type="number" min="0" step="1"
                          className="w-full px-3 py-2 text-sm font-mono outline-none transition-all"
                          style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: 'var(--input-border)', borderRadius: 'var(--input-radius)', paddingRight: unit ? '2rem' : undefined }}
                          onFocus={(e) => e.target.style.boxShadow = 'var(--input-focus-ring)'}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                          value={formData[field] || 0}
                          onChange={(e) => setFormData(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                          placeholder={placeholder}
                        />
                        {unit && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-secondary)' }}>{unit}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 text-sm font-medium transition-colors cursor-pointer rounded-md border"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm font-medium transition-all cursor-pointer rounded-md"
                  style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--btn-primary-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-primary-bg)'}
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
