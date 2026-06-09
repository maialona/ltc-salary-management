import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { useInstitution } from '../context/InstitutionContext';
import { getInstitutionName } from '../constants/institutions';
import { getRevenueHistory } from '../utils/revenueAnalytics';
import { getSalaryTrend, periodToLabel } from '../utils/salaryAnalytics';

const CODE_COLORS = {
  'B碼': '#60a5fa',
  'G碼': '#34d399',
  'S碼': '#fb923c',
  'A碼': '#a78bfa',
};

const SALARY_COLORS = {
  bgs:   '#60a5fa',
  acode: '#a78bfa',
  total: 'var(--text-accent)',
};

const fmt = (n) => Number(n || 0).toLocaleString();

const CustomTooltip = ({ active, payload, label, valueFormatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border px-3 py-2 text-xs space-y-1"
      style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}：</span>
          <span className="font-mono">{valueFormatter ? valueFormatter(p.value) : fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const yTickFmt = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
};

const pctTickFmt = (v) => `${(v * 100).toFixed(0)}%`;
const pctValFmt  = (v) => `${(v * 100).toFixed(1)}%`;

const axisStyle = { fontSize: 11, fill: 'var(--text-secondary)' };

const EmptyState = ({ msg }) => (
  <div className="flex items-center justify-center h-48 rounded-md border text-sm"
    style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
    {msg ?? '尚無資料。'}
  </div>
);

// ── Section 1: Monthly total revenue line chart ──────────────────────────────
function RevenueTrendChart({ data }) {
  if (!data.length) return <EmptyState msg="尚無資料。請先至「營業額」頁產生各月份的營業額資料。" />;
  return (
    <div className="rounded-md border p-4" style={{ borderColor: 'var(--glass-border)' }}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis dataKey="label" tick={axisStyle} />
          <YAxis tickFormatter={yTickFmt} tick={axisStyle} width={52} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone" dataKey="total" name="總申報費用"
            stroke="var(--text-accent)" strokeWidth={2}
            dot={{ r: 3, fill: 'var(--text-accent)' }} activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Section 2: Code proportion line chart ────────────────────────────────────
function CodeProportionChart({ data }) {
  if (!data.length) return <EmptyState msg="尚無資料。請先至「營業額」頁產生各月份的營業額資料。" />;

  const normalized = data.map(d => {
    const sum = (d['B碼'] || 0) + (d['G碼'] || 0) + (d['S碼'] || 0) + (d['A碼'] || 0);
    if (!sum) return { label: d.label, 'B碼': 0, 'G碼': 0, 'S碼': 0, 'A碼': 0 };
    return {
      label: d.label,
      'B碼': d['B碼'] / sum,
      'G碼': d['G碼'] / sum,
      'S碼': d['S碼'] / sum,
      'A碼': d['A碼'] / sum,
    };
  });

  return (
    <div className="rounded-md border p-4" style={{ borderColor: 'var(--glass-border)' }}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={normalized} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis dataKey="label" tick={axisStyle} />
          <YAxis tickFormatter={pctTickFmt} tick={axisStyle} width={40} domain={[0, 1]} />
          <Tooltip content={<CustomTooltip valueFormatter={pctValFmt} />} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
          {Object.entries(CODE_COLORS).map(([code, color]) => (
            <Line
              key={code} type="monotone" dataKey={code} name={code}
              stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Section 3: Employee salary trend ─────────────────────────────────────────
function SalaryTrendChart({ trendData }) {
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  const { periods, employees } = trendData ?? { periods: [], employees: [] };

  // Default to first employee when data loads
  useEffect(() => {
    if (employees.length && !selectedEmpId) {
      setSelectedEmpId(employees[0].empId);
    }
  }, [employees]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = useMemo(() => {
    if (!selectedEmpId || !periods.length) return [];
    const emp = employees.find(e => e.empId === selectedEmpId);
    if (!emp) return [];
    return periods.map(p => {
      const bgs   = emp.periods[p]?.bgs   ?? 0;
      const acode = emp.periods[p]?.acode ?? 0;
      return { label: periodToLabel(p), bgs, acode, total: bgs + acode };
    });
  }, [selectedEmpId, periods, employees]);

  if (!employees.length) {
    return <EmptyState msg="尚無資料。請先至「B、G、S碼計算」頁上傳服務紀錄表並計算。" />;
  }

  return (
    <div className="space-y-3">
      {/* Employee selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>選擇員工：</span>
        <select
          value={selectedEmpId ?? ''}
          onChange={e => setSelectedEmpId(e.target.value)}
          className="text-xs rounded-md border px-2 py-1 outline-none"
          style={{
            background: 'var(--glass-bg)', color: 'var(--text-primary)',
            borderColor: 'var(--glass-border)',
          }}
        >
          {employees.map(e => (
            <option key={e.empId} value={e.empId}>{e.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-md border p-4" style={{ borderColor: 'var(--glass-border)' }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
            <XAxis dataKey="label" tick={axisStyle} />
            <YAxis tickFormatter={yTickFmt} tick={axisStyle} width={52} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
            <Line type="monotone" dataKey="bgs"   name="BGS薪資"  stroke={SALARY_COLORS.bgs}   strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="acode" name="A碼獎金"  stroke={SALARY_COLORS.acode} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="total" name="合計"      stroke={SALARY_COLORS.total} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { currentInstitution } = useInstitution();
  const [revenueData, setRevenueData]   = useState([]);
  const [trendData,   setTrendData]     = useState(null);
  const [trendError,  setTrendError]    = useState(false);

  useEffect(() => {
    setRevenueData(getRevenueHistory(currentInstitution));
    setTrendData(null);
    setTrendError(false);
    getSalaryTrend()
      .then(setTrendData)
      .catch(() => setTrendError(true));
  }, [currentInstitution]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 size={18} style={{ color: 'var(--text-accent)' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>分析</h2>
        <span className="text-xs px-2 py-0.5 rounded-full border"
          style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
          {getInstitutionName(currentInstitution)}
        </span>
      </div>

      {/* 1. Revenue trend */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>每月總申報費用</h3>
        <RevenueTrendChart data={revenueData} />
      </section>

      {/* 2. Code proportion */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>各碼別佔比變化</h3>
        <CodeProportionChart data={revenueData} />
      </section>

      {/* 3. Employee salary trend */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>員工薪資趨勢</h3>
        {trendError ? (
          <EmptyState msg="載入失敗，請確認伺服器連線正常。" />
        ) : !trendData ? (
          <div className="flex items-center justify-center h-48 rounded-md border text-xs"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
            載入中…
          </div>
        ) : (
          <SalaryTrendChart trendData={trendData} />
        )}
      </section>
    </div>
  );
}
