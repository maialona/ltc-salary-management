import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
  Users, FileSpreadsheet, Coins, Banknote, Download,
  Calculator, Calendar, ChevronLeft, ChevronRight,
  Sun, Moon, ShieldCheck, ClipboardCheck,
} from 'lucide-react';
import { getPeriod, offsetPeriod, subscribePeriod } from '../data/periodStore';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext.jsx';
import InstitutionSelector from './InstitutionSelector.jsx';
import UserMenu from './UserMenu.jsx';

const COLLAPSED_W = '3.25rem';
const EXPANDED_W = '14rem';

const sidebarVariants = {
  open: { width: EXPANDED_W },
  closed: { width: COLLAPSED_W },
};

const transition = { type: 'tween', ease: 'easeOut', duration: 0.2 };

const ALL_NAV_ITEMS = [
  { id: 'employees', icon: Users, label: '員工管理', adminOnly: false },
  { id: 'records', icon: FileSpreadsheet, label: 'B、G、S碼計算', adminOnly: false },
  { id: 'acode', icon: Calculator, label: 'A碼計算', adminOnly: false },
  { id: 'reconcile', icon: ClipboardCheck, label: '總表核對', adminOnly: false },
  { id: 'bonuses', icon: Coins, label: '額外獎金', adminOnly: false },
  { id: 'deductions', icon: FileSpreadsheet, label: '應扣費用', adminOnly: false },
  { id: 'summary', icon: Banknote, label: '薪資報表', adminOnly: false },
  { id: 'download', icon: Download, label: '薪資表下載', adminOnly: false },
  { id: 'users', icon: ShieldCheck, label: '使用者管理', adminOnly: true },
];

function NavLabel({ isCollapsed, children }) {
  return (
    <motion.span
      animate={{ opacity: isCollapsed ? 0 : 1 }}
      transition={{ duration: 0.15, delay: isCollapsed ? 0 : 0.08 }}
      className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden leading-none"
      style={{ pointerEvents: 'none' }}
    >
      {children}
    </motion.span>
  );
}

export function AppSidebar({ activeTab, onTabChange, onCollapsedChange }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [period, setPeriod] = useState(getPeriod());
  const { theme, toggleTheme } = useTheme();
  const { dbUser } = useAuth();

  const navItems = ALL_NAV_ITEMS.filter(item => !item.adminOnly || dbUser?.role === 'admin');

  useEffect(() => {
    return subscribePeriod(setPeriod);
  }, []);

  const handleMouseEnter = () => {
    setIsCollapsed(false);
    onCollapsedChange?.(false);
  };

  const handleMouseLeave = () => {
    setIsCollapsed(true);
    onCollapsedChange?.(true);
  };

  return (
    <motion.aside
      className="fixed left-0 top-0 z-40 h-screen border-r flex-shrink-0 print:hidden flex flex-col overflow-hidden"
      style={{
        background: 'var(--nav-bg)',
        borderColor: 'var(--nav-border)',
      }}
      initial="closed"
      animate={isCollapsed ? 'closed' : 'open'}
      variants={sidebarVariants}
      transition={transition}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Institution Selector */}
      <InstitutionSelector isCollapsed={isCollapsed} />

      {/* Period Selector */}
      <div
        className="flex items-center h-14 border-b px-2 shrink-0 overflow-hidden relative"
        style={{ borderColor: 'var(--nav-border)' }}
      >
        {/* Expanded: full period navigator */}
        <motion.div
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-x-2.5 inset-y-0 flex items-center gap-1"
          style={{ pointerEvents: isCollapsed ? 'none' : 'auto' }}
        >
          <button
            onClick={() => offsetPeriod(-1)}
            className="p-1 rounded-md transition-colors cursor-pointer hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
            tabIndex={isCollapsed ? -1 : 0}
          >
            <ChevronLeft size={14} />
          </button>
          <div
            className="flex items-center gap-1.5 flex-1 justify-center font-mono text-xs font-bold"
            style={{ color: 'var(--text-accent)' }}
          >
            <Calendar size={12} className="opacity-70 shrink-0" />
            <span className="truncate">{period}</span>
          </div>
          <button
            onClick={() => offsetPeriod(1)}
            className="p-1 rounded-md transition-colors cursor-pointer hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
            tabIndex={isCollapsed ? -1 : 0}
          >
            <ChevronRight size={14} />
          </button>
        </motion.div>

        {/* Collapsed: calendar icon only */}
        <motion.div
          animate={{ opacity: isCollapsed ? 1 : 0 }}
          transition={{ duration: 0.1 }}
          className="flex items-center justify-center w-full"
          style={{ pointerEvents: 'none' }}
        >
          <Calendar size={16} style={{ color: 'var(--text-accent)' }} />
        </motion.div>
      </div>

      {/* Navigation — flex-1 so it fills space, py-3 for breathing room */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 flex flex-col gap-1.5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                flex items-center w-full h-10 rounded-lg px-2.5 shrink-0
                transition-colors duration-150 cursor-pointer text-left
                ${isActive ? '' : 'hover:bg-white/5'}
              `}
              style={{
                color: isActive ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                background: isActive ? 'var(--nav-active-bg)' : undefined,
              }}
            >
              {React.createElement(item.icon, {
                size: 16,
                strokeWidth: isActive ? 2.5 : 2,
                className: 'shrink-0',
              })}
              <NavLabel isCollapsed={isCollapsed}>{item.label}</NavLabel>
            </button>
          );
        })}
      </nav>

      {/* Bottom: User Menu + Theme Toggle */}
      <div
        className="border-t px-2 py-2 shrink-0 flex flex-col gap-1"
        style={{ borderColor: 'var(--nav-border)' }}
      >
        <UserMenu isCollapsed={isCollapsed} />
        <button
          onClick={toggleTheme}
          className="flex items-center w-full h-10 rounded-lg px-2.5 transition-colors duration-150 cursor-pointer hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="切換主題"
        >
          <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
            <Sun
              size={16}
              className={`absolute transition-all duration-300 ${
                theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'
              }`}
              style={{ color: '#f59e0b' }}
            />
            <Moon
              size={16}
              className={`absolute transition-all duration-300 ${
                theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'
              }`}
              style={{ color: '#818cf8' }}
            />
          </div>
          <NavLabel isCollapsed={isCollapsed}>
            {theme === 'dark' ? '深色模式' : '淺色模式'}
          </NavLabel>
        </button>
      </div>
    </motion.aside>
  );
}
