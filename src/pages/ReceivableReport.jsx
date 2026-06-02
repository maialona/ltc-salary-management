import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Wallet, Upload, Download, RefreshCw, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { parseReceivableRoster } from '../utils/excelParser';
import { buildReceivableRows } from '../utils/receivableProcessor';
import { exportReceivableExcel } from '../utils/receivable-excel';
import { saveReceivable, getReceivable, clearReceivable } from '../data/receivableStore';
import { getRevenueWelfare, getRevenueSelfPay, getRevenueSupervisor, getRevenueDistrict } from '../data/revenueDataStore';
import { getPeriod, subscribePeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import { getInstitutionFullName } from '../constants/institutions';

const fmt = (n) => {
  if (n === '' || n === null || n === undefined) return '';
  const num = Number(n);
  if (isNaN(num)) return n;
  return num.toLocaleString();
};

const SOURCE_DEFS = [
  { key: 'welfare',  label: '衛福部清冊',   hint: '請先至「總表核對」頁上傳衛福部清冊' },
  { key: 'selfpay',  label: '服務紀錄表（自費）', hint: '請先至「B、G、S碼計算」頁上傳服務紀錄表' },
  { key: 'supervisor', label: '居督對照表', hint: '請先至「B、G、S碼計算」頁上傳服務紀錄表' },
  { key: 'district', label: '區域對照表',   hint: '請先至「B、G、S碼計算」頁上傳服務紀錄表' },
];

const TABLE_COLS = [
  { key: '項次',              label: '項次',         w: 44,  num: false },
  { key: '單號',              label: '單號',         w: 100, num: false },
  { key: '身分證號',          label: '身分證號',     w: 96,  num: false },
  { key: '個案姓名',          label: '個案姓名',     w: 72,  num: false },
  { key: '福利身分別',        label: '福利身分別',   w: 72,  num: false },
  { key: '送單人',            label: '送單人',       w: 64,  num: false },
  { key: '繳款方式',          label: '繳款方式',     w: 88,  num: false },
  { key: '備註',              label: '備註',         w: 80,  num: false },
  { key: '區域',              label: '區域',         w: 56,  num: false },
  { key: '個案者主責督導',    label: '主責督導',     w: 72,  num: false },
  { key: '應收金額',          label: '應收金額',     w: 72,  num: true  },
  { key: '衛服部',            label: '衛服部',       w: 72,  num: true  },
  { key: '差異',              label: '差異',         w: 64,  num: true  },
  { key: '記帳金額',          label: '記帳金額',     w: 72,  num: true  },
  { key: '居-部分負擔',       label: '居-部負',      w: 64,  num: true  },
  { key: '喘-部分負擔',       label: '喘-部負',      w: 64,  num: true  },
  { key: '短-部分負擔',       label: '短-部負',      w: 64,  num: true  },
  { key: '居部+喘部+短部(B)', label: '部負合計(B)',  w: 80,  num: true  },
  { key: '居-全額自',         label: '居-全自',      w: 64,  num: true  },
  { key: '喘-全額自',         label: '喘-全自',      w: 64,  num: true  },
  { key: '短-全額自',         label: '短-全自',      w: 64,  num: true  },
  { key: '居+喘+短全自',      label: '全自合計',     w: 72,  num: true  },
];

export default function ReceivableReport() {
  const { currentInstitution } = useInstitution();
  const [period, setPeriod] = useState(getPeriod);
  const [roster, setRoster] = useState(() => getReceivable(currentInstitution, getPeriod()));
  const [sources, setSources] = useState(() => {
    const p = getPeriod();
    return {
      welfare:    getRevenueWelfare(currentInstitution, p),
      selfpay:    getRevenueSelfPay(currentInstitution, p),
      supervisor: getRevenueSupervisor(currentInstitution, p),
      district:   getRevenueDistrict(currentInstitution, p),
    };
  });
  const [rows, setRows] = useState([]);
  const [isBuilt, setIsBuilt] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef(null);

  const loadSources = (inst, p) => {
    const s = {
      welfare:    getRevenueWelfare(inst, p),
      selfpay:    getRevenueSelfPay(inst, p),
      supervisor: getRevenueSupervisor(inst, p),
      district:   getRevenueDistrict(inst, p),
    };
    setSources(s);
    const r = getReceivable(inst, p);
    setRoster(r);
    if (r) {
      const built = buildReceivableRows(r, s.welfare, s.selfpay, s.supervisor, s.district);
      setRows(built);
      setIsBuilt(true);
    } else {
      setRows([]);
      setIsBuilt(false);
    }
  };

  useEffect(() => {
    const p = getPeriod();
    setPeriod(p);
    loadSources(currentInstitution, p);
    return subscribePeriod((p2) => {
      setPeriod(p2);
      loadSources(currentInstitution, p2);
    });
  }, [currentInstitution]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    setIsUploading(true);
    try {
      const parsed = await parseReceivableRoster(file);
      saveReceivable(currentInstitution, period, parsed);
      setRoster(parsed);
      const built = buildReceivableRows(parsed, sources.welfare, sources.selfpay, sources.supervisor, sources.district);
      setRows(built);
      setIsBuilt(true);
    } catch (err) {
      console.error('parse error', err);
      alert(`解析失敗：${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBuild = () => {
    if (!roster) return;
    const built = buildReceivableRows(roster, sources.welfare, sources.selfpay, sources.supervisor, sources.district);
    setRows(built);
    setIsBuilt(true);
  };

  const handleClear = () => {
    clearReceivable(currentInstitution, period);
    setRoster(null);
    setRows([]);
    setIsBuilt(false);
  };

  const handleExport = async () => {
    if (!rows.length) return;
    setIsExporting(true);
    try {
      const fullName = getInstitutionFullName(currentInstitution);
      await exportReceivableExcel(rows, fullName, period);
    } finally {
      setIsExporting(false);
    }
  };

  const tableContainerRef = useRef(null);
  const totalsContainerRef = useRef(null);

  const handleTableScroll = () => {
    if (totalsContainerRef.current && tableContainerRef.current) {
      totalsContainerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 33,
    overscan: 10,
  });
  const virtualItems   = rowVirtualizer.getVirtualItems();
  const paddingTop     = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom  = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  const totals = TABLE_COLS.reduce((acc, c) => {
    if (c.num) acc[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    return acc;
  }, {});
  const totalReceivable = totals['應收金額'] ?? 0;
  const totalAccount    = totals['記帳金額'] ?? 0;
  const totalDiff       = totals['差異']     ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} style={{ color: 'var(--text-accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            應收管理
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}>
            {period}
          </span>
        </div>
        <div className="flex gap-2">
          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
          >
            <Upload size={12} />
            {isUploading ? '解析中…' : '上傳應收清冊'}
          </button>

          {/* Rebuild */}
          <button
            onClick={handleBuild}
            disabled={!roster}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
          >
            <RefreshCw size={12} />
            重新計算
          </button>

          {/* Clear */}
          {roster && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer"
              style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', background: 'transparent' }}
            >
              <RotateCcw size={12} />
              清除
            </button>
          )}

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={!rows.length || isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
            onMouseEnter={e => { if (rows.length && !isExporting) e.currentTarget.style.background = 'var(--glass-border)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Download size={14} />
            {isExporting ? '匯出中…' : '匯出 Excel'}
          </button>
        </div>
      </div>

      {/* Source status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SOURCE_DEFS.map(({ key, label, hint }) => {
          const data = sources[key];
          const loaded = data !== null && data !== undefined;
          const count = Array.isArray(data) ? data.length : (loaded ? Object.keys(data).length : 0);
          return (
            <div key={key} className="p-3 rounded-md border"
              style={{
                background: loaded ? 'rgba(52,211,153,0.05)' : 'rgba(239,68,68,0.04)',
                borderColor: loaded ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.15)',
              }}>
              <div className="flex items-center gap-1.5 mb-1">
                {loaded ? <CheckCircle2 size={13} color="#34d399" /> : <XCircle size={13} color="#f87171" />}
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
              </div>
              <div className="text-xs" style={{ color: loaded ? '#34d399' : '#f87171' }}>
                {loaded ? `${count} 筆` : '尚未載入'}
              </div>
              {!loaded && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{hint}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Roster status */}
      <div className="p-3 rounded-md border flex items-center gap-3"
        style={{
          background: roster ? 'rgba(52,211,153,0.05)' : 'rgba(96,165,250,0.04)',
          borderColor: roster ? 'rgba(52,211,153,0.2)' : 'rgba(96,165,250,0.15)',
        }}>
        {roster
          ? <CheckCircle2 size={14} color="#34d399" />
          : <XCircle size={14} color="#60a5fa" />
        }
        <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
          應收清冊：{roster ? `已載入 ${roster.length} 筆` : '尚未上傳，請點擊「上傳應收清冊」'}
        </div>
      </div>

      {/* Summary cards */}
      {isBuilt && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '應收金額合計', value: totalReceivable, color: 'var(--text-accent)' },
            { label: '記帳金額合計', value: totalAccount,    color: '#34d399' },
            { label: '差異合計',     value: totalDiff,       color: totalDiff === 0 ? '#34d399' : '#f87171' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
              <div className="text-base font-mono font-semibold" style={{ color }}>
                {Number(value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isBuilt && (
        rows.length === 0 ? (
          <div className="p-8 text-center rounded-md border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
            無資料
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--glass-border)' }}>
            {/* Data rows */}
            <div ref={tableContainerRef} onScroll={handleTableScroll} className="overflow-auto" style={{ maxHeight: 'calc(70vh - 33px)' }}>
              <table className="text-xs border-collapse" style={{ minWidth: '2000px' }}>
                <thead className="sticky top-0 z-20">
                  <tr style={{ background: 'var(--glass-bg)' }}>
                    <th className="sticky left-0 z-10 px-3 py-2 text-left font-semibold border-b border-r whitespace-nowrap"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)', minWidth: 32 }}>
                      #
                    </th>
                    {TABLE_COLS.map(c => (
                      <th key={c.key}
                        className="px-3 py-2 text-left font-semibold border-b whitespace-nowrap"
                        style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)', minWidth: c.w }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr><td colSpan={TABLE_COLS.length + 1} style={{ height: paddingTop }} /></tr>
                  )}
                  {virtualItems.map(virtualRow => {
                    const row = rows[virtualRow.index];
                    const idx = virtualRow.index;
                    const hasDiff = Number(row.差異) !== 0;
                    return (
                      <tr key={idx}
                        className="border-b transition-colors hover:bg-white/5"
                        style={{ borderColor: 'var(--glass-border)' }}>
                        <td className="sticky left-0 z-10 px-3 py-2 text-right font-mono border-r"
                          style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                          {idx + 1}
                        </td>
                        {TABLE_COLS.map(c => {
                          const val = row[c.key];
                          const isDiffCol = c.key === '差異';
                          return (
                            <td key={c.key}
                              className="px-3 py-2 whitespace-nowrap"
                              style={{
                                color: isDiffCol
                                  ? (hasDiff ? '#f87171' : '#34d399')
                                  : 'var(--text-primary)',
                                fontFamily: c.num ? 'monospace' : undefined,
                                textAlign: c.num ? 'right' : undefined,
                              }}>
                              {c.num ? fmt(val) : (val ?? '')}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr><td colSpan={TABLE_COLS.length + 1} style={{ height: paddingBottom }} /></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Totals row — always visible, synced horizontal scroll */}
            <div ref={totalsContainerRef} className="overflow-x-hidden border-t" style={{ borderColor: 'var(--glass-border)' }}>
              <table className="text-xs border-collapse" style={{ minWidth: '2000px' }}>
                <tbody>
                  <tr style={{ background: 'rgba(96,165,250,0.06)' }}>
                    <td className="sticky left-0 z-10 px-3 py-2 font-semibold border-r whitespace-nowrap"
                      style={{ background: 'rgba(96,165,250,0.06)', borderColor: 'var(--glass-border)', color: 'var(--text-accent)', minWidth: 32 }}>
                      合計
                    </td>
                    {TABLE_COLS.map((c, i) => {
                      if (!c.num) {
                        return (
                          <td key={c.key} className="px-3 py-2 whitespace-nowrap"
                            style={{ color: 'var(--text-secondary)', minWidth: c.w }}>
                            {i === 0 ? `${rows.length} 筆` : ''}
                          </td>
                        );
                      }
                      const val = totals[c.key] ?? 0;
                      const isDiffCol = c.key === '差異';
                      return (
                        <td key={c.key} className="px-3 py-2 whitespace-nowrap text-right font-mono font-semibold"
                          style={{
                            minWidth: c.w,
                            color: isDiffCol
                              ? (val !== 0 ? '#f87171' : '#34d399')
                              : 'var(--text-accent)',
                          }}>
                          {fmt(val)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {!isBuilt && !roster && (
        <div className="p-8 text-center rounded-md border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
          請上傳應收清冊以開始計算
        </div>
      )}
    </div>
  );
}
