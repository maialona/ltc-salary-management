import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, AlertTriangle, ChevronDown, CloudUpload, FileText, RotateCcw } from 'lucide-react';
import { parseServiceRecordExcel, parseCaseQuantityExcel, parseSupervisorMap } from '../utils/excelParser';
import { processSalaryCalculation } from '../utils/calculator';
import { getEmployees } from '../data/employeeStore';
import { saveRecords } from '../data/recordsStore';
import { saveRevenueSelfPay, saveRevenueSupervisor, saveRevenueDistrict, getRevenueSelfPay, getRevenueSupervisor } from '../data/revenueDataStore';
import { getPeriod, subscribePeriod } from '../data/periodStore';
import { saveCaseQuantity } from '../data/caseQuantityStore';
import { useInstitution } from '../context/InstitutionContext';
import { getInstitutionName } from '../constants/institutions';

const fmt = (val, decimals = 1) =>
  val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const bgsKey = (institution, period) => `bgs_calc_state_${institution}_${period}`;

const RecordsProcessing = () => {
  const { currentInstitution } = useInstitution();
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const fileInputRef = useRef(null);
  const revenueSnapshotRef = useRef({ supervisorMap: null, selfPayRows: null, districtMap: null });

  const loadFromStorage = (institution, period) => {
    try {
      const savedState = localStorage.getItem(bgsKey(institution, period));
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.results && parsed.results.length > 0) {
          setResults(parsed.results);
          setWarnings(parsed.warnings ?? []);
          // 補回 revenue 資料（若 localStorage 被清除）
          if (parsed.supervisorMap && !getRevenueSupervisor(institution, period))
            saveRevenueSupervisor(institution, period, parsed.supervisorMap);
          if (parsed.selfPayRows && !getRevenueSelfPay(institution, period))
            saveRevenueSelfPay(institution, period, parsed.selfPayRows);
          if (parsed.districtMap) saveRevenueDistrict(institution, period, parsed.districtMap);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to restore BGS state', e);
    }
    setResults([]);
    setWarnings([]);
  };

  useEffect(() => {
    loadFromStorage(currentInstitution, getPeriod());
    return subscribePeriod((period) => loadFromStorage(currentInstitution, period));
  }, [currentInstitution]);

  React.useEffect(() => {
    if (results.length > 0) {
      try {
        const snap = revenueSnapshotRef.current;
        localStorage.setItem(bgsKey(currentInstitution, getPeriod()), JSON.stringify({
          results,
          warnings,
          supervisorMap: snap.supervisorMap,
          selfPayRows: snap.selfPayRows,
          districtMap: snap.districtMap,
        }));
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
          setWarnings(prev => [...prev, '系統警告：資料量過大超出瀏覽器限制 (5MB)，本次計算結果將無法於關閉後自動還原。']);
        }
      }
    }
  }, [results, warnings]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    setIsProcessing(true);
    setResults([]);
    setWarnings([]);

    try {
      const rawData = await parseServiceRecordExcel(file);

        // 同步快取「個案服務數量」工作表，供「總表核對」頁使用
        try {
          const caseQty = await parseCaseQuantityExcel(file);
          if (caseQty.length > 0) saveCaseQuantity(currentInstitution, getPeriod(), caseQty);
        } catch (e) {
          console.warn('parseCaseQuantityExcel failed (non-blocking):', e);
        }

        // Piggyback: 儲存居督對照表與自費明細，供「營業額」頁使用
        const { supervisorMap, districtMap, serviceDateMap } = await parseSupervisorMap(file).catch(e => {
          console.error('parseSupervisorMap failed:', e);
          return { supervisorMap: {}, districtMap: {}, serviceDateMap: {} };
        });
        if (Object.keys(supervisorMap).length > 0) saveRevenueSupervisor(currentInstitution, getPeriod(), supervisorMap);
        if (Object.keys(districtMap).length > 0) saveRevenueDistrict(currentInstitution, getPeriod(), districtMap);

        const employees = await getEmployees();

        if (!rawData || rawData.length === 0) {
          throw new Error('Excel 檔案似乎是空的或無法讀取，請確認工作表名稱含有「服務員服務個案計算」且第3列為標題列');
        }

        // Piggyback: 儲存自費明細，供「營業額」頁使用
        const selfPayRows = rawData
          .filter(r => (r.自費數量 ?? 0) > 0)
          .map(r => ({
            個案: r.Client,
            服務項目: r.服務項目,
            自費單價: r.自費單價,
            自費數量: r.自費數量,
            自費小計: r.自費小計,
            服務員: r.服務員,
            服務日期: serviceDateMap[r.Client] || '',
            目前居住行政區: districtMap[r.Client] || '',
          }));
        if (selfPayRows.length > 0) {
          saveRevenueSelfPay(currentInstitution, getPeriod(), selfPayRows);
        }
        // 快照供 BGS 狀態持久化，reload 後可補回 revenue 資料
        revenueSnapshotRef.current = {
          supervisorMap: Object.keys(supervisorMap).length > 0 ? supervisorMap : null,
          selfPayRows: selfPayRows.length > 0 ? selfPayRows : null,
          districtMap: Object.keys(districtMap).length > 0 ? districtMap : null,
        };

        const { results: calcResults, warnings: calcWarnings } = processSalaryCalculation(rawData, employees);

        if (calcResults.length === 0) {
          setWarnings(prev => [...prev, ...calcWarnings, '未找到符合的薪資資料。請確認欄位名稱是否正確（需包含: 服務員, 個案, 服務項目, 補助小計 等）']);
        } else {
          setWarnings(calcWarnings);

          const recordsToSave = calcResults.map(res => ({
            empId: res.employee.empId,
            b: res.breakdown['B'].splitSum,
            g: res.breakdown['G'].splitSum,
            s: res.breakdown['S'].splitSum,
            missed: res.breakdown['Missed'].splitSum,
            selfPay: ['B', 'G', 'S', 'Missed'].reduce((acc, t) => acc + res.breakdown[t].selfPaySplit, 0),
            breakdown: res.breakdown,
          }));
          await saveRecords(recordsToSave);
        }

        setResults(calcResults);
      } catch (err) {
        console.error(err);
        setWarnings([`處理失敗: ${err.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  // --- Global summary values (memoized) ---
  const { globalStats, globalSelfPayRaw, summaryCards } = useMemo(() => {
    const TYPES = ['B', 'G', 'S', 'Missed'];
    const globalStats = TYPES.reduce((acc, t) => {
      acc[t] = {
        raw:   results.reduce((s, r) => s + r.breakdown[t].rawSum,   0),
        split: results.reduce((s, r) => s + r.breakdown[t].splitSum, 0),
      };
      return acc;
    }, {});
    const globalSelfPayRaw = results.reduce(
      (s, r) => s + TYPES.reduce((a, t) => a + r.breakdown[t].selfPayRaw, 0), 0
    );
    const summaryCards = [
      { label: 'B碼申請金額',  value: globalStats['B'].raw,       color: 'text-blue-400' },
      { label: 'G碼申請金額',  value: globalStats['G'].raw,       color: 'text-emerald-400' },
      { label: 'S碼申請金額',  value: globalStats['S'].raw,       color: 'text-purple-400' },
      { label: '未遇金額',     value: globalStats['Missed'].raw,  color: 'text-orange-400' },
      { label: 'B碼拆帳金額',  value: globalStats['B'].split,     color: 'text-blue-500' },
      { label: 'G碼拆帳金額',  value: globalStats['G'].split,     color: 'text-emerald-500' },
      { label: 'S碼拆帳金額',  value: globalStats['S'].split,     color: 'text-purple-500' },
      { label: '未遇拆帳金額', value: globalStats['Missed'].split, color: 'text-orange-500' },
      { label: '自費金額',     value: globalSelfPayRaw,           color: 'text-pink-500' },
    ];
    return { globalStats, globalSelfPayRaw, summaryCards };
  }, [results]);

  // Pre-compute groupedByClient for all results (O(1) map lookup, runs only when results change)
  const groupedByEmp = useMemo(() => {
    const out = {};
    results.forEach(res => {
      const allItems = [
        ...res.breakdown['B'].items,
        ...res.breakdown['G'].items,
        ...res.breakdown['S'].items,
        ...res.breakdown['Missed'].items,
      ];
      const byClient = {};
      allItems.forEach(item => {
        const key = item.client || 'Unknown';
        if (!byClient[key]) byClient[key] = { client: key, itemMap: {} };
        const existing = byClient[key].itemMap[item.code];
        if (existing) {
          existing.count        += item.count;
          existing.amount       += item.amount;
          existing.split        += item.split;
          existing.selfPayAmount += item.selfPayAmount;
          existing.selfPaySplit  += item.selfPaySplit;
        } else {
          byClient[key].itemMap[item.code] = { ...item };
        }
      });
      out[res.employee.id] = Object.values(byClient).map(g => ({
        client: g.client,
        items:  Object.values(g.itemMap),
      }));
    });
    return out;
  }, [results]);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>B、G、S碼計算</h2>
        <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>{getInstitutionName(currentInstitution)}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}>{getPeriod()}</span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        className="hidden"
        disabled={isProcessing}
      />

      {/* Upload Zone — hidden once results are loaded */}
      {(isProcessing || results.length === 0) && (
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
                  <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>分析中...</h3>
                  <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>解析資料結構</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="w-10 h-10 rounded-md flex items-center justify-center mx-auto mb-3 border"
                  style={{ background: 'var(--accordion-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <CloudUpload size={18} />
                </div>
                <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>服務清冊上傳</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>拖曳或點擊選擇 Excel 檔案（工作表：服務員服務個案計算，第3列為標題）</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Re-upload button — shown after successful parse */}
      {results.length > 0 && !isProcessing && (
        <div className="flex justify-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)', background: 'var(--accordion-bg)' }}
          >
            <RotateCcw size={12} />
            重新上傳
          </button>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-4 rounded-md bg-red-500/5 border border-red-500/20 flex gap-3 items-start animate-in slide-in-from-top-4">
          <div className="p-1.5 bg-red-500/10 rounded-md text-red-500 shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h4 className="font-medium text-red-400 text-sm mb-1">錯誤提醒</h4>
            <ul className="list-disc list-inside text-xs text-red-400/70 font-mono space-y-0.5">
              {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Global Summary Cards */}
      {results.length > 0 && !isProcessing && (
        <div className="grid grid-cols-3 lg:grid-cols-9 gap-2 animate-in fade-in duration-300">
          {summaryCards.map(card => (
            <div key={card.label} className="p-3 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
              <div className="text-xs font-medium mb-1 leading-tight" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                {card.label}
              </div>
              <div className={`text-sm font-mono font-semibold ${card.color}`}>
                ${fmt(card.value, 0)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results List */}
      <div className="space-y-2">
        {results.length > 0 && !isProcessing && (
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px flex-1" style={{ background: 'var(--glass-border)' }}></span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>共 {results.length} 筆</span>
          </div>
        )}

        {results.map((res) => {
          const isExpanded = expandedId === res.employee.id;
          const bd = res.breakdown;

          const hasMissed = bd['Missed'].rawSum > 0 || bd['Missed'].splitSum > 0 || bd['Missed'].selfPayRaw > 0;
          const hasSelfPay = ['B', 'G', 'S', 'Missed'].some(t => bd[t].selfPayRaw > 0);

          // Tags for accordion header
          const tagDefs = [
            { key: 'B申', value: bd['B'].rawSum, color: 'text-blue-400 border-blue-400/20' },
            { key: 'B拆', value: bd['B'].splitSum, color: 'text-blue-500 border-blue-500/20' },
            { key: 'G申', value: bd['G'].rawSum, color: 'text-emerald-400 border-emerald-400/20' },
            { key: 'G拆', value: bd['G'].splitSum, color: 'text-emerald-500 border-emerald-500/20' },
            { key: 'S申', value: bd['S'].rawSum, color: 'text-purple-400 border-purple-400/20' },
            { key: 'S拆', value: bd['S'].splitSum, color: 'text-purple-500 border-purple-500/20' },
            ...(hasMissed ? [
              { key: '未遇', value: bd['Missed'].rawSum, color: 'text-orange-400 border-orange-400/20' },
              { key: '未遇拆', value: bd['Missed'].splitSum, color: 'text-orange-500 border-orange-500/20' },
            ] : []),
            ...(hasSelfPay ? [
              { key: '自費', value: ['B', 'G', 'S', 'Missed'].reduce((a, t) => a + bd[t].selfPayRaw, 0), color: 'text-pink-400 border-pink-400/20' },
            ] : []),
          ].filter(t => t.value > 0);

          // Expanded summary cards
          const empSummaryCards = [
            { label: 'B碼申請', value: bd['B'].rawSum, color: 'text-blue-400' },
            { label: 'B碼拆帳', value: bd['B'].splitSum, color: 'text-blue-500' },
            { label: 'G碼申請', value: bd['G'].rawSum, color: 'text-emerald-400' },
            { label: 'G碼拆帳', value: bd['G'].splitSum, color: 'text-emerald-500' },
            { label: 'S碼申請', value: bd['S'].rawSum, color: 'text-purple-400' },
            { label: 'S碼拆帳', value: bd['S'].splitSum, color: 'text-purple-500' },
            ...(hasMissed ? [
              { label: '未遇金額', value: bd['Missed'].rawSum, color: 'text-orange-400' },
              { label: '未遇拆帳', value: bd['Missed'].splitSum, color: 'text-orange-500' },
            ] : []),
            ...(hasSelfPay ? [
              { label: '自費金額', value: ['B', 'G', 'S', 'Missed'].reduce((a, t) => a + bd[t].selfPayRaw, 0), color: 'text-pink-400' },
            ] : []),
          ];

          const groupedByClient = groupedByEmp[res.employee.id] || [];

          return (
            <div key={res.employee.id} className="relative">
              <div
                onClick={() => toggleExpand(res.employee.id)}
                className="relative rounded-md border transition-all duration-200 cursor-pointer glass-panel"
                style={{ borderColor: isExpanded ? 'var(--text-accent)' : 'var(--glass-border)' }}
              >
                <div className="px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* Left: Identity + Tags */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center font-medium text-sm border"
                      style={{ background: 'var(--emp-icon-bg)', borderColor: 'var(--glass-border)', color: 'var(--emp-icon-text)' }}>
                      {res.employee.empId}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {res.employee.name}
                        </h3>
                        <span className="px-1.5 py-0.5 rounded border text-xs font-mono bg-violet-500/10 text-violet-400 border-violet-500/20">
                          BGS {res.employee.splits?.b ?? 0}%
                        </span>
                        <div className="flex gap-1 flex-wrap">
                          {tagDefs.map(tag => (
                            <span key={tag.key}
                              className={`px-1.5 py-0.5 rounded border text-xs font-mono ${tag.color}`}>
                              {tag.key} ${fmt(tag.value, 0)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Total */}
                  <div className="flex items-center gap-6 pl-4 xl:pl-0 border-l xl:border-l-0" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="text-right">
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>拆帳總額</p>
                      <p className="text-xl font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        ${fmt(res.splitTotal)}
                      </p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-4 border-t animate-in fade-in duration-200" style={{ borderColor: 'var(--glass-border)' }}>

                    {/* Summary Cards Grid */}
                    <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${empSummaryCards.length}, minmax(0, 1fr))` }}>
                      {empSummaryCards.map(card => (
                        <div key={card.label} className="p-2 rounded-md border overflow-hidden" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                          <div className="text-xs font-medium mb-1 truncate" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>{card.label}</div>
                          <div className={`text-xs sm:text-sm lg:text-base font-mono font-semibold truncate ${card.color}`}>${fmt(card.value, 1)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Service Detail Table */}
                    <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>
                      <FileText size={11} /> 服務細項明細
                    </h4>
                    <div className="overflow-hidden rounded border max-h-[500px] overflow-y-auto" style={{ borderColor: 'var(--glass-border)' }}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)', color: 'var(--table-header-text)' }}>
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">服務項目</th>
                            <th className="px-3 py-2 text-right font-medium">政府補助單價</th>
                            <th className="px-3 py-2 text-right font-medium">數量</th>
                            <th className="px-3 py-2 text-right font-medium">申請金額</th>
                            <th className="px-3 py-2 text-right font-medium">拆帳金額</th>
                            {hasSelfPay && <th className="px-3 py-2 text-right font-medium">自費申請</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {groupedByClient.map((group, idx) => {
                            const clientTotalAmount = group.items.reduce((s, i) => s + i.amount, 0);
                            const clientTotalSplit = group.items.reduce((s, i) => s + i.split, 0);
                            const clientSelfPayAmount = group.items.reduce((s, i) => s + i.selfPayAmount, 0);
                            const colSpanCount = 5 + (hasSelfPay ? 1 : 0);
                            return (
                              <React.Fragment key={idx}>
                                <tr className="border-t" style={{ borderColor: 'var(--glass-border)', background: 'var(--accordion-bg)' }}>
                                  <td colSpan={colSpanCount} className="px-3 py-1" style={{ borderColor: 'var(--glass-border)' }}>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{group.client}</span>
                                    <span className="font-mono ml-3" style={{ color: 'var(--text-primary)', fontSize: '0.7rem' }}>${fmt(clientTotalAmount, 0)}</span>
                                    <span className="mx-1" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>/</span>
                                    <span className="font-mono font-semibold" style={{ color: 'var(--text-accent)', fontSize: '0.7rem' }}>${fmt(clientTotalSplit, 1)}</span>
                                    {clientSelfPayAmount > 0 && <span className="font-mono ml-2" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>自費 ${fmt(clientSelfPayAmount, 0)}</span>}
                                  </td>
                                </tr>
                                {group.items.map((item, i) => (
                                  <tr key={i} className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                                    <td className="px-3 py-1.5 pl-6 font-mono" style={{ color: 'var(--text-secondary)' }}>{item.code}</td>
                                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{item.unitPrice > 0 ? `$${fmt(item.unitPrice, 0)}` : '—'}</td>
                                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{item.count}</td>
                                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>${fmt(item.amount, 0)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-accent)' }}>${fmt(item.split, 1)}</td>
                                    {hasSelfPay && <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{item.selfPayAmount > 0 ? `$${fmt(item.selfPayAmount, 0)}` : '—'}</td>}
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecordsProcessing;
