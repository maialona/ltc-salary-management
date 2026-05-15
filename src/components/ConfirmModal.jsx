import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

const TYPE_CONFIG = {
  danger:  { Icon: AlertTriangle, iconColor: '#ef4444',  iconBg: 'rgba(239,68,68,0.12)',  btnBg: '#ef4444',  btnHover: '#dc2626' },
  warning: { Icon: AlertTriangle, iconColor: '#f59e0b',  iconBg: 'rgba(245,158,11,0.12)', btnBg: 'var(--btn-primary-bg)', btnHover: null },
  success: { Icon: CheckCircle,   iconColor: '#10b981',  iconBg: 'rgba(16,185,129,0.12)', btnBg: 'var(--btn-primary-bg)', btnHover: null },
  info:    { Icon: Info,          iconColor: 'var(--text-secondary)', iconBg: 'var(--glass-border)', btnBg: 'var(--btn-primary-bg)', btnHover: null },
};

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '確定',
  cancelText = '取消',
  type = 'warning',
  isAlert = false,
}) => {
  if (!isOpen) return null;

  const { Icon, iconColor, iconBg, btnBg } = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
  const isDestructive = type === 'danger';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-sm"
        style={{
          background:    'var(--modal-bg)',
          borderRadius:  'var(--modal-radius)',
          boxShadow:     'var(--modal-shadow)',
          border:        '1px solid var(--glass-border)',
        }}
      >
        <div className="p-6 space-y-4">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center"
            style={{ background: iconBg }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>

          {/* Text */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {message}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-1">
            {!isAlert && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md text-xs font-medium border transition-colors cursor-pointer hover:opacity-80"
                style={{
                  color:       'var(--text-secondary)',
                  borderColor: 'var(--glass-border)',
                  background:  'transparent',
                }}
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={onConfirm || onClose}
              className="px-4 py-2 rounded-md text-xs font-medium transition-all active:scale-95 cursor-pointer hover:opacity-90"
              style={{
                background: isDestructive ? '#ef4444' : 'var(--btn-primary-bg)',
                color:      isDestructive ? '#fff'    : 'var(--btn-primary-text)',
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmModal;
