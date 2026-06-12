import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TrendingUp, Download, RefreshCw, CheckCircle2, XCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { getRevenueWelfare, getRevenueAcode, getRevenueSelfPay, getRevenueSupervisor } from '../data/revenueDataStore';
import { buildRevenueRows } from '../utils/revenueProcessor';
import { exportRevenueExcel } from '../utils/revenue-excel';
import { getPeriod, subscribePeriod } from '../data/periodStore';
import { useInstitution } from '../context/InstitutionContext';
import { getInstitutionName, getInstitutionFullName } from '../constants/institutions';

const fmt = (n) => Number(n || 0).toLocaleString();

const SOURCE_DEFS = [
  { key: 'welfare',    label: '衛福部清冊',     hint: '請先至「總表核對」頁上傳衛福部清冊' },
  { key: 'acode',      label: 'A碼核定清冊',    hint: '請先至「A碼計算」頁執行計算' },
  { key: 'selfpay',    label: '服務紀錄表（自費）', hint: '請先至「B、G、S碼計算」頁上傳服務紀錄表' },
  { key: 'supervisor', label: '居督對照表',     hint: '請先至「B、G、S碼計算」頁上傳服務紀錄表' },
];

const TABLE_COLS = [
  { key: '所屬機構',       label: '所屬機構',   w: 60 },
  { key: '申報年月',       label: '申報年月',   w: 68 },
  { key: '服務年月',       label: '服務年月',   w: 68 },
  { key: '類別',           label: '類別',       w: 52 },
  { key: '細項',           label: '細項',       w: 80 },
  { key: '身分證號',       label: '身分證號',   w: 100 },
  { key: '個案姓名',       label: '個案姓名',   w: 72 },
  { key: '採用計畫',       label: '採用計畫',   w: 160 },
  { key: 'CMS等級',        label: 'CMS等級',    w: 64 },
  { key: '福利身分別',     label: '福利身分別', w: 80 },
  { key: '服務項目類別',   label: '服務項目',   w: 180 },
  { key: '服務日期',       label: '服務日期',   w: 120 },
  { key: '給付價格',       label: '給付價格',   w: 72 },
  { key: '次數',           label: '次數',       w: 48 },
  { key: '申報費用',       label: '申報費用',   w: 72 },
  { key: '部分負擔比率',   label: '部負比率',   w: 64 },
  { key: '部分負擔費用',   label: '部負費用',   w: 72 },
  { key: '補助比率',       label: '補助比率',   w: 64 },
  { key: '申請補助費用',   label: '申請費用',   w: 72 },
  { key: '實際補助金額',   label: '補助金額',   w: 72 },
  { key: '服務當下居住縣市', label: '服務縣市', w: 72 },
  { key: '目前居住縣市',   label: '目前縣市',   w: 64 },
  { key: '個案主責督導',   label: '主責督導',   w: 72 },
  { key: '目前居住行政區', label: '行政區',     w: 64 },
  { key: '照管專員',       label: '照管專員',   w: 72 },
  { key: '服務人員',       label: '服務人員',   w: 160 },
  { key: '碼別',           label: '碼別',       w: 52 },
];

const DateCell = ({ value }) => {
  const [expanded, setExpanded] = useState(false);
  if (!value) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  const dates = String(value).split(',').map(d => d.trim()).filter(Boolean);
  if (dates.length <= 1) return <span>{value}</span>;
  return (
    <span className="flex items-center gap-1.5 flex-nowrap">
      <span>{dates[0]}</span>
      {expanded
        ? <>
            {dates.slice(1).map((d, i) => <span key={i}>{d}</span>)}
            <button
              onClick={() => setExpanded(false)}
              className="px-1 rounded text-xs cursor-pointer transition-colors"
              style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)' }}
            >
              收合
            </button>
          </>
        : <button
            onClick={() => setExpanded(true)}
            className="px-1.5 rounded text-xs cursor-pointer transition-colors"
            style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}
          >
            more
          </button>
      }
    </span>
  );
};

const CODE_COLORS = {
  'B碼': { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa' },
  'G碼': { bg: 'rgba(52,211,153,0.12)', text: '#34d399' },
  'S碼': { bg: 'rgba(251,146,60,0.12)', text: '#fb923c' },
  'A碼': { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa' },
  '':    { bg: 'transparent',           text: 'var(--text-secondary)' },
};

const PIVOT_CATS = [
  { cat: '全自費', items: ['居服B碼'] },
  { cat: '居服',   items: ['居服A碼', '居服B碼'] },
  { cat: '喘息',   items: ['喘息A碼', '喘息G碼'] },
  { cat: '短照',   items: ['短照A碼', '短照S碼'] },
];

function SupervisorPivotTable({ rows }) {
  const tree = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const sup  = r.個案主責督導    || '（未指定）';
      const dist = r.目前居住行政區  || '（未知）';
      const cat  = r.類別           || '';
      const item = r.細項           || '';
      const amt  = Number(r.申報費用) || 0;
      if (!map[sup]) map[sup] = {};
      if (!map[sup][dist]) map[sup][dist] = {};
      const key = `${cat}|${item}`;
      map[sup][dist][key] = (map[sup][dist][key] || 0) + amt;
    }
    return Object.entries(map).map(([sup, dists]) => ({
      supervisor: sup,
      districts:  Object.entries(dists).map(([dist, amts]) => ({ district: dist, amts })),
    }));
  }, [rows]);

  const catTotal  = (amts, cat, items) => items.reduce((s, i) => s + (amts[`${cat}|${i}`] || 0), 0);
  const grandTotal = (amts) => PIVOT_CATS.reduce((s, { cat, items }) => s + catTotal(amts, cat, items), 0);
  const mergeAmts  = (districts) => {
    const merged = {};
    for (const { amts } of districts)
      for (const [k, v] of Object.entries(amts)) merged[k] = (merged[k] || 0) + v;
    return merged;
  };
  const tdAmt = (v) => v ? fmt(v) : '—';
  const thSt  = { borderColor: 'var(--glass-border)', color: 'var(--text-secondary)', background: 'var(--glass-bg)' };

  const allAmts = tree.length ? mergeAmts(tree.flatMap(({ districts }) => districts)) : {};

  return (
    <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--glass-border)' }}>
      <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <table className="text-xs border-collapse" style={{ minWidth: '860px' }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold border-b border-r whitespace-nowrap sticky left-0 z-30" style={{ ...thSt, minWidth: 100 }}>督導 / 行政區</th>
              {PIVOT_CATS.map(({ cat, items }) => (
                <th key={cat} colSpan={items.length + 1} className="px-3 py-2 text-center font-semibold border-b border-r whitespace-nowrap" style={thSt}>{cat}</th>
              ))}
              <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-b whitespace-nowrap" style={thSt}>總計</th>
            </tr>
            <tr>
              {PIVOT_CATS.map(({ cat, items }) => (
                <React.Fragment key={cat}>
                  {items.map(item => (
                    <th key={item} className="px-3 py-1.5 text-right font-semibold border-b whitespace-nowrap" style={thSt}>{item}</th>
                  ))}
                  <th className="px-3 py-1.5 text-right font-semibold border-b border-r whitespace-nowrap" style={{ ...thSt, color: 'var(--text-accent)' }}>合計</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {tree.map(({ supervisor, districts }) => {
              const supAmts = mergeAmts(districts);
              return (
                <React.Fragment key={supervisor}>
                  {/* supervisor row */}
                  <tr style={{ background: 'var(--nav-active-bg)' }}>
                    <td className="sticky left-0 z-10 px-3 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ background: 'var(--nav-active-bg)', color: 'var(--text-accent)', borderColor: 'var(--glass-border)' }}>
                      {supervisor}
                    </td>
                    {PIVOT_CATS.map(({ cat, items }) => (
                      <React.Fragment key={cat}>
                        {items.map(item => (
                          <td key={item} className="px-3 py-1.5 text-right font-mono border-b" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-accent)' }}>
                            {tdAmt(supAmts[`${cat}|${item}`])}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right font-mono font-semibold border-b border-r" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-accent)' }}>
                          {tdAmt(catTotal(supAmts, cat, items))}
                        </td>
                      </React.Fragment>
                    ))}
                    <td className="px-3 py-1.5 text-right font-mono font-semibold border-b" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-accent)' }}>
                      {tdAmt(grandTotal(supAmts))}
                    </td>
                  </tr>
                  {/* district rows */}
                  {districts.map(({ district, amts }) => (
                    <tr key={district} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--glass-border)' }}>
                      <td className="sticky left-0 z-10 px-3 py-1.5 border-r whitespace-nowrap pl-6" style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', borderColor: 'var(--glass-border)' }}>
                        {district}
                      </td>
                      {PIVOT_CATS.map(({ cat, items }) => (
                        <React.Fragment key={cat}>
                          {items.map(item => (
                            <td key={item} className="px-3 py-1.5 text-right font-mono" style={{ color: amts[`${cat}|${item}`] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {tdAmt(amts[`${cat}|${item}`])}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right font-mono font-semibold border-r" style={{ borderColor: 'var(--glass-border)', color: catTotal(amts, cat, items) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {tdAmt(catTotal(amts, cat, items))}
                          </td>
                        </React.Fragment>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {tdAmt(grandTotal(amts))}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {tree.length > 0 && (
              <tr style={{ background: 'rgba(96,165,250,0.06)' }}>
                <td className="sticky left-0 z-10 px-3 py-2 border-t border-r whitespace-nowrap font-semibold" style={{ background: 'rgba(96,165,250,0.06)', color: 'var(--text-accent)', borderColor: 'var(--glass-border)' }}>總計</td>
                {PIVOT_CATS.map(({ cat, items }) => (
                  <React.Fragment key={cat}>
                    {items.map(item => (
                      <td key={item} className="px-3 py-2 text-right font-mono border-t" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-accent)' }}>
                        {tdAmt(allAmts[`${cat}|${item}`])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono font-semibold border-t border-r" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-accent)' }}>
                      {tdAmt(catTotal(allAmts, cat, items))}
                    </td>
                  </React.Fragment>
                ))}
                <td className="px-3 py-2 text-right font-mono font-semibold border-t" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-accent)' }}>
                  {tdAmt(grandTotal(allAmts))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RevenueReport() {
  const { currentInstitution } = useInstitution();

  const [period, setPeriod] = useState(getPeriod);
  const [sources, setSources] = useState(() => {
    const p = getPeriod();
    return {
      welfare:    getRevenueWelfare(currentInstitution, p),
      acode:      getRevenueAcode(currentInstitution, p),
      selfpay:    getRevenueSelfPay(currentInstitution, p),
      supervisor: getRevenueSupervisor(currentInstitution, p),
    };
  });
  const [rows, setRows] = useState(() => {
    const p = getPeriod();
    const welfare    = getRevenueWelfare(currentInstitution, p);
    if (!welfare) return [];
    const acode      = getRevenueAcode(currentInstitution, p);
    const selfpay    = getRevenueSelfPay(currentInstitution, p);
    const supervisor = getRevenueSupervisor(currentInstitution, p);
    return buildRevenueRows(welfare, acode, selfpay, supervisor, getInstitutionName(currentInstitution), p);
  });
  const [isBuilt, setIsBuilt] = useState(() => getRevenueWelfare(currentInstitution, getPeriod()) !== null);
  const [isExporting, setIsExporting] = useState(false);
  const [view, setView] = useState('detail');
  const [sort, setSort] = useState({ col: null, dir: 'asc' });

  const loadAndBuild = (inst, p) => {
    const welfare    = getRevenueWelfare(inst, p);
    const acode      = getRevenueAcode(inst, p);
    const selfpay    = getRevenueSelfPay(inst, p);
    const supervisor = getRevenueSupervisor(inst, p);
    setSources({ welfare, acode, selfpay, supervisor });
    if (welfare !== null) {
      const built = buildRevenueRows(welfare, acode, selfpay, supervisor, getInstitutionName(inst), p);
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
    loadAndBuild(currentInstitution, p);
    return subscribePeriod((p2) => {
      setPeriod(p2);
      loadAndBuild(currentInstitution, p2);
    });
  }, [currentInstitution]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuild = () => {
    const institutionName = getInstitutionName(currentInstitution);
    const built = buildRevenueRows(
      sources.welfare,
      sources.acode,
      sources.selfpay,
      sources.supervisor,
      institutionName,
      period,
    );
    setRows(built);
    setIsBuilt(true);
  };

  const handleExport = async () => {
    if (!rows.length) return;
    setIsExporting(true);
    try {
      const fullName = getInstitutionFullName(currentInstitution);
      await exportRevenueExcel(rows, fullName, period);
    } catch (err) {
      alert(`匯出失敗：${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const { totalRevenue, selfPayTotal, byCode } = useMemo(() => {
    const totalRevenue = rows.reduce((s, r) => s + (Number(r.申報費用) || 0), 0);
    const selfPayTotal = rows.filter(r => r.類別 === '全自費').reduce((s, r) => s + (Number(r.申報費用) || 0), 0);
    const byCode = rows.reduce((acc, r) => {
      const k = r.碼別 || '其他';
      if (k === 'B碼' && !(r.類別 === '居服' && r.細項 === '居服B碼')) return acc;
      if (k === 'G碼' && !(r.類別 === '喘息' && r.細項 === '喘息G碼')) return acc;
      if (k === 'S碼' && !(r.類別 === '短照' && r.細項 === '短照S碼')) return acc;
      acc[k] = (acc[k] || 0) + (Number(r.申報費用) || 0);
      return acc;
    }, {});
    return { totalRevenue, selfPayTotal, byCode };
  }, [rows]);

  const NUM_COLS = new Set(['給付價格', '次數', '申報費用', '部分負擔比率', '部分負擔費用', '補助比率', '申請補助費用', '實際補助金額']);

  const sortedRows = useMemo(() => {
    if (!sort.col) return rows;
    const isNum = NUM_COLS.has(sort.col);
    return [...rows].sort((a, b) => {
      const av = isNum ? (Number(a[sort.col]) || 0) : String(a[sort.col] ?? '');
      const bv = isNum ? (Number(b[sort.col]) || 0) : String(b[sort.col] ?? '');
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sort]);

  const handleSort = useCallback((colKey) => {
    setSort(prev =>
      prev.col === colKey
        ? { col: colKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col: colKey, dir: 'asc' }
    );
  }, []);

  const tableContainerRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 33,
    overscan: 10,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop    = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  const canBuild = sources.welfare !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} style={{ color: 'var(--text-accent)' }} />
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>營業額</h2>
          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>{getInstitutionName(currentInstitution)}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}>
            {period}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBuild}
            disabled={!canBuild}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--glass-bg)' }}
          >
            <RefreshCw size={12} />
            產生營業額
          </button>
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

      {/* Data source status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SOURCE_DEFS.map(({ key, label, hint }) => {
          const loaded = sources[key] !== null && sources[key] !== undefined;
          const count = Array.isArray(sources[key])
            ? sources[key].length
            : (sources[key] ? Object.keys(sources[key]).length : 0);
          return (
            <div key={key}
              className="p-3 rounded-md border"
              style={{
                background: loaded ? 'rgba(52,211,153,0.05)' : 'rgba(239,68,68,0.04)',
                borderColor: loaded ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.15)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {loaded
                  ? <CheckCircle2 size={13} color="#34d399" />
                  : <XCircle size={13} color="#f87171" />
                }
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

      {/* Summary cards */}
      {isBuilt && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="p-3 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="text-xs font-medium mb-1 leading-tight" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>總申報費用</div>
            <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-accent)' }}>
              {fmt(totalRevenue)}
            </div>
          </div>
          {['B碼', 'G碼', 'S碼', 'A碼'].map(k => (
            <div key={k} className="p-3 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
              <div className="text-xs font-medium mb-1 leading-tight" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>{k}</div>
              <div className="text-base font-mono font-semibold" style={{ color: CODE_COLORS[k]?.text }}>
                {fmt(byCode[k] ?? 0)}
              </div>
            </div>
          ))}
          <div className="p-3 rounded-md border glass-panel" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="text-xs font-medium mb-1 leading-tight" style={{ color: 'var(--text-secondary)', fontSize: 'var(--label-text-size)' }}>全自費</div>
            <div className="text-base font-mono font-semibold" style={{ color: '#fbbf24' }}>
              {fmt(selfPayTotal)}
            </div>
          </div>
        </div>
      )}

      {/* View toggle */}
      {isBuilt && rows.length > 0 && (
        <div className="flex gap-1">
          {[{ id: 'detail', label: '明細' }, { id: 'supervisor', label: '督導摘要' }].map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition cursor-pointer"
              style={{
                background:   view === id ? 'var(--nav-active-bg)' : 'transparent',
                color:        view === id ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                border:       '1px solid',
                borderColor:  view === id ? 'var(--nav-active-bg)' : 'var(--glass-border)',
              }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {isBuilt && (
        rows.length === 0 ? (
          <div className="p-8 text-center rounded-md border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
            無資料。請確認衛福部清冊已上傳。
          </div>
        ) : (
          view === 'supervisor' ? (
            <SupervisorPivotTable rows={rows} />
          ) : (
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--glass-border)' }}>
            <div ref={tableContainerRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
              <table className="text-xs border-collapse" style={{ minWidth: '2400px' }}>
                <thead className="sticky top-0 z-20">
                  <tr style={{ background: 'var(--glass-bg)' }}>
                    <th className="sticky left-0 z-10 px-3 py-2 text-left font-semibold border-b border-r whitespace-nowrap"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)', minWidth: 32 }}>
                      #
                    </th>
                    {TABLE_COLS.map(c => {
                      const isActive = sort.col === c.key;
                      const SortIcon = isActive ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
                      return (
                        <th key={c.key}
                          onClick={() => handleSort(c.key)}
                          className="px-3 py-2 text-left font-semibold border-b whitespace-nowrap cursor-pointer select-none"
                          style={{ borderColor: 'var(--glass-border)', color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)', minWidth: c.w }}>
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            <SortIcon size={11} opacity={isActive ? 1 : 0.4} />
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr><td colSpan={TABLE_COLS.length + 1} style={{ height: paddingTop }} /></tr>
                  )}
                  {virtualItems.map(virtualRow => {
                    const row = sortedRows[virtualRow.index];
                    const idx = virtualRow.index;
                    const codeColor = CODE_COLORS[row.碼別] ?? CODE_COLORS[''];
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
                          const isAmt = ['申報費用', '部分負擔費用', '給付價格', '申請補助費用', '實際補助金額'].includes(c.key);
                          const isCode = c.key === '碼別';
                          const isFine = c.key === '細項';
                          const isDate = c.key === '服務日期';
                          return (
                            <td key={c.key}
                              className={`px-3 py-2${isDate ? '' : ' whitespace-nowrap'}`}
                              style={{
                                color: isCode || isFine ? codeColor.text : 'var(--text-primary)',
                                fontFamily: isAmt ? 'monospace' : undefined,
                                textAlign: isAmt ? 'right' : undefined,
                              }}>
                              {isDate
                                ? <DateCell value={val} />
                                : isAmt && val !== '' && val !== null && val !== undefined
                                  ? fmt(val)
                                  : (val ?? '')}
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
          </div>
          )
        )
      )}

      {!isBuilt && canBuild && (
        <div className="p-8 text-center rounded-md border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
          點擊「產生營業額」開始合併資料
        </div>
      )}

      {!canBuild && (
        <div className="p-4 rounded-md border flex gap-3 items-start"
          style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <XCircle size={16} color="#f87171" className="shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium" style={{ color: '#f87171' }}>衛福部清冊尚未載入</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              請先至「總表核對」頁上傳衛福部清冊，資料會自動儲存供此頁使用。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
