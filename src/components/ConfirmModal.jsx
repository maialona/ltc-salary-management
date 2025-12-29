import React from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = '確定', 
  cancelText = '取消',
  type = 'warning', // 'warning' | 'danger' | 'info' | 'success'
  isAlert = false // if true, hide cancel button
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="text-red-500" size={24} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={24} />;
      case 'success': return <CheckCircle className="text-emerald-500" size={24} />;
      default: return <Info className="text-blue-500" size={24} />;
    }
  };

  const getConfirmBtnStyle = () => {
    if (type === 'danger') return 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20';
    return 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ 
            background: 'var(--modal-bg)', 
            borderRadius: 'var(--modal-radius)', 
            boxShadow: 'var(--modal-shadow)',
            border: '1px solid var(--glass-border)'
        }}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${
                type === 'danger' ? 'bg-red-500/10' : 
                type === 'warning' ? 'bg-amber-500/10' : 
                type === 'success' ? 'bg-emerald-500/10' : 'bg-blue-500/10' 
            }`}>
              {getIcon()}
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
          {!isAlert && (
            <button 
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-bold hover:bg-black/5 transition-colors cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
            >
                {cancelText}
            </button>
          )}
          <button 
            onClick={onConfirm || onClose}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 cursor-pointer ${getConfirmBtnStyle()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
