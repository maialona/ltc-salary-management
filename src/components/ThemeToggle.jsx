import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        p-2.5 rounded-full transition-all duration-300 ease-in-out border cursor-pointer
        ${theme === 'light' 
          ? 'bg-white/50 text-amber-500 border-amber-200 hover:bg-white hover:shadow-amber-100/50 hover:shadow-lg' 
          : 'bg-slate-800/50 text-indigo-300 border-indigo-500/30 hover:bg-indigo-950/50 hover:text-indigo-200 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]'}
      `}
      aria-label="Toggle Theme"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
         <Sun 
            size={20} 
            className={`absolute transition-all duration-500 ${theme === 'light' ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`} 
         />
         <Moon 
            size={20} 
            className={`absolute transition-all duration-500 ${theme === 'dark' ? 'rotate-0 opacity-100 scale-100' : 'rotate-90 opacity-0 scale-50'}`} 
         />
      </div>
    </button>
  );
};

export default ThemeToggle;
