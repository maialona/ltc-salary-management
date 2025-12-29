import React, { useState, useEffect } from 'react';
import { Users, FileSpreadsheet, Coins, Banknote, Download, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getPeriod, offsetPeriod, subscribePeriod } from '../data/periodStore';
import ThemeToggle from './ThemeToggle';

const Layout = ({ activeTab, onTabChange, children }) => {
  const [period, setPeriod] = useState(getPeriod());

  useEffect(() => {
    // Subscribe to period changes to update UI
    const unsubscribe = subscribePeriod((newPeriod) => {
      setPeriod(newPeriod);
    });
    return unsubscribe;
  }, []);

  const tabs = [
    { id: 'employees', icon: Users, label: '員工管理' },
    { id: 'records', icon: FileSpreadsheet, label: 'B、G、S碼計算' },
    { id: 'bonuses', icon: Coins, label: '額外獎金' },
    { id: 'deductions', icon: FileSpreadsheet, label: '應扣費用' },
    { id: 'summary', icon: Banknote, label: '薪資總表' },
    { id: 'download', icon: Download, label: '薪資表下載' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden selection:bg-cyan-500/30">
      
      {/* Floating Island Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-float flex flex-col md:flex-row items-center gap-4 print:hidden">
        
        {/* Period Selector */}
        <div 
          className="flex items-center backdrop-blur-2xl border rounded-full px-1.5 py-1.5 shadow-2xl ring-1 ring-white/5 order-2 md:order-1 whitespace-nowrap transition-colors duration-500"
          style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
        >
             <button onClick={() => offsetPeriod(-1)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer">
                <ChevronLeft size={16} />
             </button>
             <div className="flex items-center gap-2 px-4 font-mono font-bold" style={{ color: 'var(--text-accent)' }}>
                <Calendar size={14} className="opacity-70"/>
                <span>{period}</span>
             </div>
             <button onClick={() => offsetPeriod(1)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer">
                <ChevronRight size={16} />
             </button>
        </div>

        {/* Tabs */}
        <div 
          className="flex p-1.5 backdrop-blur-2xl border rounded-full shadow-2xl ring-1 ring-white/5 order-1 md:order-2 transition-colors duration-500"
          style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative px-6 py-2.5 rounded-full text-xs font-bold flex items-center gap-2.5 transition-all duration-500 ease-out whitespace-nowrap cursor-pointer
                  ${isActive ? '' : 'hover:bg-white/5'}
                `}
                style={{ 
                  color: isActive ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--nav-active-bg)' : 'transparent',
                  boxShadow: isActive ? '0 0 20px rgba(var(--accent-rgb), 0.3)' : 'none'
                }}
              >
                <tab.icon size={14} strokeWidth={2.5} style={{ color: isActive ? 'var(--nav-active-text)' : 'inherit', opacity: isActive ? 1 : 0.7 }} />
                <span className="tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Theme Toggle */}
        <div className="order-3">
            <ThemeToggle />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="w-full max-w-7xl mx-auto pt-32 px-6 md:px-12 pb-24 print:pt-0 print:px-0 print:pb-0 print:max-w-none">
         <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
            {children}
         </div>
      </main>
      
      {/* Background Ambient Glows */}
      <div className="ambient-glow fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none -z-10 animate-pulse-slow print:hidden"></div>
      <div className="ambient-glow fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none -z-10 print:hidden"></div>

    </div>
  );
};

export default Layout;
