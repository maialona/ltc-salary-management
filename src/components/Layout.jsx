import React, { useState } from 'react';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { AppSidebar } from './AppSidebar';

const COLLAPSED_W = '3.25rem';
const EXPANDED_W = '14rem';
const transition = { type: 'tween', ease: 'easeOut', duration: 0.2 };

const Layout = ({ activeTab, onTabChange, children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden selection:bg-zinc-200 dark:selection:bg-zinc-700">

      <AppSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content — margin-left tracks sidebar width */}
      <motion.main
        className="min-h-screen pt-8 pb-24 px-6 md:px-10"
        animate={{ marginLeft: sidebarCollapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={transition}
      >
        <div
          key={activeTab}
          className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out"
        >
          {children}
        </div>
      </motion.main>


    </div>
  );
};

export default Layout;
