import React from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const Modal = ({ isOpen, title, content, type = 'info', onConfirm, onCancel, showCancel = false, confirmText = '確定', cancelText = '取消' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="text-red-500 w-6 h-6" />;
      case 'success': return <CheckCircle className="text-green-500 w-6 h-6" />;
      case 'warning': return <AlertTriangle className="text-yellow-500 w-6 h-6" />;
      default: return <Info className="text-blue-500 w-6 h-6" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity">
      <div className="rounded-md shadow-lg max-w-md w-full mx-4 flex flex-col max-h-[85vh] relative" style={{ background: 'var(--modal-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
        <div className="p-6 overflow-y-auto custom-scrollbar">
            <div className="flex items-start">
            <div className="mr-3 mt-1 flex-shrink-0">
                {getIcon()}
            </div>
            <div>
                <h3 className="text-lg font-bold leading-6 mb-1">
                {title}
                </h3>
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {content}
                </div>
            </div>
            </div>
        </div>

        <button 
          onClick={onCancel || onConfirm} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition z-10"
        >
          <X size={20} />
        </button>

        <div className="flex justify-end space-x-2 p-4 border-t flex-shrink-0 z-10" style={{ borderColor: 'var(--glass-border)', background: 'var(--modal-header-bg)' }}>
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-md border transition cursor-pointer"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--glass-border)', background: 'transparent' }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition cursor-pointer ${
              type === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
