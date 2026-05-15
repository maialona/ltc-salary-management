import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';

export default function UserMenu({ isCollapsed }) {
  const { dbUser, signOut } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!dbUser) return null;

  const initials = (dbUser.display_name || dbUser.email)
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="fixed left-2 bottom-28 w-44 rounded-lg p-3 z-50"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'var(--modal-shadow)' }}
          >
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>確定要登出嗎？</p>
            <div className="flex gap-2">
              <button
                onClick={() => { signOut(); setShowConfirm(false); }}
                className="flex-1 text-xs rounded px-2 py-1 cursor-pointer"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
              >
                登出
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 text-xs rounded px-2 py-1 cursor-pointer hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}
              >
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setShowConfirm(v => !v)}
        className="flex items-center w-full h-10 rounded-lg px-2.5 transition-colors duration-150 cursor-pointer hover:bg-white/5 gap-2 overflow-hidden"
        style={{ color: 'var(--text-secondary)' }}
        title={dbUser.email}
      >
        {/* Avatar */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}
        >
          {initials}
        </div>

        <motion.div
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          transition={{ duration: 0.15, delay: isCollapsed ? 0 : 0.08 }}
          className="flex-1 min-w-0 text-left"
          style={{ pointerEvents: 'none' }}
        >
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {dbUser.display_name || dbUser.email}
          </p>
        </motion.div>

        <motion.div
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          style={{ pointerEvents: 'none' }}
        >
          <LogOut size={13} className="shrink-0" />
        </motion.div>
      </button>
    </div>
  );
}
