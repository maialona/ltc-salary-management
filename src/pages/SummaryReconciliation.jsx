import React, { useState, useRef, useEffect } from 'react';
import { CloudUpload, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { parseWelfareSummaryExcel } from '../utils/excelParser';
import { reconcileSummaries } from '../utils/summaryReconcile';
import { getCaseQuantity } from '../data/caseQuantityStore';
import { getWelfare, saveWelfare } from '../data/welfareStore';
import { getPeriod, subscribePeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';

const fmt = (n) => Number(n).toLocaleString();

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'mismatch', label: '有差異' },
  { key: 'recordOnly', label: '僅服務紀錄表' },
  { key: 'welfareOnly', label: '僅衛福部' },
];

const Cell = ({ value, isDiff, isMissing, isRight }) => {
  if (isMissing) {
    return (
      <td className={`px-4 py-3 text-right font-mono text-sm ${isRight ? 'border-l' : ''}`}
        style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', opacity: 0.45 }}>
        —
      </td>
    );
  }
  return (
    <td
      className={`px-4 py-3 text-right font-mono text-sm ${isRight ? 'border-l' : ''} ${isDiff ? 'bg-red-500/10' : ''}`}
      style={{ color: isDiff ? '#f87171' : 'var(--text-primary)', borderColor: 'var(--glass-border)' }}
    >
      {value}
    </td>
  );
};

const TotalCell = ({ value, isRight, dim }) => (
  <td
    className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${isRight ? 'border-l' : ''}`}
    style={{
      color: dim ? 'var(--text-secondary)' : 'var(--text-accent)',
      borderColor: 'var(--glass-border)',
    }}
  >
    {value}
  </td>
);

export default function SummaryReconciliation() {
  const { currentInstitution } = useInstitution();
  const [period, setPeriod] = useState(getPeriod());
  const [caseQuantity, setCaseQuantity] = useState(null);
  const [rows, setRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [filter, setFilter] = useState('all');
  const fileInputRef = useRef(null);

  const loadPeriod = (institution, p) => {
    const cq = getCaseQuantity(institution, p);
    const welfare = getWelfare(institution, p);
    setCaseQuantity(cq);
    setWarnings([]);
    if (cq && welfare) {
      setRows(reconcileSummaries(cq, welfare, p));
    } else {
      setRows([]);
    }
  };

  useEffect(() => {
    const p = getPeriod();
    setPeriod(p);
    loadPeriod(currentInstitution, p);
    return subscribePeriod((p2) => {
      setPeriod(p2);
      loadPeriod(currentInstitution, p2);
    });
  }, [currentInstitution]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    setIsProcessing(true);
    setRows([]);
    setWarnings([]);

    setTimeout(async () => {
      try {
        const welfareData = await parseWelfareSummaryExcel(file);
        if (!welfareData || welfareData.length === 0) {
          throw new Error('衛福部清冊解析失敗：找不到資料，請確認 header 在第 5 列');
        }
        saveWelfare(currentInstitution, period, welfareData);
        const reconciledRows = reconcileSummaries(caseQuantity, welfareData, period);
        setRows(reconciledRows);
      } catch (err) {
        console.error(err);
        setWarnings([`處理失敗: ${err.message}`]);
      } finally {
        setIsProcessing(false);
      }
    }, 300);
  };

  const hasCacheData = caseQuantity !== null && caseQuantity.length > 0;
  const filteredRows = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const stats = {
    total: rows.length,
    match: rows.filter((r) => r.status === 'match').length,
    mismatch: rows.filter((r) => r.status === 'mismatch').length,
    recordOnly: rows.filter((r) => r.status === 'recordOnly').length,
    welfareOnly: rows.filter((r) => r.status === 'welfareOnly').length,
  };

  const totals = {
    recQuantity: rows.reduce((s, r) => s + (r.record?.quantity ?? 0), 0),
    recGovAmount: rows.reduce((s, r) => s + (r.record?.govAmount ?? 0), 0),
    recSelfPayAmount: rows.reduce((s, r) => s + (r.record?.selfPayAmount ?? 0), 0),
    recSelfPayQuantity: rows.reduce((s, r) => s + (r.record?.selfPayQuantity ?? 0), 0),
    recSelfPaySubtotal: rows.reduce((s, r) => s + (r.record?.selfPaySubtotal ?? 0), 0),
    welQuantity: rows.reduce((s, r) => s + (r.welfare?.quantity ?? 0), 0),
    welGovAmount: rows.reduce((s, r) => s + (r.welfare?.govAmount ?? 0), 0),
    welSelfPayAmount: rows.reduce((s, r) => s + (r.welfare?.selfPayAmount ?? 0), 0),
  };

  const statusCards = [
    { label: '比對筆數', value: stats.total, color: 'var(--text-primary)' },
    { label: '完全一致', value: stats.match, color: '#34d399' },
    { label: '有差異', value: stats.mismatch, color: '#fb923c' },
    { label: '僅服務紀錄表', value: stats.recordOnly, color: '#a78bfa' },
    { label: '僅衛福部', value: stats.welfareOnly, color: '#f472b6' },
  ];

  const amountCards = [
    { label: '自費小計', value: fmt(totals.recSelfPaySubtotal), color: '#94a3b8' },
    { label: '服務紀錄表 / 申報金額', value: fmt(totals.recGovAmount), color: '#60a5fa' },
    { label: '服務紀錄表 / 部負費用', value: fmt(totals.recSelfPayAmount), color: '#60a5fa' },
    { label: '衛福部清冊 / 申報金額', value: fmt(totals.welGovAmount), color: '#34d399' },
    { label: '衛福部清冊 / 部負費用', value: fmt(totals.welSelfPayAmount), color: '#34d399' },
  ];

  return (
    <div className="space-y-6">

      {/* No-cache banner */}
      {!hasCacheData && (
        <div className="p-4 rounded-md border flex gap-3 items-start"
          style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <div className="p-1.5 rounded-md shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <h4 className="font-medium text-sm mb-0.5" style={{ color: '#f87171' }}>尚無服務紀錄表資料</h4>
            <p className="text-xs" style={{ color: 'rgba(248,113,113,0.75)' }}>
              請先至「B、G、S碼計算」頁上傳服務紀錄表（期別：{period}），系統將自動快取「個案服務數量」工作表。
            </p>
          </div>
        </div>
      )}

      {hasCacheData && (
        <>
          {/* Upload zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isProcessing}
          />

          {(isProcessing || rows.length === 0) && (
            <div
              className={`relative rounded-md border transition-all duration-300 glass-panel ${isProcessing ? 'h-52' : 'h-40 hover:h-52'}`}
              style={{ borderColor: 'var(--glass-border)', borderStyle: 'dashed', cursor: isProcessing ? 'default' : 'pointer' }}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'var(--glass-border)' }}></div>
                      <div className="absolute inset-0 rounded-full border-t-2 border-zinc-400 animate-spin"></div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>比對中...</h3>
                      <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>解析衛福部清冊</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="w-10 h-10 rounded-md flex items-center justify-center mx-auto mb-3 border"
                      style={{ background: 'var(--accordion-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                      <CloudUpload size={18} />
                    </div>
                    <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>衛福部照顧組合清冊上傳</h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>拖曳或點擊選擇 Excel 檔案（header 在第 5 列）</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {rows.length > 0 && !isProcessing && (
            <div className="flex justify-end">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-opacity hover:opacity-70"
                style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)', background: 'var(--accordion-bg)' }}
              >
                重新上傳衛福部清冊
              </button>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="p-4 rounded-md border flex gap-3 items-start"
              style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <div className="p-1.5 rounded-md shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                <AlertTriangle size={16} />
              </div>
              <ul className="text-xs list-disc list-inside space-y-0.5" style={{ color: '#f87171' }}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Summary cards */}
          {rows.length > 0 && !isProcessing && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="grid grid-cols-5 gap-2">
                {statusCards.map((card) => (
                  <div key={card.label} className="p-3 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="text-xs font-medium mb-1 leading-tight" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                      {card.label}
                    </div>
                    <div className="text-lg font-mono font-semibold" style={{ color: card.color }}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {amountCards.map((card) => (
                  <div key={card.label} className="p-3 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="text-xs font-medium mb-1 leading-tight" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                      {card.label}
                    </div>
                    <div className="text-base font-mono font-semibold" style={{ color: card.color }}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter pills */}
          {rows.length > 0 && !isProcessing && (
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={{
                    borderColor: filter === f.key ? 'var(--text-accent)' : 'var(--glass-border)',
                    color: filter === f.key ? 'var(--text-accent)' : 'var(--text-secondary)',
                    background: filter === f.key ? 'rgba(var(--accent-rgb, 99,102,241),0.08)' : 'transparent',
                  }}
                >
                  {f.label}
                  {f.key !== 'all' && (
                    <span className="ml-1.5 opacity-60">
                      {f.key === 'mismatch' ? stats.mismatch
                        : f.key === 'recordOnly' ? stats.recordOnly
                        : stats.welfareOnly}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Comparison table */}
          {rows.length > 0 && !isProcessing && (
            <div className="overflow-hidden rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                    <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                      <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium border-r" style={{ color: 'var(--table-header-text)', borderColor: 'var(--glass-border)' }}>個案</th>
                      <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium border-r" style={{ color: 'var(--table-header-text)', borderColor: 'var(--glass-border)' }}>服務項目</th>
                      <th colSpan={7} className="px-4 py-2 text-center text-xs font-medium border-r" style={{ color: '#60a5fa', borderColor: 'var(--glass-border)' }}>服務紀錄表</th>
                      <th colSpan={5} className="px-4 py-2 text-center text-xs font-medium" style={{ color: '#34d399' }}>衛福部清冊</th>
                    </tr>
                    <tr className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--table-header-bg)' }}>
                      <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: '#60a5fa' }}>服務月份</th>
                      {['次數', '申報費用', '部負比率', '部負費用', '自費數量', '自費小計'].map((h) => (
                        <th key={`rec-${h}`} className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#60a5fa' }}>{h}</th>
                      ))}
                      <th className="px-4 py-2 text-left text-xs font-medium border-l" style={{ color: '#34d399', borderColor: 'var(--glass-border)' }}>服務月份</th>
                      {['次數', '申報費用', '部負比率', '部負費用'].map((h) => (
                        <th key={`wel-${h}`} className="px-4 py-2 text-right text-xs font-medium" style={{ color: '#34d399' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {filter === 'all' ? '無資料' : '此類別無資料'}
                        </td>
                      </tr>
                    ) : filteredRows.map((row, idx) => {
                      const d = row.diffs;
                      const isMissR = row.record === null;
                      const isMissW = row.welfare === null;

                      const statusIcon = row.status === 'match'
                        ? <CheckCircle2 size={12} style={{ color: '#34d399', display: 'inline', marginRight: 5 }} />
                        : row.status === 'mismatch'
                        ? <AlertTriangle size={12} style={{ color: '#fb923c', display: 'inline', marginRight: 5 }} />
                        : <XCircle size={12} style={{ color: '#f472b6', display: 'inline', marginRight: 5 }} />;

                      return (
                        <tr key={idx} className="group transition-colors border-b hover:bg-white/[0.05]" style={{ borderColor: 'var(--glass-border)' }}>
                          <td className="px-4 py-3 text-sm font-medium border-r" style={{ color: 'var(--text-primary)', borderColor: 'var(--glass-border)' }}>
                            {statusIcon}{row.case}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm border-r" style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }} title={row.codeFullName}>
                            {row.code}
                          </td>

                          {/* Record side */}
                          {isMissR ? (
                            <td colSpan={7} className="px-4 py-3 text-center text-sm border-r" style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', opacity: 0.45 }}>
                              — 無資料 —
                            </td>
                          ) : (
                            <>
                              <td className={`px-4 py-3 text-sm font-mono ${d.includes('serviceMonth') ? 'bg-red-500/10' : ''}`}
                                style={{ color: d.includes('serviceMonth') ? '#f87171' : 'var(--text-secondary)' }}>
                                {row.record.serviceMonth}
                              </td>
                              <Cell value={row.record.quantity} isDiff={d.includes('quantity')} />
                              <Cell value={fmt(row.record.govAmount)} isDiff={d.includes('govAmount')} />
                              <Cell value={row.record.selfPayRatio} isDiff={d.includes('selfPayRatio')} />
                              <Cell value={fmt(row.record.selfPayAmount)} isDiff={d.includes('selfPayAmount')} />
                              <Cell value={row.record.selfPayQuantity} />
                              <Cell value={fmt(row.record.selfPaySubtotal)} />
                            </>
                          )}

                          {/* Welfare side */}
                          {isMissW ? (
                            <td colSpan={5} className="px-4 py-3 text-center text-sm border-l" style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', opacity: 0.45 }}>
                              — 無資料 —
                            </td>
                          ) : (
                            <>
                              <td className={`px-4 py-3 text-sm font-mono border-l ${d.includes('serviceMonth') ? 'bg-red-500/10' : ''}`}
                                style={{ borderColor: 'var(--glass-border)', color: d.includes('serviceMonth') ? '#f87171' : 'var(--text-secondary)' }}>
                                {row.welfare.serviceMonths.map((m, i) => (
                                  <span key={m} className={i > 0 ? 'ml-1.5' : ''}>{m}</span>
                                ))}
                              </td>
                              <Cell value={row.welfare.quantity} isDiff={d.includes('quantity')} />
                              <Cell value={fmt(row.welfare.govAmount)} isDiff={d.includes('govAmount')} />
                              <Cell value={row.welfare.selfPayRatio} isDiff={d.includes('selfPayRatio')} />
                              <Cell value={fmt(row.welfare.selfPayAmount)} isDiff={d.includes('selfPayAmount')} />
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10" style={{ background: 'var(--table-header-bg)' }}>
                    <tr className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold border-r" style={{ color: 'var(--table-header-text)', borderColor: 'var(--glass-border)' }}>
                        合計（全部 {rows.length} 筆）
                      </td>
                      <td className="px-4 py-2.5" />
                      <TotalCell value={totals.recQuantity} />
                      <TotalCell value={fmt(totals.recGovAmount)} />
                      <TotalCell value="—" dim />
                      <TotalCell value={fmt(totals.recSelfPayAmount)} />
                      <TotalCell value={totals.recSelfPayQuantity} />
                      <TotalCell value={fmt(totals.recSelfPaySubtotal)} />
                      <td className="px-4 py-2.5 border-l" style={{ borderColor: 'var(--glass-border)' }} />
                      <TotalCell value={totals.welQuantity} />
                      <TotalCell value={fmt(totals.welGovAmount)} />
                      <TotalCell value="—" dim />
                      <TotalCell value={fmt(totals.welSelfPayAmount)} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-4 py-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  顯示 {filteredRows.length} / {rows.length} 筆
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  期別：{period}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
